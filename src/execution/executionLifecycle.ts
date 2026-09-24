import {
  ExecutionJournalNotFoundError,
  type ConfirmedEffectEvidence,
  type EffectIntentIdentity,
  type ExecutionEffectState,
  type ExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type ExecutionStepState
} from "./executionJournal.js";

export type RecordableEffectState = Exclude<ExecutionEffectState, "COMPENSATED">;

export interface RecordedEffectKnowledge {
  effectState: RecordableEffectState;
  confirmedEffect?: ConfirmedEffectEvidence;
}

export class ExecutionLifecycleInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionLifecycleInvariantError";
  }
}

export class ExecutionStepNotFoundError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string
  ) {
    super(`Execution "${executionId}" has no step "${stepId}".`);
    this.name = "ExecutionStepNotFoundError";
  }
}

export class ExecutionStepTransitionError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    message: string
  ) {
    super(`Execution "${executionId}" step "${stepId}": ${message}`);
    this.name = "ExecutionStepTransitionError";
  }
}

function mutableState(record: ExecutionJournalRecord): ExecutionJournalMutableState {
  return {
    status: record.status,
    steps: structuredClone(record.steps),
    budgets: structuredClone(record.budgets),
    verificationEvidence: structuredClone(record.verificationEvidence)
  };
}

function emptyConfirmedEffect(): ConfirmedEffectEvidence {
  return {
    stableIds: [],
    confirmedItems: 0
  };
}

function cloneConfirmedEffect(
  evidence: ConfirmedEffectEvidence | undefined
): ConfirmedEffectEvidence {
  if (evidence === undefined) return emptyConfirmedEffect();
  return {
    stableIds: [...evidence.stableIds],
    confirmedItems: evidence.confirmedItems
  };
}

function cloneEffectIntent(identity: EffectIntentIdentity): EffectIntentIdentity {
  return {
    intentId: identity.intentId,
    fingerprint: identity.fingerprint
  };
}

function hasConfirmedEffect(evidence: ConfirmedEffectEvidence): boolean {
  return evidence.confirmedItems > 0 || evidence.stableIds.length > 0;
}

/**
 * Small J1 lifecycle layer above the durable journal.
 *
 * This class deliberately does not dispatch Grist effects. prepareEffect()
 * establishes only the durable RUNNING write-ahead prerequisite, including a
 * bounded non-secret identity for the exact effect accepted into the immutable
 * plan. It is not a dispatch authorization: a future J1 coordinator must also
 * satisfy the frozen preconditions, cumulative budget check/reservation and
 * current authority / mandate re-check before any external effect is invoked.
 *
 * Recovery is intentionally pessimistic. After restart, a durable RUNNING step
 * without persisted result knowledge is converted to UNCERTAIN and the
 * execution is suspended. The prepared effect identity is retained so later
 * capability-specific reconciliation can reason about the exact intended
 * effect without reconstructing it from process memory. This layer never
 * guesses that the effect was absent and never replays it automatically.
 */
export class ExecutionLifecycle {
  constructor(private readonly journal: ExecutionJournal) {}

  async prepareEffect(
    executionId: string,
    stepId: string
  ): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const stepIndex = this.stepIndex(current, stepId);
    const step = current.steps[stepIndex]!;
    const definitionStep = current.definition.steps[stepIndex]!;

    if (current.status === "SUSPENDED" || current.status === "COMPLETED") {
      throw new ExecutionStepTransitionError(
        executionId,
        stepId,
        `cannot start while execution is ${current.status}.`
      );
    }
    if (step.status !== "PENDING") {
      throw new ExecutionStepTransitionError(
        executionId,
        stepId,
        `expected PENDING, found ${step.status}.`
      );
    }
    if (definitionStep.effectIntent === undefined) {
      throw new ExecutionLifecycleInvariantError(
        `Effectful step "${stepId}" has no immutable effect intent identity.`
      );
    }
    if (step.preparedEffect !== undefined) {
      throw new ExecutionLifecycleInvariantError(
        `Pending step "${stepId}" already contains a prepared effect identity.`
      );
    }
    if (step.effectState !== "NOT_APPLIED" || hasConfirmedEffect(step.confirmedEffect)) {
      throw new ExecutionLifecycleInvariantError(
        `Pending step "${stepId}" contains effect knowledge and cannot cross the write-ahead barrier.`
      );
    }
    if (step.verificationEvidenceIds.length !== 0) {
      throw new ExecutionLifecycleInvariantError(
        `Pending step "${stepId}" already references verification evidence.`
      );
    }

