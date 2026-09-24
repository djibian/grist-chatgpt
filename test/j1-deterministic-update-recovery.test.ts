import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DeterministicUpdateRecordsRecovery,
  DeterministicUpdateRecoveryInvariantError,
  type DeterministicUpdateRecoveryRequest
} from "../src/execution/deterministicUpdateRecordsRecovery.js";
import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import { ExecutionLifecycle } from "../src/execution/executionLifecycle.js";

function plan(operation = "update_records"): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-recovery-001",
      executionContractVersion: "contract-v1",
      planId: "deterministic-update-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: "set-marker",
        order: 1,
        operation,
        capability: "doc:write",
        preconditions: ["synthetic fixture remains isolated"],
        expectedStateTokens: {
          "recovery.before": "marker:before:v1",
          "recovery.after": "marker:after:v1"
        },
        effectIntent: {
          intentId: "set-marker-once",
          fingerprint: "marker-update-v1"
        },
        budgetCost: { records: 1 }
      }
    ],
    budgetLimits: { records: 1 },
    criticalProperties: [
      { propertyId: "marker-updated", criticality: "CRITICAL" }
    ]
  };
}

async function withJournal(
  run: (journal: FileExecutionJournal) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-recovery-"));
  try {
    await run(new FileExecutionJournal(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function suspendUncertain(
  journal: FileExecutionJournal,
  definition: ExecutionPlanDefinition = plan()
): Promise<void> {
  await journal.initialize(definition);
  const lifecycle = new ExecutionLifecycle(journal);
  await lifecycle.prepareEffect("j1-recovery-001", "set-marker");
  await lifecycle.recoverAfterRestart("j1-recovery-001");
}

test("J1 deterministic update recovery confirms the frozen postcondition without replay", async () => {
  await withJournal(async (journal) => {
    await suspendUncertain(journal);
    let request: DeterministicUpdateRecoveryRequest | undefined;
    const recovery = new DeterministicUpdateRecordsRecovery(journal, {
      async observeCurrentState(candidate) {
        request = candidate;
        return {
          stateToken: "marker:after:v1",
          confirmedEffect: { stableIds: [701], confirmedItems: 1 }
        };
      }
    });

    const result = await recovery.reconcile("j1-recovery-001", "set-marker");

    assert.equal(result.decision, "EFFECT_CONFIRMED");
    assert.equal(result.record.status, "RUNNING");
    assert.equal(result.record.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(result.record.steps[0]?.effectState, "APPLIED");
    assert.deepEqual(result.record.steps[0]?.confirmedEffect, {
      stableIds: [701],
      confirmedItems: 1
    });
    assert.deepEqual(result.record.budgets.records, { reserved: 0, consumed: 1 });
    assert.deepEqual(request, {
      executionId: "j1-recovery-001",
      executionContractVersion: "contract-v1",
      planId: "deterministic-update-plan",
      planVersion: "plan-v1",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1",
      target: "doc-j1-fixture",
      stepId: "set-marker",
      operation: "update_records",
      effectIntent: {
        intentId: "set-marker-once",
        fingerprint: "marker-update-v1"
      },
      beforeStateToken: "marker:before:v1",
      afterStateToken: "marker:after:v1"
    });
  });
});

test("J1 deterministic update recovery proves no effect before allowing an explicit retry", async () => {
  await withJournal(async (journal) => {
    await suspendUncertain(journal);
    const recovery = new DeterministicUpdateRecordsRecovery(journal, {
      async observeCurrentState() {
        return { stateToken: "marker:before:v1" };
      }
    });

    const result = await recovery.reconcile("j1-recovery-001", "set-marker");

    assert.equal(result.decision, "SAFE_TO_RETRY");
    assert.equal(result.record.status, "PENDING");
    assert.equal(result.record.steps[0]?.status, "PENDING");
    assert.equal(result.record.steps[0]?.effectState, "NOT_APPLIED");
    assert.equal(result.record.steps[0]?.preparedEffect, undefined);
    assert.deepEqual(result.record.budgets.records, { reserved: 0, consumed: 0 });

    const preparedAgain = await new ExecutionLifecycle(journal).prepareEffect(
      "j1-recovery-001",
      "set-marker"
    );
    assert.equal(preparedAgain.steps[0]?.status, "RUNNING");
    assert.deepEqual(preparedAgain.budgets.records, { reserved: 1, consumed: 0 });
  });
});

test("J1 deterministic update recovery keeps observational ambiguity suspended", async () => {
  await withJournal(async (journal) => {
    await suspendUncertain(journal);
    const before = await journal.load("j1-recovery-001");
    assert.ok(before);

    const result = await new DeterministicUpdateRecordsRecovery(journal, {
      async observeCurrentState() {
        return { stateToken: "marker:human-or-unknown:v2" };
      }
    }).reconcile("j1-recovery-001", "set-marker");

    assert.equal(result.decision, "SUSPENDED");
    assert.deepEqual(result.record, before);
    assert.deepEqual(await journal.load("j1-recovery-001"), before);
  });
});

test("J1 deterministic update recovery rejects contradictory precondition/effect evidence", async () => {
  await withJournal(async (journal) => {
    await suspendUncertain(journal);
    const recovery = new DeterministicUpdateRecordsRecovery(journal, {
      async observeCurrentState() {
        return {
          stateToken: "marker:before:v1",
          confirmedEffect: { stableIds: [701], confirmedItems: 1 }
        };
      }
    });

    await assert.rejects(
      () => recovery.reconcile("j1-recovery-001", "set-marker"),
      DeterministicUpdateRecoveryInvariantError
    );
    const durable = await journal.load("j1-recovery-001");
    assert.equal(durable?.status, "SUSPENDED");
    assert.equal(durable?.steps[0]?.effectState, "UNCERTAIN");
    assert.deepEqual(durable?.budgets.records, { reserved: 1, consumed: 0 });
  });
});

test("J1 deterministic update recovery refuses to generalize beyond update_records", async () => {
  await withJournal(async (journal) => {
    await suspendUncertain(journal, plan("create_records"));
    const recovery = new DeterministicUpdateRecordsRecovery(journal, {
      async observeCurrentState() {
        return { stateToken: "marker:after:v1" };
      }
    });

    await assert.rejects(
      () => recovery.reconcile("j1-recovery-001", "set-marker"),
      (error: unknown) => {
        assert.ok(error instanceof DeterministicUpdateRecoveryInvariantError);
        assert.match(error.message, /not the bounded update_records recovery capability/);
        return true;
      }
    );
  });
});
