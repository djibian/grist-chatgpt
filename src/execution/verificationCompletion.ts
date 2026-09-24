import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  ExecutionJournalNotFoundError,
  type ExecutionIdentity,
  type ExecutionJournal,
  type ExecutionJournalMutableState,
  type ExecutionJournalRecord,
  type FileExecutionJournal,
  type VerificationEvidenceRecord,
  type VerificationVerdict
} from "./executionJournal.js";

export interface StepVerificationRequirement {
  stepId: string;
  requiredPropertyIds: readonly string[];
}

export interface ExecutionVerificationContractDefinition {
  identity: ExecutionIdentity;
  steps: readonly StepVerificationRequirement[];
}

export interface VerificationContractStore {
  initialize(
    execution: ExecutionJournalRecord,
    definition: ExecutionVerificationContractDefinition
  ): Promise<ExecutionVerificationContractDefinition>;
  load(executionId: string): Promise<ExecutionVerificationContractDefinition | null>;
}

export class VerificationContractConflictError extends Error {
  constructor(public readonly executionId: string) {
    super(
      `Execution "${executionId}" already has a different immutable verification contract.`
    );
    this.name = "VerificationContractConflictError";
  }
}

export class VerificationContractInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationContractInvariantError";
  }
}

export class VerificationCompletionTransitionError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    message: string
  ) {
    super(`Execution "${executionId}" step "${stepId}": ${message}`);
    this.name = "VerificationCompletionTransitionError";
  }
}

export class VerificationRequirementNotMetError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepId: string,
    public readonly propertyId: string,
    public readonly verdict: VerificationVerdict | "MISSING"
  ) {
    super(
      `Execution "${executionId}" step "${stepId}" cannot be VERIFIED: required property "${propertyId}" has latest verdict ${verdict}.`
    );
    this.name = "VerificationRequirementNotMetError";
  }
}

const MAX_ID_LENGTH = 200;
const MAX_STEPS = 100;
const MAX_REQUIRED_PROPERTIES_PER_STEP = 100;