    for (let index = 0; index < current.steps.length; index += 1) {
      const other = current.steps[index]!;
      if (index < stepIndex && other.status !== "VERIFIED") {
        throw new ExecutionStepTransitionError(
          executionId,
          stepId,
          `prior step "${other.stepId}" is ${other.status}, not VERIFIED.`
        );
      }
      if (index !== stepIndex && other.status === "RUNNING") {
        throw new ExecutionLifecycleInvariantError(
          `Execution "${executionId}" already contains RUNNING step "${other.stepId}".`
        );
      }
    }

    const next = mutableState(current);
    next.status = "RUNNING";
    next.steps = next.steps.map((candidate, index) =>
      index === stepIndex
        ? {
            ...candidate,
            status: "RUNNING",
            effectState: "NOT_APPLIED",
            confirmedEffect: emptyConfirmedEffect(),
            verificationEvidenceIds: [],
            preparedEffect: cloneEffectIntent(definitionStep.effectIntent!)
          }
        : candidate
    );

    return this.journal.compareAndSet(executionId, current.revision, next);
  }

  async recordEffect(
    executionId: string,
    stepId: string,
    knowledge: RecordedEffectKnowledge
  ): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const stepIndex = this.stepIndex(current, stepId);
    const step = current.steps[stepIndex]!;

    if (step.status !== "RUNNING") {
      throw new ExecutionStepTransitionError(
        executionId,
        stepId,
        `effect knowledge may only be recorded from RUNNING, found ${step.status}.`
      );
    }
    if (step.preparedEffect === undefined) {
      throw new ExecutionLifecycleInvariantError(
        `RUNNING step "${stepId}" has no durable prepared effect identity.`
      );
    }

    const confirmedEffect = cloneConfirmedEffect(knowledge.confirmedEffect);
    if (knowledge.effectState === "NOT_APPLIED" && hasConfirmedEffect(confirmedEffect)) {
      throw new ExecutionLifecycleInvariantError(
        `Step "${stepId}" cannot be NOT_APPLIED while retaining confirmed effects.`
      );
    }
    if (
      knowledge.effectState === "PARTIALLY_APPLIED" &&
      !hasConfirmedEffect(confirmedEffect)
    ) {
      throw new ExecutionLifecycleInvariantError(
        `Step "${stepId}" cannot be PARTIALLY_APPLIED without a confirmed partial effect.`
      );
    }

    const mustSuspend =
      knowledge.effectState === "UNCERTAIN" ||
      knowledge.effectState === "PARTIALLY_APPLIED";
    const next = mutableState(current);
    next.status = mustSuspend ? "SUSPENDED" : "RUNNING";
    next.steps = next.steps.map((candidate, index) =>
      index === stepIndex
        ? {
            ...candidate,
            status: mustSuspend ? "SUSPENDED" : "EFFECT_RECORDED",
            effectState: knowledge.effectState,
            confirmedEffect
          }
        : candidate
    );

    return this.journal.compareAndSet(executionId, current.revision, next);
  }

  async recoverAfterRestart(executionId: string): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const runningIndexes = current.steps
      .map((step, index) => (step.status === "RUNNING" ? index : -1))
      .filter((index) => index >= 0);

    if (runningIndexes.length === 0) return current;

    const runningSet = new Set(runningIndexes);
    const next = mutableState(current);
    next.status = "SUSPENDED";
    next.steps = next.steps.map((step, index) =>
      runningSet.has(index)
        ? {
            ...step,
            status: "SUSPENDED",
            effectState: "UNCERTAIN"
          }
        : step
    );

    return this.journal.compareAndSet(executionId, current.revision, next);
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }

  private stepIndex(record: ExecutionJournalRecord, stepId: string): number {
    const index = record.steps.findIndex((step) => step.stepId === stepId);
    if (index < 0) {
      throw new ExecutionStepNotFoundError(record.definition.identity.executionId, stepId);
    }
    return index;
  }
}

export function isUnresolvedRunningStep(step: ExecutionStepState): boolean {
  return step.status === "RUNNING";
}
