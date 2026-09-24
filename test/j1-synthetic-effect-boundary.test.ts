import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type {
  CurrentExecutionAuthority,
  ExecutionAuthorityRequest
} from "../src/execution/executionAuthority.js";
import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import { ExecutionBudgetExceededError, ExecutionLifecycle } from "../src/execution/executionLifecycle.js";
import {
  SyntheticUpdatePreconditionFailedError,
  SyntheticUpdateRecordsEffectBoundary,
  type SyntheticUpdateDispatchRequest,
  type SyntheticUpdatePreconditionRequest
} from "../src/execution/syntheticUpdateRecordsEffectBoundary.js";

function plan(options: { operation?: string; cost?: number; limit?: number } = {}): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-boundary-001",
      executionContractVersion: "contract-v1",
      planId: "synthetic-boundary-plan",
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
        operation: options.operation ?? "update_records",
        capability: "doc:write",
        preconditions: ["marker row remains at frozen initial state"],
        expectedStateTokens: {
          "precondition.current": "marker:before:v1",
          "recovery.before": "marker:before:v1",
          "recovery.after": "marker:after:v1"
        },
        effectIntent: {
          intentId: "set-marker-once",
          fingerprint: "marker-update-v1"
        },
        budgetCost: { records: options.cost ?? 1 }
      }
    ],
    budgetLimits: { records: options.limit ?? 1 },
    criticalProperties: [
      { propertyId: "marker-updated", criticality: "CRITICAL" }
    ]
  };
}

function grantedAuthority(): CurrentExecutionAuthority {
  return {
    principalId: "principal-j1",
    mandateVersion: "mandate-v1",
    target: "doc-j1-fixture",
    capabilities: ["doc:write"]
  };
}