function boundedId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new VerificationContractInvariantError(`${label} must be a non-empty string.`);
  }
  if (value !== value.trim() || value.length > MAX_ID_LENGTH) {
    throw new VerificationContractInvariantError(`${label} is not a bounded canonical identifier.`);
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameIdentity(left: ExecutionIdentity, right: ExecutionIdentity): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function validateContractAgainstExecution(
  execution: ExecutionJournalRecord,
  definition: ExecutionVerificationContractDefinition
): void {
  if (!sameIdentity(definition.identity, execution.definition.identity)) {
    throw new VerificationContractInvariantError(
      "Verification contract identity must match the immutable execution identity exactly."
    );
  }

  if (definition.steps.length !== execution.definition.steps.length) {
    throw new VerificationContractInvariantError(
      "Verification contract must bind every immutable execution step exactly once."
    );
  }
  if (definition.steps.length < 1 || definition.steps.length > MAX_STEPS) {
    throw new VerificationContractInvariantError(
      `Verification contract must contain between 1 and ${MAX_STEPS} steps.`
    );
  }

  const propertyDefinitions = new Map(
    execution.definition.criticalProperties.map((property) => [property.propertyId, property])
  );
  const coveredCriticalProperties = new Set<string>();

  for (const [index, requirement] of definition.steps.entries()) {
    const plannedStep = execution.definition.steps[index]!;
    const stepId = boundedId(requirement.stepId, `steps[${index}].stepId`);
    if (stepId !== plannedStep.stepId) {
      throw new VerificationContractInvariantError(
        "Verification contract step order and IDs must match the immutable execution plan."
      );
    }
    if (
      requirement.requiredPropertyIds.length < 1 ||
      requirement.requiredPropertyIds.length > MAX_REQUIRED_PROPERTIES_PER_STEP
    ) {
      throw new VerificationContractInvariantError(
        `Step "${stepId}" must require between 1 and ${MAX_REQUIRED_PROPERTIES_PER_STEP} properties.`
      );
    }

    const seen = new Set<string>();
    for (const value of requirement.requiredPropertyIds) {
      const propertyId = boundedId(value, `required property for ${stepId}`);
      if (seen.has(propertyId)) {
        throw new VerificationContractInvariantError(
          `Step "${stepId}" contains duplicate required property "${propertyId}".`
        );
      }
      const property = propertyDefinitions.get(propertyId);
      if (!property) {
        throw new VerificationContractInvariantError(
          `Step "${stepId}" requires unknown property "${propertyId}".`
        );
      }
      seen.add(propertyId);
      if (property.criticality === "CRITICAL") coveredCriticalProperties.add(propertyId);
    }
  }

  for (const property of execution.definition.criticalProperties) {
    if (
      property.criticality === "CRITICAL" &&
      !coveredCriticalProperties.has(property.propertyId)
    ) {
      throw new VerificationContractInvariantError(
        `Critical property "${property.propertyId}" is not required by any step.`
      );
    }
  }
}

function validatePristineInitialization(execution: ExecutionJournalRecord): void {
  if (
    execution.revision !== 0 ||
    execution.status !== "PENDING" ||
    execution.verificationEvidence.length !== 0 ||
    execution.steps.some((step) => step.status !== "PENDING")
  ) {
    throw new VerificationContractInvariantError(
      "Verification contract must be frozen before any execution step leaves the pristine PENDING journal state."
    );
  }
}

function parseContract(
  executionId: string,
  serialized: string
): ExecutionVerificationContractDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new VerificationContractInvariantError(
      `Verification contract for execution "${executionId}" is corrupt.`
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VerificationContractInvariantError(
      `Verification contract for execution "${executionId}" is corrupt.`
    );
  }
  const definition = parsed as ExecutionVerificationContractDefinition;
  if (
    definition.identity === null ||
    typeof definition.identity !== "object" ||
    Array.isArray(definition.identity)
  ) {
    throw new VerificationContractInvariantError(
      `Verification contract for execution "${executionId}" is corrupt.`
    );
  }
  boundedId(definition.identity.executionId, "verification identity executionId");
  if (definition.identity.executionId !== executionId || !Array.isArray(definition.steps)) {
    throw new VerificationContractInvariantError(
      `Verification contract for execution "${executionId}" is corrupt.`
    );
  }
  return definition;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

/**
 * Immutable companion verification contract for the controlled J1 environment.
 *
 * The contract is frozen while the execution journal is still pristine, is
 * keyed by exact execution/plan identity, and cannot be weakened later under
 * the same execution ID. Publication is serialized through the paired
 * FileExecutionJournal's same-process per-execution write chain, so a stale
 * caller snapshot cannot race a write-ahead transition. Like
 * FileExecutionJournal, this is controlled-environment persistence rather than
 * a production multi-writer store.
 */
export class FileVerificationContractStore implements VerificationContractStore {
  private readonly directory: string;

  constructor(
    directory: string,
    private readonly journal: FileExecutionJournal
  ) {
    this.directory = resolve(directory);
  }

  async initialize(
    execution: ExecutionJournalRecord,
    definition: ExecutionVerificationContractDefinition
  ): Promise<ExecutionVerificationContractDefinition> {
    // Snapshot caller-owned inputs before the first asynchronous boundary.
    const executionSnapshot = clone(execution);
    const frozen = clone(definition);
    const executionId = boundedId(
      executionSnapshot.definition.identity.executionId,
      "executionId"
    );

    return this.journal.withExclusiveExecution(executionId, async (current) => {
      if (
        current.revision !== executionSnapshot.revision ||
        canonicalJson(current.definition) !== canonicalJson(executionSnapshot.definition)
      ) {
        throw new VerificationContractInvariantError(
          `Verification contract initialization requires the current durable execution snapshot for "${executionId}".`
        );
      }

      validatePristineInitialization(current);
      validateContractAgainstExecution(current, frozen);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });

      const existing = await this.load(executionId);
      if (existing) {
        if (canonicalJson(existing) !== canonicalJson(frozen)) {
          throw new VerificationContractConflictError(executionId);
        }
        return clone(existing);
      }

      const path = this.contractPath(executionId);
      const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      const handle = await open(tempPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(frozen, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      try {
        await link(tempPath, path);
      } catch (error) {
        if (!isNodeErrorWithCode(error, "EEXIST")) throw error;
        const concurrent = await this.load(executionId);
        if (!concurrent || canonicalJson(concurrent) !== canonicalJson(frozen)) {
          throw new VerificationContractConflictError(executionId);
        }
        return clone(concurrent);
      } finally {
        await unlink(tempPath).catch(() => undefined);
      }

      const directoryHandle = await open(this.directory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
      return clone(frozen);
    });
  }

  async load(executionId: string): Promise<ExecutionVerificationContractDefinition | null> {
    boundedId(executionId, "executionId");
    try {
      const serialized = await readFile(this.contractPath(executionId), "utf8");
      return clone(parseContract(executionId, serialized));
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) return null;
      throw error;
    }
  }

  private contractPath(executionId: string): string {
    const validated = boundedId(executionId, "executionId");
    const storageKey = createHash("sha256").update(validated, "utf8").digest("base64url");
    return join(this.directory, `verification-${storageKey}.json`);
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

function latestLinkedEvidence(
  record: ExecutionJournalRecord,
  stepIndex: number,
  propertyId: string
): VerificationEvidenceRecord | null {
  const step = record.steps[stepIndex]!;
  const byId = new Map(
    record.verificationEvidence.map((evidence) => [evidence.evidenceId, evidence])
  );
  for (let index = step.verificationEvidenceIds.length - 1; index >= 0; index -= 1) {
    const evidence = byId.get(step.verificationEvidenceIds[index]!);
    if (evidence?.propertyId === propertyId) return evidence;
  }
  return null;
}

/**
 * Completes the J1 EFFECT_RECORDED -> VERIFIED transition only from the frozen
 * companion contract and latest step-linked durable evidence.
 */
export class VerificationCompletionLifecycle {
  constructor(
    private readonly journal: ExecutionJournal,
    private readonly contracts: VerificationContractStore
  ) {}

  async markStepVerified(
    executionId: string,
    stepId: string
  ): Promise<ExecutionJournalRecord> {
    const current = await this.loadRequired(executionId);
    const stepIndex = current.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) {
      throw new VerificationCompletionTransitionError(
        executionId,
        stepId,
        "step is absent from the immutable execution plan."
      );
    }
    const step = current.steps[stepIndex]!;
    if (step.status === "VERIFIED") return current;
    if (step.status !== "EFFECT_RECORDED") {
      throw new VerificationCompletionTransitionError(
        executionId,
        stepId,
        `expected EFFECT_RECORDED, found ${step.status}.`
      );
    }

    const contract = await this.contracts.load(executionId);
    if (!contract) {
      throw new VerificationCompletionTransitionError(
        executionId,
        stepId,
        "no frozen verification contract exists."
      );
    }
    validateContractAgainstExecution(current, contract);
    const requirement = contract.steps[stepIndex]!;

    for (const propertyId of requirement.requiredPropertyIds) {
      const evidence = latestLinkedEvidence(current, stepIndex, propertyId);
      if (!evidence) {
        throw new VerificationRequirementNotMetError(
          executionId,
          stepId,
          propertyId,
          "MISSING"
        );
      }
      if (evidence.verdict !== "VERIFIED") {
        throw new VerificationRequirementNotMetError(
          executionId,
          stepId,
          propertyId,
          evidence.verdict
        );
      }
    }

    const next = mutableState(current);
    next.steps = next.steps.map((candidate, index) =>
      index === stepIndex ? { ...candidate, status: "VERIFIED" as const } : candidate
    );
    next.status = next.steps.every((candidate) => candidate.status === "VERIFIED")
      ? "COMPLETED"
      : "RUNNING";

    return this.journal.compareAndSet(executionId, current.revision, next);
  }

  private async loadRequired(executionId: string): Promise<ExecutionJournalRecord> {
    const record = await this.journal.load(executionId);
    if (!record) throw new ExecutionJournalNotFoundError(executionId);
    return record;
  }
}
