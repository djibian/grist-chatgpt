import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ExecutionJournalRevisionError,
  FileExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import {
  ExecutionLifecycle,
  ExecutionLifecycleInvariantError,
  ExecutionStepTransitionError
} from "../src/execution/executionLifecycle.js";

function plan(stepCount = 1): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-lifecycle-001",
      executionContractVersion: "contract-v1",
      planId: "lifecycle-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: Array.from({ length: stepCount }, (_, index) => ({
      stepId: `step-${index + 1}`,
      order: index + 1,
      operation: index === 0 ? "create_records" : "update_records",
      capability: "doc:write",
      preconditions: ["synthetic fixture is ready"],
      expectedStateTokens: { fixture: `v${index + 1}` },
      effectIntent: {
        intentId: `synthetic-effect-${index + 1}`,
        fingerprint: `fixture-marker-v${index + 1}`
      }
    })),
    budgetLimits: {
      writeItems: 10,
      effectfulSteps: stepCount
    },
    criticalProperties: [
      { propertyId: "fixture-converges", criticality: "CRITICAL" }
    ]
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
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-lifecycle-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("J1 lifecycle persists the RUNNING write-ahead barrier and exact intended effect identity before external dispatch", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const lifecycle = new ExecutionLifecycle(journal);

    const prepared = await lifecycle.prepareEffect("j1-lifecycle-001", "step-1");
    assert.equal(prepared.revision, 1);
    assert.equal(prepared.status, "RUNNING");
    assert.equal(prepared.steps[0]?.status, "RUNNING");
    assert.equal(prepared.steps[0]?.effectState, "NOT_APPLIED");
    assert.deepEqual(prepared.steps[0]?.preparedEffect, {
      intentId: "synthetic-effect-1",
      fingerprint: "fixture-marker-v1"
    });

    const restarted = new FileExecutionJournal(directory);
    const durable = await restarted.load("j1-lifecycle-001");
    assert.equal(durable?.revision, 1);
    assert.equal(durable?.steps[0]?.status, "RUNNING");
    assert.equal(durable?.steps[0]?.effectState, "NOT_APPLIED");
    assert.deepEqual(durable?.steps[0]?.preparedEffect, {
      intentId: "synthetic-effect-1",
      fingerprint: "fixture-marker-v1"
    });
  });
});

test("J1 lifecycle refuses an effectful write-ahead transition without immutable effect intent identity", async () => {
  await withJournalDirectory(async (directory) => {
    const definition = plan();
    definition.steps[0]!.effectIntent = undefined;
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(definition);

    await assert.rejects(
      () => new ExecutionLifecycle(journal).prepareEffect("j1-lifecycle-001", "step-1"),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionLifecycleInvariantError);
        assert.match(error.message, /no immutable effect intent identity/);
        return true;
      }
    );

    const durable = await journal.load("j1-lifecycle-001");
    assert.equal(durable?.revision, 0);
    assert.equal(durable?.steps[0]?.status, "PENDING");
  });
});

test("J1 journal rejects a forged prepared effect identity that differs from the immutable plan", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan());
    const forged = mutableState(initial);
    forged.status = "RUNNING";
    forged.steps = [
      {
        ...forged.steps[0]!,
        status: "RUNNING",
        preparedEffect: {
          intentId: "different-effect",
          fingerprint: "different-fingerprint"
        }
      }
    ];

    await assert.rejects(
      () => journal.compareAndSet("j1-lifecycle-001", 0, forged),
      /prepared effect does not match the immutable plan intent/
    );

    const durable = await journal.load("j1-lifecycle-001");
    assert.equal(durable?.revision, 0);
  });
});

test("J1 restart converts an unresolved RUNNING step to UNCERTAIN and retains its intended effect identity", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    await new ExecutionLifecycle(journal).prepareEffect("j1-lifecycle-001", "step-1");

    const restartedJournal = new FileExecutionJournal(directory);
    const recovered = await new ExecutionLifecycle(restartedJournal).recoverAfterRestart(
      "j1-lifecycle-001"
    );

    assert.equal(recovered.revision, 2);
    assert.equal(recovered.status, "SUSPENDED");
    assert.equal(recovered.steps[0]?.status, "SUSPENDED");
    assert.equal(recovered.steps[0]?.effectState, "UNCERTAIN");
    assert.deepEqual(recovered.steps[0]?.preparedEffect, {
      intentId: "synthetic-effect-1",
      fingerprint: "fixture-marker-v1"
    });
  });
});

test("J1 restart does not rewrite a result that was durably recorded before interruption", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const lifecycle = new ExecutionLifecycle(journal);
    await lifecycle.prepareEffect("j1-lifecycle-001", "step-1");
    const recorded = await lifecycle.recordEffect("j1-lifecycle-001", "step-1", {
      effectState: "APPLIED",
      confirmedEffect: { stableIds: [701], confirmedItems: 1 }
    });

    const restarted = new ExecutionLifecycle(new FileExecutionJournal(directory));
    const recovered = await restarted.recoverAfterRestart("j1-lifecycle-001");

    assert.deepEqual(recovered, recorded);
    assert.equal(recovered.revision, 2);
    assert.equal(recovered.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(recovered.steps[0]?.effectState, "APPLIED");
    assert.deepEqual(recovered.steps[0]?.confirmedEffect.stableIds, [701]);
    assert.deepEqual(recovered.steps[0]?.preparedEffect, {
      intentId: "synthetic-effect-1",
      fingerprint: "fixture-marker-v1"
    });
  });
});

