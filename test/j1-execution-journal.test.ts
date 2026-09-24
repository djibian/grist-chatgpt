import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ExecutionDefinitionConflictError,
  ExecutionJournalCorruptError,
  ExecutionJournalRevisionError,
  FileExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";

function plan(overrides: Partial<ExecutionPlanDefinition> = {}): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-execution-001",
      executionContractVersion: "contract-v1",
      planId: "synthetic-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: "inspect",
        order: 1,
        operation: "inspect_document",
        capability: "doc:read",
        preconditions: ["fixture exists"],
        expectedStateTokens: { document: "fixture-v1" }
      },
      {
        stepId: "create",
        order: 2,
        operation: "create_records",
        capability: "doc:write",
        preconditions: ["marker absent"],
        expectedStateTokens: { marker: "absent" }
      }
    ],
    budgetLimits: {
      writeItems: 2,
      effectfulSteps: 1
    },
    criticalProperties: [
      { propertyId: "marker-created-once", criticality: "CRITICAL" }
    ],
    ...overrides
  };
}

function mutableState(record: ExecutionJournalRecord): ExecutionJournalMutableState {
  return {
    status: record.status,
    steps: structuredClone(record.steps),
    budgets: structuredClone(record.budgets),
    verificationEvidence: structuredClone(record.verificationEvidence)
  };
}

async function withJournalDirectory(
  run: (directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("J1 journal persists immutable execution identity and initial state across re-instantiation", async () => {
  await withJournalDirectory(async (directory) => {
    const now = new Date("2026-09-24T08:30:00.000Z");
    const journal = new FileExecutionJournal(directory, { now: () => now });
    const definition = plan();

    const created = await journal.initialize(definition);
    assert.equal(created.revision, 0);
    assert.equal(created.status, "PLANNED");
    assert.equal(created.definition.identity.executionId, "j1-execution-001");
    assert.equal(created.definition.identity.planVersion, "plan-v1");
    assert.equal(created.steps.length, 2);
    assert.deepEqual(
      created.steps.map(({ stepId, status, effectState }) => ({
        stepId,
        status,
        effectState
      })),
      [
        { stepId: "inspect", status: "PENDING", effectState: "NOT_DISPATCHED" },
        { stepId: "create", status: "PENDING", effectState: "NOT_DISPATCHED" }
      ]
    );
    assert.deepEqual(created.budgets, {
      effectfulSteps: { reserved: 0, consumed: 0 },
      writeItems: { reserved: 0, consumed: 0 }
    });

    const restarted = new FileExecutionJournal(directory);
    assert.deepEqual(await restarted.load("j1-execution-001"), created);
  });
});

test("J1 journal treats execution contract and plan definition as immutable", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const original = plan();
    await journal.initialize(original);

    const same = await journal.initialize(structuredClone(original));
    assert.equal(same.revision, 0);

    const changed = structuredClone(original);
    changed.identity.planVersion = "plan-v2";

    await assert.rejects(
      () => journal.initialize(changed),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionDefinitionConflictError);
        assert.equal(error.executionId, "j1-execution-001");
        return true;
      }
    );
  });
});

test("J1 journal serializes same-process compare-and-set updates and rejects the stale revision", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan());

    const running = mutableState(initial);
    running.status = "RUNNING";
    const suspended = mutableState(initial);
    suspended.status = "SUSPENDED";

    const results = await Promise.allSettled([
      journal.compareAndSet(initial.definition.identity.executionId, 0, running),
      journal.compareAndSet(initial.definition.identity.executionId, 0, suspended)
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<ExecutionJournalRecord> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    assert.equal(fulfilled.length, 1);
    assert.equal(fulfilled[0]!.value.revision, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]!.reason instanceof ExecutionJournalRevisionError);
    assert.equal(rejected[0]!.reason.expectedRevision, 0);
    assert.equal(rejected[0]!.reason.actualRevision, 1);

    const restarted = new FileExecutionJournal(directory);
    const persisted = await restarted.load("j1-execution-001");
    assert.equal(persisted?.revision, 1);
    assert.equal(persisted?.status, fulfilled[0]!.value.status);
  });
});

test("J1 journal rejects mutable state that changes immutable step or budget dimensions", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan());

    const wrongStep = mutableState(initial);
    wrongStep.steps = [
      { ...wrongStep.steps[0]!, stepId: "different-step" },
      wrongStep.steps[1]!
    ];
    await assert.rejects(
      () => journal.compareAndSet("j1-execution-001", 0, wrongStep),
      /preserve immutable step order and IDs/
    );

    const wrongBudget = mutableState(initial);
    wrongBudget.budgets = {
      ...wrongBudget.budgets,
      inventedDimension: { reserved: 0, consumed: 0 }
    };
    await assert.rejects(
      () => journal.compareAndSet("j1-execution-001", 0, wrongBudget),
      /match immutable budget dimensions exactly/
    );
  });
});

test("J1 journal validates contextual verification evidence against immutable identity", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan());
    const next = mutableState(initial);
    next.status = "RUNNING";
    next.verificationEvidence = [
      {
        evidenceId: "evidence-1",
        propertyId: "marker-created-once",
        criticality: "CRITICAL",
        verdict: "VERIFIED",
        executionId: "j1-execution-001",
        planVersion: "plan-v1",
        principalId: "principal-j1",
        method: "targeted synthetic fixture read",
        timestamp: "2026-09-24T08:31:00.000Z",
        targetStateToken: "fixture-v2",
        dependencies: ["step:create"]
      }
    ];
    next.steps = [
      next.steps[0]!,
      { ...next.steps[1]!, verificationEvidenceIds: ["evidence-1"] }
    ];

    const saved = await journal.compareAndSet("j1-execution-001", 0, next);
    assert.equal(saved.verificationEvidence[0]?.propertyId, "marker-created-once");

    const invalid = mutableState(saved);
    invalid.verificationEvidence = [
      { ...saved.verificationEvidence[0]!, principalId: "other-principal" }
    ];
    await assert.rejects(
      () => journal.compareAndSet("j1-execution-001", 1, invalid),
      /does not match immutable execution identity/
    );
  });
});

test("J1 journal fails closed when persisted state is corrupt or unsupported", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());

    const file = join(
      directory,
      `${Buffer.from("j1-execution-001", "utf8").toString("base64url")}.json`
    );
    const raw = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    raw.status = "TELEPORTED";
    await writeFile(file, `${JSON.stringify(raw)}\n`, "utf8");

    const restarted = new FileExecutionJournal(directory);
    await assert.rejects(
      () => restarted.load("j1-execution-001"),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionJournalCorruptError);
        assert.equal(error.executionId, "j1-execution-001");
        return true;
      }
    );
  });
});
