import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

test("J1 journal persists immutable execution identity and contractual initial vocabulary across restart", async () => {
  await withJournalDirectory(async (directory) => {
    const now = new Date("2026-09-24T08:30:00.000Z");
    const journal = new FileExecutionJournal(directory, { now: () => now });
    const definition = plan();

    const created = await journal.initialize(definition);
    assert.equal(created.revision, 0);
    assert.equal(created.status, "PENDING");
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
        { stepId: "inspect", status: "PENDING", effectState: "NOT_APPLIED" },
        { stepId: "create", status: "PENDING", effectState: "NOT_APPLIED" }
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

test("J1 journal snapshots the immutable definition before the first asynchronous boundary", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const definition = plan();

    const initializing = journal.initialize(definition);
    definition.identity.planVersion = "caller-mutated-plan";
    definition.steps[0]!.operation = "caller_mutated_operation";

    const created = await initializing;
    assert.equal(created.definition.identity.planVersion, "plan-v1");
    assert.equal(created.definition.steps[0]?.operation, "inspect_document");

    const restarted = new FileExecutionJournal(directory);
    const persisted = await restarted.load("j1-execution-001");
    assert.equal(persisted?.definition.identity.planVersion, "plan-v1");
    assert.equal(persisted?.definition.steps[0]?.operation, "inspect_document");
  });
});

test("J1 journal rejects non-canonical execution IDs before they can alias a journal path", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const definition = plan();
    definition.identity.executionId = " j1-execution-001 ";

    await assert.rejects(
      () => journal.initialize(definition),
      /canonical identifier without surrounding whitespace/
    );
    await assert.rejects(
      () => journal.load(" j1-execution-001 "),
      /canonical identifier without surrounding whitespace/
    );
    assert.equal(await journal.load("j1-execution-001"), null);
  });
});

test("J1 journal supports the declared maximum execution ID without filesystem-name expansion failure", async () => {
  await withJournalDirectory(async (directory) => {
    const executionId = "x".repeat(200);
    const definition = plan();
    definition.identity.executionId = executionId;
    const journal = new FileExecutionJournal(directory);

    const created = await journal.initialize(definition);
    assert.equal(created.definition.identity.executionId, executionId);
    assert.deepEqual(await new FileExecutionJournal(directory).load(executionId), created);

    const entries = await readdir(directory);
    assert.equal(entries.length, 1);
    assert.match(entries[0]!, /^[A-Za-z0-9_-]{43}\.json$/);
  });
});

test("J1 journal serializes same-instance compare-and-set updates and rejects the stale revision", async () => {
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
  });
});

test("J1 journal serializes compare-and-set across journal instances in the same writer process", async () => {
  await withJournalDirectory(async (directory) => {
    const first = new FileExecutionJournal(directory);
    const second = new FileExecutionJournal(directory);
    const initial = await first.initialize(plan());

    const running = mutableState(initial);
    running.status = "RUNNING";
    const suspended = mutableState(initial);
    suspended.status = "SUSPENDED";

    const results = await Promise.allSettled([
      first.compareAndSet("j1-execution-001", 0, running),
      second.compareAndSet("j1-execution-001", 0, suspended)
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<ExecutionJournalRecord> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]!.reason instanceof ExecutionJournalRevisionError);

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

test("J1 journal persists the final contextual evidence vocabulary and validates immutable identity", async () => {
  await withJournalDirectory(async (directory) => {
    const definition = plan({
      criticalProperties: [
        { propertyId: "marker-created-once", criticality: "CRITICAL" },
        { propertyId: "marker-observed", criticality: "IMPORTANT" },
        { propertyId: "trace-only", criticality: "INFORMATIONAL" },
        { propertyId: "negative-example", criticality: "CRITICAL" }
      ]
    });
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(definition);
    const next = mutableState(initial);
    next.status = "RUNNING";
    next.verificationEvidence = [
      {
        evidenceId: "evidence-verified",
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
      },
      {
        evidenceId: "evidence-unknown",
        propertyId: "marker-observed",
        criticality: "IMPORTANT",
        verdict: "UNKNOWN",
        executionId: "j1-execution-001",
        planVersion: "plan-v1",
        principalId: "principal-j1",
        method: "bounded observation",
        timestamp: "2026-09-24T08:31:01.000Z",
        dependencies: ["step:inspect"]
      },
      {
        evidenceId: "evidence-na",
        propertyId: "trace-only",
        criticality: "INFORMATIONAL",
        verdict: "NOT_APPLICABLE",
        executionId: "j1-execution-001",
        planVersion: "plan-v1",
        principalId: "principal-j1",
        method: "scenario classification",
        timestamp: "2026-09-24T08:31:02.000Z",
        dependencies: []
      },
      {
        evidenceId: "evidence-violated",
        propertyId: "negative-example",
        criticality: "CRITICAL",
        verdict: "VIOLATED",
        executionId: "j1-execution-001",
        planVersion: "plan-v1",
        principalId: "principal-j1",
        method: "negative fixture check",
        timestamp: "2026-09-24T08:31:03.000Z",
        dependencies: ["step:create"]
      }
    ];
    next.steps = [
      next.steps[0]!,
      {
        ...next.steps[1]!,
        verificationEvidenceIds: ["evidence-verified", "evidence-violated"]
      }
    ];

    const saved = await journal.compareAndSet("j1-execution-001", 0, next);
    assert.deepEqual(
      saved.verificationEvidence.map(({ criticality, verdict }) => ({
        criticality,
        verdict
      })),
      [
        { criticality: "CRITICAL", verdict: "VERIFIED" },
        { criticality: "IMPORTANT", verdict: "UNKNOWN" },
        { criticality: "INFORMATIONAL", verdict: "NOT_APPLICABLE" },
        { criticality: "CRITICAL", verdict: "VIOLATED" }
      ]
    );

    const invalid = mutableState(saved);
    invalid.verificationEvidence = [
      { ...saved.verificationEvidence[0]!, principalId: "other-principal" },
      ...saved.verificationEvidence.slice(1)
    ];
    await assert.rejects(
      () => journal.compareAndSet("j1-execution-001", 1, invalid),
      /does not match immutable execution identity/
    );
  });
});

test("J1 journal retains contractual applied and compensated effect knowledge", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan());
    const next = mutableState(initial);
    next.status = "RUNNING";
    next.steps = [
      next.steps[0]!,
      {
        ...next.steps[1]!,
        status: "EFFECT_RECORDED",
        effectState: "PARTIALLY_APPLIED",
        confirmedEffect: { stableIds: [701, 702], confirmedItems: 2 }
      }
    ];

    const partial = await journal.compareAndSet("j1-execution-001", 0, next);
    assert.equal(partial.steps[1]?.effectState, "PARTIALLY_APPLIED");
    assert.deepEqual(partial.steps[1]?.confirmedEffect.stableIds, [701, 702]);

    const compensated = mutableState(partial);
    compensated.steps = [
      compensated.steps[0]!,
      { ...compensated.steps[1]!, effectState: "COMPENSATED" }
    ];
    const saved = await journal.compareAndSet("j1-execution-001", 1, compensated);
    assert.equal(saved.steps[1]?.effectState, "COMPENSATED");
  });
});

test("J1 journal fails closed when persisted state is corrupt, unsupported or uses legacy vocabulary", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());

    const entries = await readdir(directory);
    const journalFile = entries.find((entry) => entry.endsWith(".json"));
    assert.ok(journalFile);
    const file = join(directory, journalFile);
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      status: string;
      steps: Array<{ effectState: string }>;
    };
    raw.status = "PLANNED";
    raw.steps[0]!.effectState = "CONFIRMED";
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