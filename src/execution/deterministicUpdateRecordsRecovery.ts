import {
  ExecutionJournalNotFoundError,
  type BudgetUsage,
  type ConfirmedEffectEvidence,
  type EffectIntentIdentity,
  type ExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type ExecutionStepState
} from "./executionJournal.js";

const BEFORE_STATE_TOKEN_KEY = "recovery.before";
const AFTER_STATE_TOKEN_KEY = "recovery.after";

export interface DeterministicUpdateRecoveryRequest {
  executionId: string;
  executionContractVersion: string;
  planId: string;
  planVersion: string;
  principalId: string;
  mandateVersion: string;
  target: string;
  stepId: string;
  operation: "update_records";
  effectIntent: EffectIntentIdentity;
  beforeStateToken: string;
  afterStateToken: string;
}

export interface DeterministicUpdateRecoveryObservation {
  /**
   * Canonical current token for the exact synthetic target. null means the
   * observer cannot prove either frozen state.
   */
  stateToken: string | null;
  /**
   * Stable effect evidence when the frozen postcondition is observed.
   * This must identify at least one confirmed effect before the engine can
   * convert UNCERTAIN into APPLIED.
   */
  confirmedEffect?: ConfirmedEffectEvidence;
}

export interface DeterministicUpdateRecoveryObserver {
  observeCurrentState(
    request: DeterministicUpdateRecoveryRequest
  ): Promise<DeterministicUpdateRecoveryObservation>;
}

export type DeterministicUpdateRecoveryDecision =
  | "EFFECT_CONFIRMED"
  | "SAFE_TO_RETRY"
  | "SUSPENDED";

export interface DeterministicUpdateRecoveryResult {
  decision: DeterministicUpdateRecoveryDecision;
  record: ExecutionJournalRecord;
}

export class DeterministicUpdateRecoveryStepNotFoundError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string
  ) {
    super(`Execution "${executionId}" has no step "${stepId}".`);
    this.name = "DeterministicUpdateRecoveryStepNotFoundError";
  }
}

export class DeterministicUpdateRecoveryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeterministicUpdateRecoveryInvariantError";
  }
}

function hasConfirmedEffect(evidence: ConfirmedEffectEvidence | undefined): boolean {
  return (
    evidence !== undefined &&
    (evidence.confirmedItems > 0 || evidence.stableIds.length > 0)
  );
}

function cloneConfirmedEffect(evidence: ConfirmedEffectEvidence): ConfirmedEffectEvidence {
  return {
    stableIds: [...evidence.stableIds],
    confirmedItems: evidence.confirmedItems
  };
}

function cloneBudgets(
  budgets: Readonly<Record<string, BudgetUsage>>
): Record<string, BudgetUsage> {
  return Object.fromEntries(
    Object.entries(budgets).map(([dimension, usage]) => [dimension, { ...usage }])
  );
}

function settleReservedBudget(
  record: ExecutionJournalRecord,
  stepIndex: number,
  applied: boolean
): Record<string, BudgetUsage> {
  const step = record.definition.steps[stepIndex]!;
  const budgets = cloneBudgets(record.budgets);

  for (const [dimension, amount] of Object.entries(step.budgetCost ?? {})) {
    const usage = budgets[dimension];
    if (usage === undefined || usage.reserved < amount) {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${record.definition.identity.executionId}" step "${step.stepId}" has no matching durable reservation for budget "${dimension}".`
      );
    }
    usage.reserved -= amount;
    if (applied) {
      const consumed = usage.consumed + amount;
      if (!Number.isSafeInteger(consumed)) {
        throw new DeterministicUpdateRecoveryInvariantError(
          `Execution "${record.definition.identity.executionId}" step "${step.stepId}" budget "${dimension}" exceeds the safe-integer range.`
        );
      }
      usage.consumed = consumed;
    }
  }

  return budgets;
}

function mutableState(record: ExecutionJournalRecord): ExecutionJournalMutableState {
  return {
    status: record.status,
    steps: structuredClone(record.steps),
    budgets: cloneBudgets(record.budgets),
    verificationEvidence: structuredClone(record.verificationEvidence)
  };
}

function pendingRetryState(step: ExecutionStepState): ExecutionStepState {
  return {
    stepId: step.stepId,
    status: "PENDING",
    effectState: "NOT_APPLIED",
    confirmedEffect: { stableIds: [], confirmedItems: 0 },
    verificationEvidenceIds: []
  };
}

/**
 * Capability-specific J1 recovery for one deterministic `update_records`
 * attempt in the isolated synthetic scenario.
 *
 * The immutable plan must carry two exact state tokens under
 * `recovery.before` and `recovery.after`. After restart has converted an
 * unresolved RUNNING step to SUSPENDED/UNCERTAIN, a trusted observer reads the
 * exact target and returns its current canonical token. The engine, not the
 * observer, compares that token with the frozen plan:
 *
 * - exact postcondition => durably resolve the effect as APPLIED, never replay;
 * - exact precondition => durably prove NOT_APPLIED and return to PENDING;
 * - anything else => remain SUSPENDED/UNCERTAIN.
 *
 * This class does not dispatch or retry an effect. A SAFE_TO_RETRY result only
 * restores the step to PENDING; a later effect boundary must still re-check
 * authority, preconditions and budget before crossing write-ahead again.
 */
