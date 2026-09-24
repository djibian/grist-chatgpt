import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import { ExecutionLifecycle } from "../src/execution/executionLifecycle.js";
import { VerificationEvidenceLifecycle } from "../src/execution/verificationEvidenceLifecycle.js";
import {
  FileVerificationContractStore,
  VerificationCompletionLifecycle,
  VerificationContractConflictError,
  VerificationContractInvariantError,
  VerificationRequirementNotMetError,
  type ExecutionVerificationContractDefinition
} from "../src/execution/verificationCompletion.js";

function plan(): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-completion-001",
      executionContractVersion: "contract-v1",
      planId: "completion-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: "create-marker",
        order: 1,
        operation: "create_records",
        capability: "doc:write",
        preconditions: ["marker absent"],
        expectedStateTokens: { marker: "absent" },
        effectIntent: {
          intentId: "create-marker-once",
          fingerprint: "marker-v1"
        }
      }
    ],
    budgetLimits: {},
    criticalProperties: [
      { propertyId: "marker-created-once", criticality: "CRITICAL" },
      { propertyId: "marker-visible", criticality: "IMPORTANT" }
    ]
  };
}

function contract(
  definition: ExecutionPlanDefinition = plan()
): ExecutionVerificationContractDefinition {
  return {
    identity: structuredClone(definition.identity),
    steps: [
      {
        stepId: "create-marker",
        requiredPropertyIds: ["marker-created-once", "marker-visible"]
      }
    ]
  };
}

async function withDirectories(
  run: (journalDirectory: string, contractDirectory: string) => Promise<void>
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-completion-"));
  try {
    await run(join(root, "journal"), join(root, "contracts"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function recordAppliedEffect(journal: FileExecutionJournal): Promise<void> {
  const lifecycle = new ExecutionLifecycle(journal);
  await lifecycle.prepareEffect("j1-completion-001", "create-marker");
  await lifecycle.recordEffect("j1-completion-001", "create-marker", {
    effectState: "APPLIED",
    confirmedEffect: { stableIds: [701], confirmedItems: 1 }
  });
}

test("J1 verification contract freezes exact step requirements before execution starts", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    const store = new FileVerificationContractStore(contractDirectory);

    const frozen = await store.initialize(initial, contract());
    assert.deepEqual(frozen.steps, [
      {
        stepId: "create-marker",
        requiredPropertyIds: ["marker-created-once", "marker-visible"]
      }
    ]);

    const restarted = await new FileVerificationContractStore(contractDirectory).load(
      "j1-completion-001"
    );
    assert.deepEqual(restarted, frozen);
    const durable = await journal.load("j1-completion-001");
    assert.equal(durable?.revision, 0);
    assert.equal(durable?.status, "PENDING");
  });
});

test("J1 verification contract cannot omit a CRITICAL property or invent a property", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    const store = new FileVerificationContractStore(contractDirectory);

    await assert.rejects(
      () =>
        store.initialize(initial, {
          identity: structuredClone(initial.definition.identity),
          steps: [
            { stepId: "create-marker", requiredPropertyIds: ["marker-visible"] }
          ]
        }),
      (error: unknown) => {
        assert.ok(error instanceof VerificationContractInvariantError);
        assert.match(error.message, /Critical property "marker-created-once" is not required/);
        return true;
      }
    );

    await assert.rejects(
      () =>
        store.initialize(initial, {
          identity: structuredClone(initial.definition.identity),
          steps: [
            { stepId: "create-marker", requiredPropertyIds: ["invented-property"] }
          ]
        }),
      (error: unknown) => {
        assert.ok(error instanceof VerificationContractInvariantError);
        assert.match(error.message, /requires unknown property/);
        return true;
      }
    );
  });
});

test("J1 verification contract cannot be weakened under the same execution identity", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    const store = new FileVerificationContractStore(contractDirectory);
    await store.initialize(initial, contract());

    await assert.rejects(
      () =>
        store.initialize(initial, {
          identity: structuredClone(initial.definition.identity),
          steps: [
            {
              stepId: "create-marker",
              requiredPropertyIds: ["marker-created-once"]
            }
          ]
        }),
      VerificationContractConflictError
    );
  });
});

