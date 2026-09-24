import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DeterministicUpdateRecordsRecovery } from "../src/execution/deterministicUpdateRecordsRecovery.js";
import type { ExecutionAuthorityRequest } from "../src/execution/executionAuthority.js";
import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import {
  ExecutionBudgetExceededError,
  ExecutionLifecycle
} from "../src/execution/executionLifecycle.js";
import {
  SyntheticUpdatePreconditionFailedError,
  SyntheticUpdateRecordsEffectBoundary,
  type SyntheticUpdateDispatchRequest
} from "../src/execution/syntheticUpdateRecordsEffectBoundary.js";
import { VerificationEvidenceLifecycle } from "../src/execution/verificationEvidenceLifecycle.js";
import {
  FileVerificationContractStore,
  VerificationCompletionLifecycle,
  VerificationRequirementNotMetError,
  type ExecutionVerificationContractDefinition
} from "../src/execution/verificationCompletion.js";

const EXECUTION_ID = "j1-integrated-synthetic-001";
const STEP_A = "set-phase-a";
const STEP_B = "set-phase-b";
const TOKEN_0 = "fixture:phase-0:v1";
const TOKEN_1 = "fixture:phase-1:v1";
const TOKEN_2 = "fixture:phase-2:v1";

function plan(options: { budgetLimit?: number } = {}): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: EXECUTION_ID,
      executionContractVersion: "contract-v1",
      planId: "integrated-synthetic-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-integrated-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: STEP_A,
        order: 1,
        operation: "update_records",
        capability: "doc:write",
        preconditions: ["synthetic fixture is still at phase 0"],
        expectedStateTokens: {
          "precondition.current": TOKEN_0,
          "recovery.before": TOKEN_0,
          "recovery.after": TOKEN_1
        },
        effectIntent: {
          intentId: "set-phase-a-once",
          fingerprint: "integrated-phase-a-v1"
        },
        budgetCost: { records: 1 }
      },
      {
        stepId: STEP_B,
        order: 2,
        operation: "update_records",
        capability: "doc:write",
        preconditions: ["synthetic fixture is still at phase 1"],
        expectedStateTokens: {
          "precondition.current": TOKEN_1,
          "recovery.before": TOKEN_1,
          "recovery.after": TOKEN_2
        },
        effectIntent: {
          intentId: "set-phase-b-once",
          fingerprint: "integrated-phase-b-v1"
        },
        budgetCost: { records: 1 }
      }
    ],
    budgetLimits: { records: options.budgetLimit ?? 2 },
    criticalProperties: [
      { propertyId: "phase-a-applied", criticality: "CRITICAL" },
      { propertyId: "phase-b-applied", criticality: "CRITICAL" }
    ]
  };
}

function verificationContract(
  definition: ExecutionPlanDefinition
): ExecutionVerificationContractDefinition {
  return {
    identity: structuredClone(definition.identity),
    steps: [
      { stepId: STEP_A, requiredPropertyIds: ["phase-a-applied"] },
      { stepId: STEP_B, requiredPropertyIds: ["phase-b-applied"] }
    ]
  };
}

class SyntheticFixture {
  private token = TOKEN_0;
  readonly appliedEffects: string[] = [];

  currentToken(): string {
    return this.token;
  }

  forceToken(token: string): void {
    this.token = token;
  }

  confirmedEffect(stepId: string): { stableIds: number[]; confirmedItems: number } | undefined {
    if (!this.appliedEffects.includes(stepId)) return undefined;
    return {
      stableIds: [stepId === STEP_A ? 701 : 702],
      confirmedItems: 1
    };
  }

  apply(stepId: string) {
    if (stepId === STEP_A) {
      assert.equal(this.token, TOKEN_0, "phase A must start from its frozen precondition");
      this.token = TOKEN_1;
    } else if (stepId === STEP_B) {
      assert.equal(this.token, TOKEN_1, "phase B must start from its frozen precondition");
      this.token = TOKEN_2;
    } else {
      throw new Error(`Unsupported synthetic step ${stepId}`);
    }
    this.appliedEffects.push(stepId);
    return {
      effectState: "APPLIED" as const,
      confirmedEffect: this.confirmedEffect(stepId)!
    };
  }
}

