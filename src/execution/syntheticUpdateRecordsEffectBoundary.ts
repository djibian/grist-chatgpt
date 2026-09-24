import {
  ExecutionAuthorityGate,
  type ExecutionAuthorityProvider
} from "./executionAuthority.js";
import {
  ExecutionJournalNotFoundError,
  type ConfirmedEffectEvidence,
  type EffectIntentIdentity,
  type ExecutionJournal,
  type ExecutionJournalRecord,
  type PlannedExecutionStep
} from "./executionJournal.js";
import {
  ExecutionLifecycle,
  type RecordedEffectKnowledge
} from "./executionLifecycle.js";

const PRECONDITION_STATE_TOKEN_KEY = "precondition.current";

export interface SyntheticUpdatePreconditionRequest {
  executionId: string;
  executionContractVersion: string;
  planId: string;
  planVersion: string;
  principalId: string;
  mandateVersion: string;
  target: string;
  stepId: string;
  operation: "update_records";
  capability: string;
  preconditions: readonly string[];
  expectedStateToken: string;
}

export interface SyntheticUpdatePreconditionObservation {
  stateToken: string | null;
}

export interface SyntheticUpdatePreconditionObserver {
  observeCurrentState(
    request: SyntheticUpdatePreconditionRequest
  ): Promise<SyntheticUpdatePreconditionObservation>;
}

export interface SyntheticUpdateDispatchRequest {
  executionId: string;
  executionContractVersion: string;
  planId: string;
  planVersion: string;
  principalId: string;
  mandateVersion: string;
  target: string;
  stepId: string;
  operation: "update_records";
  capability: string;
  effectIntent: EffectIntentIdentity;
  journalRevision: number;
}

export type SyntheticUpdateDispatchKnowledge = {
  effectState: "APPLIED" | "PARTIALLY_APPLIED" | "UNCERTAIN";
  confirmedEffect?: ConfirmedEffectEvidence;
};

export interface SyntheticUpdateDispatcher {
  dispatch(
    request: SyntheticUpdateDispatchRequest
  ): Promise<SyntheticUpdateDispatchKnowledge>;
}

export class SyntheticUpdateEffectBoundaryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyntheticUpdateEffectBoundaryInvariantError";
  }
}

export class SyntheticUpdatePreconditionFailedError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    public readonly expectedStateToken: string,
    public readonly observedStateToken: string | null
  ) {
    super(
      `Execution "${executionId}" step "${stepId}" failed its frozen synthetic precondition.`
    );
    this.name = "SyntheticUpdatePreconditionFailedError";
  }
}

function effectRequest(
  record: ExecutionJournalRecord,
  step: PlannedExecutionStep
): SyntheticUpdateDispatchRequest {
  const identity = record.definition.identity;
  if (step.effectIntent === undefined) {
    throw new SyntheticUpdateEffectBoundaryInvariantError(
      `Execution "${identity.executionId}" step "${step.stepId}" has no immutable effect intent.`
    );
  }
  return {
    executionId: identity.executionId,
    executionContractVersion: identity.executionContractVersion,
    planId: identity.planId,
    planVersion: identity.planVersion,
    principalId: identity.principalId,
    mandateVersion: identity.mandateVersion,
    target: identity.target,
    stepId: step.stepId,
    operation: "update_records",
    capability: step.capability,
    effectIntent: {
      intentId: step.effectIntent.intentId,
      fingerprint: step.effectIntent.fingerprint
    },
    journalRevision: record.revision
  };
}

function preconditionRequest(
  record: ExecutionJournalRecord,
  step: PlannedExecutionStep,
  expectedStateToken: string
): SyntheticUpdatePreconditionRequest {
  const identity = record.definition.identity;
  return {
    executionId: identity.executionId,
    executionContractVersion: identity.executionContractVersion,
    planId: identity.planId,
    planVersion: identity.planVersion,
    principalId: identity.principalId,
    mandateVersion: identity.mandateVersion,
    target: identity.target,
    stepId: step.stepId,
    operation: "update_records",
    capability: step.capability,
    preconditions: [...step.preconditions],
    expectedStateToken
  };
}