export class DeterministicUpdateRecordsRecovery {
  constructor(
    private readonly journal: ExecutionJournal,
    private readonly observer: DeterministicUpdateRecoveryObserver
  ) {}

  async reconcile(
    executionId: string,
    stepId: string
  ): Promise<DeterministicUpdateRecoveryResult> {
    const current = await this.loadRequired(executionId);
    const stepIndex = current.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) {
      throw new DeterministicUpdateRecoveryStepNotFoundError(executionId, stepId);
    }

    const stateStep = current.steps[stepIndex]!;
    const definitionStep = current.definition.steps[stepIndex]!;
    if (
      current.status !== "SUSPENDED" ||
      stateStep.status !== "SUSPENDED" ||
      stateStep.effectState !== "UNCERTAIN" ||
      stateStep.preparedEffect === undefined
    ) {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${executionId}" step "${stepId}" must be durably SUSPENDED/UNCERTAIN with a prepared effect before reconciliation.`
      );
    }
    if (definitionStep.operation !== "update_records") {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${executionId}" step "${stepId}" is not the bounded update_records recovery capability.`
      );
    }
    if (hasConfirmedEffect(stateStep.confirmedEffect)) {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${executionId}" step "${stepId}" already retains confirmed effects and requires a different reconciliation contract.`
      );
    }
    if (stateStep.verificationEvidenceIds.length !== 0) {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${executionId}" step "${stepId}" has verification evidence before effect reconciliation.`
      );
    }

    for (let index = 0; index < current.steps.length; index += 1) {
      const other = current.steps[index]!;
      if (index < stepIndex && other.status !== "VERIFIED") {
        throw new DeterministicUpdateRecoveryInvariantError(
          `Execution "${executionId}" cannot reconcile step "${stepId}" while prior step "${other.stepId}" is ${other.status}.`
        );
      }
      if (index > stepIndex && other.status !== "PENDING") {
        throw new DeterministicUpdateRecoveryInvariantError(
          `Execution "${executionId}" cannot reconcile step "${stepId}" while later step "${other.stepId}" is ${other.status}.`
        );
      }
    }

    const beforeStateToken = definitionStep.expectedStateTokens[BEFORE_STATE_TOKEN_KEY];
    const afterStateToken = definitionStep.expectedStateTokens[AFTER_STATE_TOKEN_KEY];
    if (
      beforeStateToken === undefined ||
      afterStateToken === undefined ||
      beforeStateToken === afterStateToken
    ) {
      throw new DeterministicUpdateRecoveryInvariantError(
        `Execution "${executionId}" step "${stepId}" must freeze distinct recovery.before and recovery.after state tokens.`
      );
    }

    const identity = current.definition.identity;
    const observation = await this.observer.observeCurrentState({
      executionId: identity.executionId,
      executionContractVersion: identity.executionContractVersion,
      planId: identity.planId,
      planVersion: identity.planVersion,
      principalId: identity.principalId,
      mandateVersion: identity.mandateVersion,
      target: identity.target,
      stepId: definitionStep.stepId,
      operation: "update_records",
      effectIntent: {
        intentId: definitionStep.effectIntent!.intentId,
        fingerprint: definitionStep.effectIntent!.fingerprint
      },
      beforeStateToken,
      afterStateToken
    });

    if (observation.stateToken === afterStateToken) {
      if (!hasConfirmedEffect(observation.confirmedEffect)) {
        throw new DeterministicUpdateRecoveryInvariantError(
          `Execution "${executionId}" step "${stepId}" observed the frozen postcondition without stable confirmed-effect evidence.`
        );
      }
      const next = mutableState(current);
      next.status = "RUNNING";
      next.budgets = settleReservedBudget(current, stepIndex, true);
      next.steps = next.steps.map((candidate, index) =>
        index === stepIndex
          ? {
              ...candidate,
              status: "EFFECT_RECORDED" as const,
              effectState: "APPLIED" as const,
              confirmedEffect: cloneConfirmedEffect(observation.confirmedEffect!)
            }
          : candidate
      );
      return {
        decision: "EFFECT_CONFIRMED",
        record: await this.journal.compareAndSet(executionId, current.revision, next)
      };
    }

    if (observation.stateToken === beforeStateToken) {
      if (hasConfirmedEffect(observation.confirmedEffect)) {
        throw new DeterministicUpdateRecoveryInvariantError(
          `Execution "${executionId}" step "${stepId}" observed the frozen precondition while also claiming a confirmed effect.`
        );
      }
      const next = mutableState(current);
      next.budgets = settleReservedBudget(current, stepIndex, false);
      next.steps = next.steps.map((candidate, index) =>
        index === stepIndex ? pendingRetryState(candidate) : candidate
      );
      next.status = stepIndex === 0 ? "PENDING" : "RUNNING";
      return {
        decision: "SAFE_TO_RETRY",
        record: await this.journal.compareAndSet(executionId, current.revision, next)
      };
    }

    return { decision: "SUSPENDED", record: current };
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }
}