async function withJournal(
  run: (journal: FileExecutionJournal) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-boundary-"));
  try {
    await run(new FileExecutionJournal(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("J1 synthetic update boundary validates precondition and authority before durable write-ahead and dispatch", async () => {
  await withJournal(async (journal) => {
    await journal.initialize(plan());
    let preconditionRequest: SyntheticUpdatePreconditionRequest | undefined;
    let authorityRequest: ExecutionAuthorityRequest | undefined;
    let dispatchRequest: SyntheticUpdateDispatchRequest | undefined;

    const boundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      {
        async currentAuthority(request) {
          authorityRequest = request;
          return grantedAuthority();
        }
      },
      {
        async observeCurrentState(request) {
          preconditionRequest = request;
          return { stateToken: "marker:before:v1" };
        }
      },
      {
        async dispatch(request) {
          dispatchRequest = request;
          const durable = await journal.load("j1-boundary-001");
          assert.equal(durable?.steps[0]?.status, "RUNNING");
          assert.deepEqual(durable?.steps[0]?.preparedEffect, {
            intentId: "set-marker-once",
            fingerprint: "marker-update-v1"
          });
          assert.deepEqual(durable?.budgets.records, { reserved: 1, consumed: 0 });
          return {
            effectState: "APPLIED",
            confirmedEffect: { stableIds: [701], confirmedItems: 1 }
          };
        }
      }
    );

    const result = await boundary.execute("j1-boundary-001", "set-marker");

    assert.equal(result.status, "RUNNING");
    assert.equal(result.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(result.steps[0]?.effectState, "APPLIED");
    assert.deepEqual(result.steps[0]?.confirmedEffect, {
      stableIds: [701],
      confirmedItems: 1
    });
    assert.deepEqual(result.budgets.records, { reserved: 0, consumed: 1 });

    assert.deepEqual(preconditionRequest, {
      executionId: "j1-boundary-001",
      executionContractVersion: "contract-v1",
      planId: "synthetic-boundary-plan",
      planVersion: "plan-v1",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1",
      target: "doc-j1-fixture",
      stepId: "set-marker",
      operation: "update_records",
      capability: "doc:write",
      preconditions: ["marker row remains at frozen initial state"],
      expectedStateToken: "marker:before:v1"
    });
    assert.equal(authorityRequest?.executionId, "j1-boundary-001");
    assert.equal(authorityRequest?.capability, "doc:write");
    assert.deepEqual(dispatchRequest, {
      executionId: "j1-boundary-001",
      executionContractVersion: "contract-v1",
      planId: "synthetic-boundary-plan",
      planVersion: "plan-v1",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1",
      target: "doc-j1-fixture",
      stepId: "set-marker",
      operation: "update_records",
      capability: "doc:write",
      effectIntent: {
        intentId: "set-marker-once",
        fingerprint: "marker-update-v1"
      },
      journalRevision: 1
    });
  });
});

test("J1 synthetic update boundary refuses a stale/failed precondition before authority, budget reservation or dispatch", async () => {
  await withJournal(async (journal) => {
    await journal.initialize(plan());
    let authorityCalls = 0;
    let dispatchCalls = 0;
    const boundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      {
        async currentAuthority() {
          authorityCalls += 1;
          return grantedAuthority();
        }
      },
      {
        async observeCurrentState() {
          return { stateToken: "marker:human-change:v2" };
        }
      },
      {
        async dispatch() {
          dispatchCalls += 1;
          return { effectState: "UNCERTAIN" };
        }
      }
    );

    await assert.rejects(
      () => boundary.execute("j1-boundary-001", "set-marker"),
      SyntheticUpdatePreconditionFailedError
    );
    assert.equal(authorityCalls, 0);
    assert.equal(dispatchCalls, 0);
    const durable = await journal.load("j1-boundary-001");
    assert.equal(durable?.revision, 0);
    assert.equal(durable?.status, "PENDING");
    assert.deepEqual(durable?.budgets.records, { reserved: 0, consumed: 0 });
  });
});

test("J1 synthetic update boundary re-resolves revoked authority on each attempt and never dispatches a denied attempt", async () => {
  await withJournal(async (journal) => {
    await journal.initialize(plan());
    let authorityCalls = 0;
    let dispatchCalls = 0;
    const boundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      {
        async currentAuthority() {
          authorityCalls += 1;
          return authorityCalls === 1 ? null : grantedAuthority();
        }
      },
      {
        async observeCurrentState() {
          return { stateToken: "marker:before:v1" };
        }
      },
      {
        async dispatch() {
          dispatchCalls += 1;
          return {
            effectState: "APPLIED",
            confirmedEffect: { stableIds: [701], confirmedItems: 1 }
          };
        }
      }
    );

    await assert.rejects(() => boundary.execute("j1-boundary-001", "set-marker"));
    assert.equal(dispatchCalls, 0);
    assert.equal((await journal.load("j1-boundary-001"))?.revision, 0);

    const result = await boundary.execute("j1-boundary-001", "set-marker");
    assert.equal(authorityCalls, 2);
    assert.equal(dispatchCalls, 1);
    assert.equal(result.steps[0]?.effectState, "APPLIED");
  });
});

test("J1 synthetic update boundary checks cumulative budget before dispatch", async () => {
  await withJournal(async (journal) => {
    await journal.initialize(plan({ cost: 2, limit: 1 }));
    let dispatchCalls = 0;
    const boundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      { async currentAuthority() { return grantedAuthority(); } },
      { async observeCurrentState() { return { stateToken: "marker:before:v1" }; } },
      {
        async dispatch() {
          dispatchCalls += 1;
          return { effectState: "UNCERTAIN" };
        }
      }
    );

    await assert.rejects(
      () => boundary.execute("j1-boundary-001", "set-marker"),
      ExecutionBudgetExceededError
    );
    assert.equal(dispatchCalls, 0);
    const durable = await journal.load("j1-boundary-001");
    assert.equal(durable?.revision, 0);
    assert.deepEqual(durable?.budgets.records, { reserved: 0, consumed: 0 });
  });
});

test("J1 synthetic update boundary leaves durable RUNNING state when dispatch response is lost", async () => {
  await withJournal(async (journal) => {
    await journal.initialize(plan());
    const boundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      { async currentAuthority() { return grantedAuthority(); } },
      { async observeCurrentState() { return { stateToken: "marker:before:v1" }; } },
      {
        async dispatch() {
          throw new Error("simulated response loss after possible upstream effect");
        }
      }
    );

    await assert.rejects(() => boundary.execute("j1-boundary-001", "set-marker"));
    const running = await journal.load("j1-boundary-001");
    assert.equal(running?.status, "RUNNING");
    assert.equal(running?.steps[0]?.status, "RUNNING");
    assert.equal(running?.steps[0]?.effectState, "NOT_APPLIED");
    assert.deepEqual(running?.budgets.records, { reserved: 1, consumed: 0 });

    const recovered = await new ExecutionLifecycle(journal).recoverAfterRestart(
      "j1-boundary-001"
    );
    assert.equal(recovered.status, "SUSPENDED");
    assert.equal(recovered.steps[0]?.status, "SUSPENDED");
    assert.equal(recovered.steps[0]?.effectState, "UNCERTAIN");
    assert.deepEqual(recovered.budgets.records, { reserved: 1, consumed: 0 });
  });
});
