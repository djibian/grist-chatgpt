import {
  ExecutionJournalNotFoundError,
  ExecutionJournalRevisionError,
  type ExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type ExecutionStepState,
  type VerificationEvidenceRecord,
  type VerificationVerdict
} from "./executionJournal.js";

export interface VerificationObservation {
  evidenceId: string;
  propertyId: string;
  verdict: VerificationVerdict;
  method: string;
  targetStateToken?: string;
  dependencies: readonly string[];
}

export interface VerificationEvidenceLifecycleOptions {
  now?: () => Date;
}

export class VerificationStepNotFoundError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string
  ) {
    super(`Execution "${executionId}" has no step "${stepId}".`);
    this.name = "VerificationStepNotFoundError";
  }
}

export class VerificationPropertyNotFoundError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly propertyId: string
  ) {
    super(`Execution "${executionId}" has no critical property "${propertyId}".`);
    this.name = "VerificationPropertyNotFoundError";
  }
}

export class VerificationTransitionError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    message: string
  ) {
    super(`Execution "${executionId}" step "${stepId}": ${message}`);
    this.name = "VerificationTransitionError";
  }
}

export class VerificationEvidenceConflictError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly evidenceId: string
  ) {
    super(
      `Execution "${executionId}" already contains verification evidence "${evidenceId}" with different contextual content or linkage.`
    );
    this.name = "VerificationEvidenceConflictError";
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

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameObservation(
  existing: VerificationEvidenceRecord,
  observation: VerificationObservation
): boolean {
  return (
    existing.propertyId === observation.propertyId &&
    existing.verdict === observation.verdict &&
    existing.method === observation.method &&
    existing.targetStateToken === observation.targetStateToken &&
    sameStrings(existing.dependencies, observation.dependencies)
  );
}

function existingReplay(
  record: ExecutionJournalRecord,
  step: ExecutionStepState,
  observation: VerificationObservation
): ExecutionJournalRecord | null {
  const existing = record.verificationEvidence.find(
    (candidate) => candidate.evidenceId === observation.evidenceId
  );
  if (!existing) return null;

  const linkedToStep = step.verificationEvidenceIds.includes(observation.evidenceId);
  if (linkedToStep && sameObservation(existing, observation)) return record;
  throw new VerificationEvidenceConflictError(
    record.definition.identity.executionId,
    observation.evidenceId
  );
}

/**
 * Executable J1 boundary for durable contextual verification evidence.
 *
 * Evidence is append-only: a later observation receives a new evidenceId rather
 * than mutating an earlier verdict. Replaying the same evidenceId with the same
 * contextual observation is idempotent, including a concurrent retry that
 * loses the journal CAS after another caller persisted the same observation.
 * Reusing an evidenceId for different content fails closed.
 *
 * This slice deliberately does not turn one evidence record into a global
 * success flag and does not mark a step VERIFIED. The immutable plan currently
 * defines critical properties globally but does not yet bind a required
 * property set to each step. Inventing that binding at runtime would let a
 * caller weaken required verification. A later contractual slice must add or
 * otherwise freeze that binding before step-completion semantics are exposed.
 */
export class VerificationEvidenceLifecycle {
  private readonly now: () => Date;

  constructor(
    private readonly journal: ExecutionJournal,
    options: VerificationEvidenceLifecycleOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async recordEvidence(
    executionId: string,
    stepId: string,
    observation: VerificationObservation
  ): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const stepIndex = current.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) throw new VerificationStepNotFoundError(executionId, stepId);

    const step = current.steps[stepIndex]!;
    const property = current.definition.criticalProperties.find(
      (candidate) => candidate.propertyId === observation.propertyId
    );
    if (!property) {
      throw new VerificationPropertyNotFoundError(executionId, observation.propertyId);
    }

    const replay = existingReplay(current, step, observation);
    if (replay) return replay;

    if (current.status === "COMPLETED") {
      throw new VerificationTransitionError(
        executionId,
        stepId,
        "cannot append verification evidence after execution completion."
      );
    }
    if (step.status !== "EFFECT_RECORDED") {
      throw new VerificationTransitionError(
        executionId,
        stepId,
        `contextual verification requires EFFECT_RECORDED, found ${step.status}.`
      );
    }

    const evidence: VerificationEvidenceRecord = {
      evidenceId: observation.evidenceId,
      propertyId: property.propertyId,
      criticality: property.criticality,
      verdict: observation.verdict,
      executionId: current.definition.identity.executionId,
      planVersion: current.definition.identity.planVersion,
      principalId: current.definition.identity.principalId,
      method: observation.method,
      timestamp: this.now().toISOString(),
      ...(observation.targetStateToken === undefined
        ? {}
        : { targetStateToken: observation.targetStateToken }),
      dependencies: [...observation.dependencies]
    };

    const next = mutableState(current);
    next.verificationEvidence = [...next.verificationEvidence, evidence];
    next.steps = next.steps.map((candidate, index) =>
      index === stepIndex
        ? {
            ...candidate,
            verificationEvidenceIds: [
              ...candidate.verificationEvidenceIds,
              observation.evidenceId
            ]
          }
        : candidate
    );

    try {
      return await this.journal.compareAndSet(executionId, current.revision, next);
    } catch (error) {
      if (!(error instanceof ExecutionJournalRevisionError)) throw error;

      const reloaded = await this.loadRequired(executionId);
      const reloadedStep = reloaded.steps.find((candidate) => candidate.stepId === stepId);
      if (!reloadedStep) throw new VerificationStepNotFoundError(executionId, stepId);
      const concurrentReplay = existingReplay(reloaded, reloadedStep, observation);
      if (concurrentReplay) return concurrentReplay;
      throw error;
    }
  }

  async latestEvidence(
    executionId: string,
    stepId: string,
    propertyId: string
  ): Promise<VerificationEvidenceRecord | null> {
    const current = await this.loadRequired(executionId);
    const step = current.steps.find((candidate) => candidate.stepId === stepId);
    if (!step) throw new VerificationStepNotFoundError(executionId, stepId);
    if (!current.definition.criticalProperties.some((property) => property.propertyId === propertyId)) {
      throw new VerificationPropertyNotFoundError(executionId, propertyId);
    }

    const evidenceById = new Map(
      current.verificationEvidence.map((evidence) => [evidence.evidenceId, evidence])
    );
    for (let index = step.verificationEvidenceIds.length - 1; index >= 0; index -= 1) {
      const evidence = evidenceById.get(step.verificationEvidenceIds[index]!);
      if (evidence?.propertyId === propertyId) return structuredClone(evidence);
    }
    return null;
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }
}
