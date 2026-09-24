import {
  ExecutionJournalNotFoundError,
  type ExecutionJournal,
  type ExecutionJournalRecord,
  type PlannedExecutionStep
} from "./executionJournal.js";

export interface ExecutionAuthorityRequest {
  executionId: string;
  executionContractVersion: string;
  planId: string;
  planVersion: string;
  principalId: string;
  mandateVersion: string;
  target: string;
  stepId: string;
  operation: string;
  capability: string;
}

/**
 * Point-in-time authority material resolved by a trusted runtime provider.
 *
 * The provider owns the environment-specific lookup. The execution engine owns
 * the comparison against the immutable plan and never accepts these fields from
 * a model-facing call.
 */
export interface CurrentExecutionAuthority {
  principalId: string;
  mandateVersion: string;
  target: string;
  capabilities: readonly string[];
}

export interface ExecutionAuthorityProvider {
  currentAuthority(
    request: ExecutionAuthorityRequest
  ): Promise<CurrentExecutionAuthority | null>;
}

export class ExecutionAuthorityStepNotFoundError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string
  ) {
    super(`Execution "${executionId}" has no step "${stepId}".`);
    this.name = "ExecutionAuthorityStepNotFoundError";
  }
}

export class ExecutionAuthorityInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionAuthorityInvariantError";
  }
}

export class ExecutionAuthorityRevokedError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    public readonly reason:
      | "unavailable"
      | "principal"
      | "mandate"
      | "target"
      | "capability"
  ) {
    super(
      `Execution "${executionId}" step "${stepId}" does not have current authority (${reason}).`
    );
    this.name = "ExecutionAuthorityRevokedError";
  }
}

function authorityRequest(
  record: ExecutionJournalRecord,
  step: PlannedExecutionStep
): ExecutionAuthorityRequest {
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
    operation: step.operation,
    capability: step.capability
  };
}

/**
 * J1 point-in-time authority gate.
 *
 * Every call resolves authority again through the provider; this class keeps no
 * positive authorization cache. The provider is an environment seam, while the
 * engine compares the returned current principal, mandate, exact target and
 * capability against the immutable plan itself.
 *
 * A successful return is deliberately not a durable dispatch token. It proves
 * only that the required authority held at this check boundary. The J1
 * coordinator must invoke this gate for every new or resumed effect at the
 * effect boundary, in addition to satisfying write-ahead, precondition, budget
 * and capability-specific recovery rules. In particular, this class does not
 * make a SUSPENDED/UNCERTAIN step replayable.
 */
export class ExecutionAuthorityGate {
  constructor(
    private readonly journal: ExecutionJournal,
    private readonly provider: ExecutionAuthorityProvider
  ) {}

  async assertCurrentAuthority(executionId: string, stepId: string): Promise<void> {
    const record = await this.loadRequired(executionId);
    const stepIndex = record.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) {
      throw new ExecutionAuthorityStepNotFoundError(executionId, stepId);
    }

    const definitionStep = record.definition.steps[stepIndex]!;
    if (definitionStep.effectIntent === undefined) {
      throw new ExecutionAuthorityInvariantError(
        `Execution "${executionId}" step "${stepId}" has no immutable effect intent and cannot cross an effect authority gate.`
      );
    }

    const request = authorityRequest(record, definitionStep);
    const current = await this.provider.currentAuthority(request);
    if (current === null) {
      throw new ExecutionAuthorityRevokedError(executionId, stepId, "unavailable");
    }
    if (current.principalId !== request.principalId) {
      throw new ExecutionAuthorityRevokedError(executionId, stepId, "principal");
    }
    if (current.mandateVersion !== request.mandateVersion) {
      throw new ExecutionAuthorityRevokedError(executionId, stepId, "mandate");
    }
    if (current.target !== request.target) {
      throw new ExecutionAuthorityRevokedError(executionId, stepId, "target");
    }
    if (!current.capabilities.includes(request.capability)) {
      throw new ExecutionAuthorityRevokedError(executionId, stepId, "capability");
    }
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }
}