interface ScenarioEnvironment {
  journalDirectory: string;
  contractDirectory: string;
  definition: ExecutionPlanDefinition;
  fixture: SyntheticFixture;
  authorityCalls: string[];
}

async function withScenario(
  options: { budgetLimit?: number } | undefined,
  run: (environment: ScenarioEnvironment) => Promise<void>
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-integrated-"));
  try {
    const journalDirectory = join(root, "journal");
    const contractDirectory = join(root, "contracts");
    const definition = plan(options);
    const journal = new FileExecutionJournal(journalDirectory);
    const initial = await journal.initialize(definition);
    await new FileVerificationContractStore(contractDirectory, journal).initialize(
      initial,
      verificationContract(definition)
    );
    await run({
      journalDirectory,
      contractDirectory,
      definition,
      fixture: new SyntheticFixture(),
      authorityCalls: []
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function boundary(
  journal: FileExecutionJournal,
  fixture: SyntheticFixture,
  authorityCalls: string[],
  dispatch: (request: SyntheticUpdateDispatchRequest) => Promise<ReturnType<SyntheticFixture["apply"]>> =
    async (request) => fixture.apply(request.stepId)
): SyntheticUpdateRecordsEffectBoundary {
  return new SyntheticUpdateRecordsEffectBoundary(
    journal,
    {
      async currentAuthority(request: ExecutionAuthorityRequest) {
        authorityCalls.push(request.stepId);
        return {
          principalId: "principal-j1",
          mandateVersion: "mandate-v1",
          target: "doc-j1-integrated-fixture",
          capabilities: ["doc:write"]
        };
      }
    },
    {
      async observeCurrentState() {
        return { stateToken: fixture.currentToken() };
      }
    },
    { dispatch }
  );
}

function recovery(
  journal: FileExecutionJournal,
  fixture: SyntheticFixture
): DeterministicUpdateRecordsRecovery {
  return new DeterministicUpdateRecordsRecovery(journal, {
    async observeCurrentState(request) {
      return {
        stateToken: fixture.currentToken(),
        ...(fixture.currentToken() === request.afterStateToken
          ? { confirmedEffect: fixture.confirmedEffect(request.stepId) }
          : {})
      };
    }
  });
}

function propertyFor(stepId: string): string {
  if (stepId === STEP_A) return "phase-a-applied";
  if (stepId === STEP_B) return "phase-b-applied";
  throw new Error(`Unknown step ${stepId}`);
}

async function verifyStep(
  journal: FileExecutionJournal,
  contractDirectory: string,
  fixture: SyntheticFixture,
  stepId: string,
  evidenceId: string
) {
  await new VerificationEvidenceLifecycle(journal).recordEvidence(EXECUTION_ID, stepId, {
    evidenceId,
    propertyId: propertyFor(stepId),
    verdict: "VERIFIED",
    method: "exact synthetic fixture state observation",
    targetStateToken: fixture.currentToken(),
    dependencies: [`fixture-state:${fixture.currentToken()}`]
  });
  return new VerificationCompletionLifecycle(
    journal,
    new FileVerificationContractStore(contractDirectory, journal)
  ).markStepVerified(EXECUTION_ID, stepId);
}

async function completeNormally(environment: ScenarioEnvironment): Promise<void> {
  const journal = new FileExecutionJournal(environment.journalDirectory);
  const effectBoundary = boundary(
    journal,
    environment.fixture,
    environment.authorityCalls
  );
  await effectBoundary.execute(EXECUTION_ID, STEP_A);
  await verifyStep(
    journal,
    environment.contractDirectory,
    environment.fixture,
    STEP_A,
    "evidence-phase-a"
  );
  await effectBoundary.execute(EXECUTION_ID, STEP_B);
  await verifyStep(
    journal,
    environment.contractDirectory,
    environment.fixture,
    STEP_B,
    "evidence-phase-b"
  );
}

test("J1 integrated transformation completes two bounded steps and a repeated completed intent causes no duplicate effect", async () => {
  await withScenario(undefined, async (environment) => {
    await completeNormally(environment);

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    const completed = await restarted.initialize(environment.definition);
    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(
      completed.steps.map((step) => ({
        stepId: step.stepId,
        status: step.status,
        effectState: step.effectState,
        stableIds: step.confirmedEffect.stableIds
      })),
      [
        { stepId: STEP_A, status: "VERIFIED", effectState: "APPLIED", stableIds: [701] },
        { stepId: STEP_B, status: "VERIFIED", effectState: "APPLIED", stableIds: [702] }
      ]
    );
    assert.deepEqual(completed.budgets.records, { reserved: 0, consumed: 2 });
    assert.equal(completed.verificationEvidence.length, 2);
    assert.deepEqual(environment.authorityCalls, [STEP_A, STEP_B]);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);

    await assert.rejects(
      () =>
        boundary(
          restarted,
          environment.fixture,
          environment.authorityCalls
        ).execute(EXECUTION_ID, STEP_A),
      SyntheticUpdatePreconditionFailedError
    );
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 crash before dispatch leaves pristine durable state and restart re-resolves authority", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    let dispatcherCalls = 0;
    const crashingBoundary = new SyntheticUpdateRecordsEffectBoundary(
      journal,
      {
        async currentAuthority(request) {
          environment.authorityCalls.push(request.stepId);
          return {
            principalId: "principal-j1",
            mandateVersion: "mandate-v1",
            target: "doc-j1-integrated-fixture",
            capabilities: ["doc:write"]
          };
        }
      },
      {
        async observeCurrentState() {
          throw new Error("simulated process stop before effect dispatch");
        }
      },
      {
        async dispatch() {
          dispatcherCalls += 1;
          return environment.fixture.apply(STEP_A);
        }
      }
    );

    await assert.rejects(() => crashingBoundary.execute(EXECUTION_ID, STEP_A));
    const pristine = await journal.load(EXECUTION_ID);
    assert.equal(pristine?.revision, 0);
    assert.equal(pristine?.status, "PENDING");
    assert.equal(dispatcherCalls, 0);
    assert.deepEqual(environment.authorityCalls, []);

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    const resumedBoundary = boundary(
      restarted,
      environment.fixture,
      environment.authorityCalls
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_A);
    await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-after-pre-dispatch-restart"
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_B);
    const completed = await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_B,
      "evidence-after-pre-dispatch-restart-b"
    );

    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(environment.authorityCalls, [STEP_A, STEP_B]);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 crash after durable write-ahead but before upstream effect is safely reconciled and retried", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    let adapterAttempts = 0;
    const beforeEffectCrash = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls,
      async () => {
        adapterAttempts += 1;
        throw new Error("simulated stop after write-ahead before synthetic upstream effect");
      }
    );

    await assert.rejects(() => beforeEffectCrash.execute(EXECUTION_ID, STEP_A));
    const running = await journal.load(EXECUTION_ID);
    assert.equal(running?.steps[0]?.status, "RUNNING");
    assert.equal(running?.steps[0]?.effectState, "NOT_APPLIED");
    assert.deepEqual(running?.budgets.records, { reserved: 1, consumed: 0 });
    assert.deepEqual(environment.fixture.appliedEffects, []);

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    const uncertain = await new ExecutionLifecycle(restarted).recoverAfterRestart(EXECUTION_ID);
    assert.equal(uncertain.status, "SUSPENDED");
    assert.equal(uncertain.steps[0]?.effectState, "UNCERTAIN");

    const reconciled = await recovery(restarted, environment.fixture).reconcile(
      EXECUTION_ID,
      STEP_A
    );
    assert.equal(reconciled.decision, "SAFE_TO_RETRY");
    assert.equal(reconciled.record.steps[0]?.status, "PENDING");
    assert.deepEqual(reconciled.record.budgets.records, { reserved: 0, consumed: 0 });

    const resumedBoundary = boundary(
      restarted,
      environment.fixture,
      environment.authorityCalls
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_A);
    await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-after-safe-retry-a"
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_B);
    const completed = await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_B,
      "evidence-after-safe-retry-b"
    );

    assert.equal(adapterAttempts, 1);
    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(environment.authorityCalls, [STEP_A, STEP_A, STEP_B]);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 crash after upstream effect but before result persistence becomes UNCERTAIN and converges without duplicate effect", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    const normalBoundary = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls
    );
    await normalBoundary.execute(EXECUTION_ID, STEP_A);
    await verifyStep(
      journal,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-before-lost-result"
    );

    let stepBDispatches = 0;
    const responseLossBoundary = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls,
      async (request) => {
        stepBDispatches += 1;
        environment.fixture.apply(request.stepId);
        throw new Error("simulated response loss after synthetic upstream effect");
      }
    );
    await assert.rejects(() => responseLossBoundary.execute(EXECUTION_ID, STEP_B));

    const durableBeforeRestart = await journal.load(EXECUTION_ID);
    assert.equal(durableBeforeRestart?.steps[0]?.status, "VERIFIED");
    assert.deepEqual(durableBeforeRestart?.steps[0]?.confirmedEffect.stableIds, [701]);
    assert.equal(durableBeforeRestart?.steps[1]?.status, "RUNNING");
    assert.deepEqual(durableBeforeRestart?.budgets.records, { reserved: 1, consumed: 1 });

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    const uncertain = await new ExecutionLifecycle(restarted).recoverAfterRestart(EXECUTION_ID);
    assert.equal(uncertain.steps[1]?.status, "SUSPENDED");
    assert.equal(uncertain.steps[1]?.effectState, "UNCERTAIN");
    assert.deepEqual(uncertain.steps[0]?.confirmedEffect.stableIds, [701]);

    const reconciled = await recovery(restarted, environment.fixture).reconcile(
      EXECUTION_ID,
      STEP_B
    );
    assert.equal(reconciled.decision, "EFFECT_CONFIRMED");
    assert.equal(reconciled.record.steps[1]?.status, "EFFECT_RECORDED");
    assert.deepEqual(reconciled.record.steps[1]?.confirmedEffect.stableIds, [702]);
    assert.deepEqual(reconciled.record.budgets.records, { reserved: 0, consumed: 2 });

    const completed = await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_B,
      "evidence-after-lost-result-recovery"
    );
    assert.equal(completed.status, "COMPLETED");
    assert.equal(stepBDispatches, 1);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 crash after result persistence but before verification resumes only from durable effect knowledge", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    await boundary(journal, environment.fixture, environment.authorityCalls).execute(
      EXECUTION_ID,
      STEP_A
    );
    const persisted = await journal.load(EXECUTION_ID);
    assert.equal(persisted?.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(persisted?.steps[0]?.effectState, "APPLIED");
    assert.deepEqual(persisted?.steps[0]?.confirmedEffect.stableIds, [701]);
    assert.equal(persisted?.steps[0]?.verificationEvidenceIds.length, 0);

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-after-result-persisted-restart"
    );
    const resumedBoundary = boundary(
      restarted,
      environment.fixture,
      environment.authorityCalls
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_B);
    const completed = await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_B,
      "evidence-after-result-persisted-restart-b"
    );

    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
    assert.deepEqual(environment.authorityCalls, [STEP_A, STEP_B]);
  });
});