/**
 * Controlled-environment effect boundary for the first deterministic J1
 * `update_records` scenario.
 *
 * The boundary performs, in order:
 * 1. one fresh exact-state precondition observation against the immutable plan;
 * 2. one fresh current-authority check through ExecutionAuthorityGate;
 * 3. cumulative-budget admission plus durable RUNNING write-ahead preparation;
 * 4. dispatch through a preconfigured synthetic update adapter identified only
 *    by immutable execution/effect identity;
 * 5. durable effect-knowledge recording.
 *
 * It intentionally does not implement a public/generic dispatcher. The
 * precondition guarantee is only valid in the isolated/coordinated synthetic
 * environment used by J1; it is not a protected multi-writer concurrency
 * mechanism. If dispatch throws after write-ahead, the step remains RUNNING so
 * restart recovery becomes UNCERTAIN rather than guessing that no effect
 * occurred.
 */
export class SyntheticUpdateRecordsEffectBoundary {
  private readonly lifecycle: ExecutionLifecycle;
  private readonly authority: ExecutionAuthorityGate;

  constructor(
    private readonly journal: ExecutionJournal,
    authorityProvider: ExecutionAuthorityProvider,
    private readonly preconditions: SyntheticUpdatePreconditionObserver,
    private readonly dispatcher: SyntheticUpdateDispatcher
  ) {
    this.lifecycle = new ExecutionLifecycle(journal);
    this.authority = new ExecutionAuthorityGate(journal, authorityProvider);
  }

  async execute(
    executionId: string,
    stepId: string
  ): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const stepIndex = current.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) {
      throw new SyntheticUpdateEffectBoundaryInvariantError(
        `Execution "${executionId}" has no step "${stepId}".`
      );
    }
    const definitionStep = current.definition.steps[stepIndex]!;
    if (definitionStep.operation !== "update_records") {
      throw new SyntheticUpdateEffectBoundaryInvariantError(
        `Execution "${executionId}" step "${stepId}" is not the bounded synthetic update_records capability.`
      );
    }
    if (definitionStep.effectIntent === undefined) {
      throw new SyntheticUpdateEffectBoundaryInvariantError(
        `Execution "${executionId}" step "${stepId}" has no immutable effect intent.`
      );
    }

    const expectedStateToken =
      definitionStep.expectedStateTokens[PRECONDITION_STATE_TOKEN_KEY];
    if (expectedStateToken === undefined) {
      throw new SyntheticUpdateEffectBoundaryInvariantError(
        `Execution "${executionId}" step "${stepId}" must freeze a precondition.current state token.`
      );
    }

    const observation = await this.preconditions.observeCurrentState(
      preconditionRequest(current, definitionStep, expectedStateToken)
    );
    if (observation.stateToken !== expectedStateToken) {
      throw new SyntheticUpdatePreconditionFailedError(
        executionId,
        stepId,
        expectedStateToken,
        observation.stateToken
      );
    }

    // Re-resolved on every execution attempt; no positive authority result is
    // cached by the boundary or the gate.
    await this.authority.assertCurrentAuthority(executionId, stepId);

    // prepareEffect re-loads the journal and CAS-publishes budget reservation +
    // RUNNING effect identity. A concurrent durable transition therefore fails
    // before dispatch rather than using the earlier observation blindly.
    const prepared = await this.lifecycle.prepareEffect(executionId, stepId);
    const preparedIndex = prepared.steps.findIndex((step) => step.stepId === stepId);
    const preparedDefinitionStep = prepared.definition.steps[preparedIndex]!;

    let knowledge: RecordedEffectKnowledge;
    try {
      knowledge = await this.dispatcher.dispatch(
        effectRequest(prepared, preparedDefinitionStep)
      );
    } catch (error) {
      // Deliberately leave RUNNING durable state untouched. The dispatcher may
      // have applied the upstream effect before losing its response.
      throw error;
    }

    return this.lifecycle.recordEffect(executionId, stepId, knowledge);
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }
}