test("J1 verification contract cannot first appear after execution has crossed the write-ahead barrier", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    await journal.initialize(plan());
    await new ExecutionLifecycle(journal).prepareEffect(
      "j1-completion-001",
      "create-marker"
    );
    const running = await journal.load("j1-completion-001");
    assert.ok(running);

    await assert.rejects(
      () =>
        new FileVerificationContractStore(contractDirectory).initialize(
          running,
          contract(running.definition)
        ),
      VerificationContractInvariantError
    );
  });
});

test("J1 completion requires the latest linked verdict for every frozen property to be VERIFIED", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    const store = new FileVerificationContractStore(contractDirectory);
    await store.initialize(initial, contract());
    await recordAppliedEffect(journal);

    const evidence = new VerificationEvidenceLifecycle(journal);
    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-critical-ok",
      propertyId: "marker-created-once",
      verdict: "VERIFIED",
      method: "synthetic fixture read",
      dependencies: ["target:fixture-v2"]
    });
    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-visible-unknown",
      propertyId: "marker-visible",
      verdict: "UNKNOWN",
      method: "synthetic fixture read",
      dependencies: ["target:fixture-v2"]
    });

    const completion = new VerificationCompletionLifecycle(journal, store);
    await assert.rejects(
      () => completion.markStepVerified("j1-completion-001", "create-marker"),
      (error: unknown) => {
        assert.ok(error instanceof VerificationRequirementNotMetError);
        assert.equal(error.propertyId, "marker-visible");
        assert.equal(error.verdict, "UNKNOWN");
        return true;
      }
    );

    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-visible-ok",
      propertyId: "marker-visible",
      verdict: "VERIFIED",
      method: "synthetic fixture read after reconciliation",
      dependencies: ["target:fixture-v3"]
    });

    const completed = await completion.markStepVerified(
      "j1-completion-001",
      "create-marker"
    );
    assert.equal(completed.steps[0]?.status, "VERIFIED");
    assert.equal(completed.status, "COMPLETED");

    const replayed = await completion.markStepVerified(
      "j1-completion-001",
      "create-marker"
    );
    assert.deepEqual(replayed, completed);
  });
});

test("J1 completion fails when a later linked observation invalidates an earlier VERIFIED verdict", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    const store = new FileVerificationContractStore(contractDirectory);
    await store.initialize(initial, contract());
    await recordAppliedEffect(journal);

    const evidence = new VerificationEvidenceLifecycle(journal);
    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-critical-first-ok",
      propertyId: "marker-created-once",
      verdict: "VERIFIED",
      method: "first read",
      dependencies: []
    });
    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-critical-later-bad",
      propertyId: "marker-created-once",
      verdict: "VIOLATED",
      method: "later read",
      dependencies: []
    });
    await evidence.recordEvidence("j1-completion-001", "create-marker", {
      evidenceId: "ev-visible-ok",
      propertyId: "marker-visible",
      verdict: "VERIFIED",
      method: "later read",
      dependencies: []
    });

    await assert.rejects(
      () =>
        new VerificationCompletionLifecycle(journal, store).markStepVerified(
          "j1-completion-001",
          "create-marker"
        ),
      (error: unknown) => {
        assert.ok(error instanceof VerificationRequirementNotMetError);
        assert.equal(error.propertyId, "marker-created-once");
        assert.equal(error.verdict, "VIOLATED");
        return true;
      }
    );

    const durable = await journal.load("j1-completion-001");
    assert.equal(durable?.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(durable?.status, "RUNNING");
  });
});

test("J1 completion works after restart from only durable journal and verification-contract state", async () => {
  await withDirectories(async (journalDirectory, contractDirectory) => {
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(plan());
    await new FileVerificationContractStore(contractDirectory).initialize(
      initial,
      contract()
    );
    await recordAppliedEffect(journal);
    const evidence = new VerificationEvidenceLifecycle(journal);
    for (const [evidenceId, propertyId] of [
      ["ev-critical", "marker-created-once"],
      ["ev-visible", "marker-visible"]
    ] as const) {
      await evidence.recordEvidence("j1-completion-001", "create-marker", {
        evidenceId,
        propertyId,
        verdict: "VERIFIED",
        method: "durable fixture read",
        dependencies: ["target:fixture-v2"]
      });
    }

    const restartedCompletion = new VerificationCompletionLifecycle(
      new FileExecutionJournal(journalDirectory),
      new FileVerificationContractStore(contractDirectory)
    );
    const completed = await restartedCompletion.markStepVerified(
      "j1-completion-001",
      "create-marker"
    );

    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.steps[0]?.status, "VERIFIED");
  });
});