test("J1 crash during verification preserves UNKNOWN evidence and latest durable verdict governs completion", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    const effectBoundary = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls
    );
    await effectBoundary.execute(EXECUTION_ID, STEP_A);

    await new VerificationEvidenceLifecycle(journal).recordEvidence(EXECUTION_ID, STEP_A, {
      evidenceId: "evidence-phase-a-interrupted",
      propertyId: "phase-a-applied",
      verdict: "UNKNOWN",
      method: "synthetic verification interrupted after durable observation",
      targetStateToken: environment.fixture.currentToken(),
      dependencies: ["fixture-verification:interrupted"]
    });

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    const restartedCompletion = new VerificationCompletionLifecycle(
      restarted,
      new FileVerificationContractStore(environment.contractDirectory, restarted)
    );
    await assert.rejects(
      () => restartedCompletion.markStepVerified(EXECUTION_ID, STEP_A),
      (error: unknown) => {
        assert.ok(error instanceof VerificationRequirementNotMetError);
        assert.equal(error.propertyId, "phase-a-applied");
        assert.equal(error.verdict, "UNKNOWN");
        return true;
      }
    );

    await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-phase-a-reverified"
    );
    const resumedBoundary = boundary(
      restarted,
      environment.fixture,
      environment.authorityCalls
    );
    await resumedBoundary.execute(EXECUTION_ID, STEP_B);
    const completed = await verifyStep(
      restarted,
      environment.contractDirectory,
      environment.fixture,
      STEP_B,
      "evidence-phase-b-after-verification-restart"
    );

    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(completed.steps[0]?.verificationEvidenceIds, [
      "evidence-phase-a-interrupted",
      "evidence-phase-a-reverified"
    ]);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 observational ambiguity remains durably suspended and is never replayed", async () => {
  await withScenario(undefined, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    const normalBoundary = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls
    );
    await normalBoundary.execute(EXECUTION_ID, STEP_A);
    await verifyStep(
      journal,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-before-ambiguous-second-step"
    );

    let stepBDispatches = 0;
    const lostResponse = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls,
      async (request) => {
        stepBDispatches += 1;
        environment.fixture.apply(request.stepId);
        throw new Error("simulated response loss before an independent divergent change");
      }
    );
    await assert.rejects(() => lostResponse.execute(EXECUTION_ID, STEP_B));
    environment.fixture.forceToken("fixture:independent-divergence:v2");

    const restarted = new FileExecutionJournal(environment.journalDirectory);
    await new ExecutionLifecycle(restarted).recoverAfterRestart(EXECUTION_ID);
    const reconciled = await recovery(restarted, environment.fixture).reconcile(
      EXECUTION_ID,
      STEP_B
    );

    assert.equal(reconciled.decision, "SUSPENDED");
    assert.equal(reconciled.record.status, "SUSPENDED");
    assert.equal(reconciled.record.steps[0]?.status, "VERIFIED");
    assert.equal(reconciled.record.steps[1]?.effectState, "UNCERTAIN");
    assert.deepEqual(reconciled.record.budgets.records, { reserved: 1, consumed: 1 });
    assert.equal(stepBDispatches, 1);
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A, STEP_B]);
  });
});

test("J1 cumulative plan budget blocks a later bounded step instead of allowing split-call evasion", async () => {
  await withScenario({ budgetLimit: 1 }, async (environment) => {
    const journal = new FileExecutionJournal(environment.journalDirectory);
    const effectBoundary = boundary(
      journal,
      environment.fixture,
      environment.authorityCalls
    );
    await effectBoundary.execute(EXECUTION_ID, STEP_A);
    await verifyStep(
      journal,
      environment.contractDirectory,
      environment.fixture,
      STEP_A,
      "evidence-before-budget-refusal"
    );

    await assert.rejects(
      () => effectBoundary.execute(EXECUTION_ID, STEP_B),
      ExecutionBudgetExceededError
    );
    const durable = await journal.load(EXECUTION_ID);
    assert.equal(durable?.status, "RUNNING");
    assert.equal(durable?.steps[0]?.status, "VERIFIED");
    assert.equal(durable?.steps[1]?.status, "PENDING");
    assert.deepEqual(durable?.budgets.records, { reserved: 0, consumed: 1 });
    assert.deepEqual(environment.fixture.appliedEffects, [STEP_A]);
    assert.deepEqual(environment.authorityCalls, [STEP_A, STEP_B]);
  });
});