test("J1 uncertain effect knowledge retains confirmed evidence and suspends without replay", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const lifecycle = new ExecutionLifecycle(journal);
    await lifecycle.prepareEffect("j1-lifecycle-001", "step-1");

    const recorded = await lifecycle.recordEffect("j1-lifecycle-001", "step-1", {
      effectState: "UNCERTAIN",
      confirmedEffect: { stableIds: [701, 702], confirmedItems: 2 }
    });

    assert.equal(recorded.status, "SUSPENDED");
    assert.equal(recorded.steps[0]?.status, "SUSPENDED");
    assert.equal(recorded.steps[0]?.effectState, "UNCERTAIN");
    assert.deepEqual(recorded.steps[0]?.confirmedEffect.stableIds, [701, 702]);
  });
});

test("J1 partial effect knowledge suspends until capability-specific recovery exists", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const lifecycle = new ExecutionLifecycle(journal);
    await lifecycle.prepareEffect("j1-lifecycle-001", "step-1");

    const recorded = await lifecycle.recordEffect("j1-lifecycle-001", "step-1", {
      effectState: "PARTIALLY_APPLIED",
      confirmedEffect: { stableIds: [701], confirmedItems: 1 }
    });

    assert.equal(recorded.status, "SUSPENDED");
    assert.equal(recorded.steps[0]?.status, "SUSPENDED");
    assert.equal(recorded.steps[0]?.effectState, "PARTIALLY_APPLIED");
  });
});

test("J1 lifecycle rejects contradictory no-effect and partial-effect evidence", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const lifecycle = new ExecutionLifecycle(journal);
    await lifecycle.prepareEffect("j1-lifecycle-001", "step-1");

    await assert.rejects(
      () =>
        lifecycle.recordEffect("j1-lifecycle-001", "step-1", {
          effectState: "NOT_APPLIED",
          confirmedEffect: { stableIds: [701], confirmedItems: 1 }
        }),
      ExecutionLifecycleInvariantError
    );
    await assert.rejects(
      () =>
        lifecycle.recordEffect("j1-lifecycle-001", "step-1", {
          effectState: "PARTIALLY_APPLIED"
        }),
      ExecutionLifecycleInvariantError
    );

    const durable = await journal.load("j1-lifecycle-001");
    assert.equal(durable?.revision, 1);
    assert.equal(durable?.steps[0]?.status, "RUNNING");
  });
});

test("J1 lifecycle requires prior steps to be VERIFIED before crossing the next write-ahead barrier", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan(2));
    const lifecycle = new ExecutionLifecycle(journal);

    await assert.rejects(
      () => lifecycle.prepareEffect("j1-lifecycle-001", "step-2"),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionStepTransitionError);
        assert.match(error.message, /prior step "step-1" is PENDING, not VERIFIED/);
        return true;
      }
    );

    const ready = mutableState(initial);
    ready.status = "RUNNING";
    ready.steps = [
      {
        ...ready.steps[0]!,
        status: "VERIFIED",
        effectState: "APPLIED",
        preparedEffect: structuredClone(initial.definition.steps[0]!.effectIntent!)
      },
      ready.steps[1]!
    ];
    await journal.compareAndSet("j1-lifecycle-001", 0, ready);

    const prepared = await lifecycle.prepareEffect("j1-lifecycle-001", "step-2");
    assert.equal(prepared.steps[1]?.status, "RUNNING");
    assert.deepEqual(prepared.steps[1]?.preparedEffect, initial.definition.steps[1]!.effectIntent);
  });
});

test("J1 lifecycle serializes concurrent prepare attempts through the journal CAS", async () => {
  await withJournalDirectory(async (directory) => {
    const firstJournal = new FileExecutionJournal(directory);
    const secondJournal = new FileExecutionJournal(directory);
    await firstJournal.initialize(plan());

    const attempts = await Promise.allSettled([
      new ExecutionLifecycle(firstJournal).prepareEffect("j1-lifecycle-001", "step-1"),
      new ExecutionLifecycle(secondJournal).prepareEffect("j1-lifecycle-001", "step-1")
    ]);

    const fulfilled = attempts.filter(
      (result): result is PromiseFulfilledResult<ExecutionJournalRecord> =>
        result.status === "fulfilled"
    );
    const rejected = attempts.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      rejected[0]!.reason instanceof ExecutionJournalRevisionError ||
        rejected[0]!.reason instanceof ExecutionStepTransitionError
    );

    const durable = await new FileExecutionJournal(directory).load("j1-lifecycle-001");
    assert.equal(durable?.revision, 1);
    assert.equal(durable?.steps[0]?.status, "RUNNING");
  });
});

test("J1 restart pessimistically marks every structurally valid unresolved RUNNING step uncertain while retaining each effect identity", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    const initial = await journal.initialize(plan(2));
    const unsafe = mutableState(initial);
    unsafe.status = "RUNNING";
    unsafe.steps = unsafe.steps.map((step, index) => ({
      ...step,
      status: "RUNNING",
      preparedEffect: structuredClone(initial.definition.steps[index]!.effectIntent!)
    }));
    await journal.compareAndSet("j1-lifecycle-001", 0, unsafe);

    const recovered = await new ExecutionLifecycle(
      new FileExecutionJournal(directory)
    ).recoverAfterRestart("j1-lifecycle-001");

    assert.equal(recovered.status, "SUSPENDED");
    assert.deepEqual(
      recovered.steps.map(({ status, effectState, preparedEffect }) => ({
        status,
        effectState,
        preparedEffect
      })),
      [
        {
          status: "SUSPENDED",
          effectState: "UNCERTAIN",
          preparedEffect: {
            intentId: "synthetic-effect-1",
            fingerprint: "fixture-marker-v1"
          }
        },
        {
          status: "SUSPENDED",
          effectState: "UNCERTAIN",
          preparedEffect: {
            intentId: "synthetic-effect-2",
            fingerprint: "fixture-marker-v2"
          }
        }
      ]
    );
  });
});
