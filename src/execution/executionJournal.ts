import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

export type ExecutionStatus = "PENDING" | "RUNNING" | "SUSPENDED" | "COMPLETED";
export type ExecutionStepStatus =
  | "PENDING"
  | "RUNNING"
  | "EFFECT_RECORDED"
  | "VERIFIED"
  | "SUSPENDED";
export type ExecutionEffectState =
  | "NOT_APPLIED"
  | "PARTIALLY_APPLIED"
  | "APPLIED"
  | "UNCERTAIN"
  | "COMPENSATED";
export type PropertyCriticality = "CRITICAL" | "IMPORTANT" | "INFORMATIONAL";
export type VerificationVerdict =
  | "VERIFIED"
  | "VIOLATED"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export interface ExecutionIdentity {
  executionId: string;
  executionContractVersion: string;
  planId: string;
  planVersion: string;
  applicationId?: string;
  target: string;
  principalId: string;
  mandateVersion: string;
}

export interface PlannedExecutionStep {
  stepId: string;
  order: number;
  operation: string;
  capability: string;
  preconditions: readonly string[];
  expectedStateTokens: Readonly<Record<string, string>>;
}

export interface CriticalPropertyDefinition {
  propertyId: string;
  criticality: PropertyCriticality;
}

export interface ExecutionPlanDefinition {
  identity: ExecutionIdentity;
  steps: readonly PlannedExecutionStep[];
  budgetLimits: Readonly<Record<string, number>>;
  criticalProperties: readonly CriticalPropertyDefinition[];
}

export interface ConfirmedEffectEvidence {
  stableIds: readonly (string | number)[];
  confirmedItems: number;
}

export interface ExecutionStepState {
  stepId: string;
  status: ExecutionStepStatus;
  effectState: ExecutionEffectState;
  confirmedEffect: ConfirmedEffectEvidence;
  verificationEvidenceIds: readonly string[];
}

export interface BudgetUsage {
  reserved: number;
  consumed: number;
}

export interface VerificationEvidenceRecord {
  evidenceId: string;
  propertyId: string;
  criticality: PropertyCriticality;
  verdict: VerificationVerdict;
  executionId: string;
  planVersion: string;
  principalId: string;
  method: string;
  timestamp: string;
  targetStateToken?: string;
  dependencies: readonly string[];
}

export interface ExecutionJournalMutableState {
  status: ExecutionStatus;
  steps: readonly ExecutionStepState[];
  budgets: Readonly<Record<string, BudgetUsage>>;
  verificationEvidence: readonly VerificationEvidenceRecord[];
}

export interface ExecutionJournalRecord extends ExecutionJournalMutableState {
  definition: ExecutionPlanDefinition;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionJournal {
  initialize(definition: ExecutionPlanDefinition): Promise<ExecutionJournalRecord>;
  load(executionId: string): Promise<ExecutionJournalRecord | null>;
  compareAndSet(
    executionId: string,
    expectedRevision: number,
    nextState: ExecutionJournalMutableState
  ): Promise<ExecutionJournalRecord>;
}

export class ExecutionDefinitionConflictError extends Error {
  constructor(public readonly executionId: string) {
    super(
      `Execution "${executionId}" already exists with a different immutable contract or plan definition.`
    );
    this.name = "ExecutionDefinitionConflictError";
  }
}

export class ExecutionJournalRevisionError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision: number
  ) {
    super(
      `Execution "${executionId}" journal revision changed: expected ${expectedRevision}, current ${actualRevision}.`
    );
    this.name = "ExecutionJournalRevisionError";
  }
}

export class ExecutionJournalNotFoundError extends Error {
  constructor(public readonly executionId: string) {
    super(`Execution "${executionId}" does not exist in the journal.`);
    this.name = "ExecutionJournalNotFoundError";
  }
}

export class ExecutionJournalCorruptError extends Error {
  constructor(public readonly executionId: string) {
    super(`Execution "${executionId}" has an invalid or corrupt journal record.`);
    this.name = "ExecutionJournalCorruptError";
  }
}

const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  "PENDING",
  "RUNNING",
  "SUSPENDED",
  "COMPLETED"
];
const STEP_STATUSES: readonly ExecutionStepStatus[] = [
  "PENDING",
  "RUNNING",
  "EFFECT_RECORDED",
  "VERIFIED",
  "SUSPENDED"
];
const EFFECT_STATES: readonly ExecutionEffectState[] = [
  "NOT_APPLIED",
  "PARTIALLY_APPLIED",
  "APPLIED",
  "UNCERTAIN",
  "COMPENSATED"
];
const CRITICALITIES: readonly PropertyCriticality[] = [
  "CRITICAL",
  "IMPORTANT",
  "INFORMATIONAL"
];
const VERDICTS: readonly VerificationVerdict[] = [
  "VERIFIED",
  "VIOLATED",
  "UNKNOWN",
  "NOT_APPLICABLE"
];

const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 1_000;
const MAX_STEPS = 100;
const MAX_PRECONDITIONS_PER_STEP = 100;
const MAX_BUDGET_DIMENSIONS = 32;
const MAX_CRITICAL_PROPERTIES = 100;
const MAX_STATE_TOKENS_PER_STEP = 64;
const MAX_CONFIRMED_EFFECT_IDS = 1_000;
const MAX_EVIDENCE_PER_EXECUTION = 1_000;
const MAX_EVIDENCE_IDS_PER_STEP = 100;
const MAX_EVIDENCE_DEPENDENCIES = 100;

function boundedText(value: string, label: string, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  if (!value.trim()) throw new Error(`${label} must not be empty.`);
  if (value.length > maxLength) {
    throw new Error(`${label} exceeds the maximum supported length.`);
  }
  return value;
}

function boundedId(value: string, label: string): string {
  boundedText(value, label, MAX_ID_LENGTH);
  if (value !== value.trim()) {
    throw new Error(`${label} must use a canonical identifier without surrounding whitespace.`);
  }
  return value;
}

function assertOneOf<T extends string>(
  value: T,
  allowed: readonly T[],
  label: string
): void {
  if (!allowed.includes(value)) throw new Error(`${label} has an unsupported value.`);
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return value;
}

function sortedObject<T>(value: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
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

function validateDefinition(definition: ExecutionPlanDefinition): void {
  const identity = definition.identity;
  boundedId(identity.executionId, "executionId");
  boundedId(identity.executionContractVersion, "executionContractVersion");
  boundedId(identity.planId, "planId");
  boundedId(identity.planVersion, "planVersion");
  if (identity.applicationId !== undefined) {
    boundedId(identity.applicationId, "applicationId");
  }
  boundedText(identity.target, "target", MAX_ID_LENGTH);
  boundedId(identity.principalId, "principalId");
  boundedId(identity.mandateVersion, "mandateVersion");

  if (definition.steps.length < 1 || definition.steps.length > MAX_STEPS) {
    throw new Error(`Plan must contain between 1 and ${MAX_STEPS} steps.`);
  }

  const stepIds = new Set<string>();
  for (const [index, step] of definition.steps.entries()) {
    const stepId = boundedId(step.stepId, `steps[${index}].stepId`);
    if (stepIds.has(stepId)) throw new Error(`Duplicate stepId "${stepId}".`);
    stepIds.add(stepId);
    if (step.order !== index + 1) {
      throw new Error("Step order must be contiguous, deterministic and start at 1.");
    }
    boundedId(step.operation, `steps[${index}].operation`);
    boundedId(step.capability, `steps[${index}].capability`);
    if (step.preconditions.length > MAX_PRECONDITIONS_PER_STEP) {
      throw new Error(
        `steps[${index}].preconditions exceeds ${MAX_PRECONDITIONS_PER_STEP} entries.`
      );
    }
    for (const [preconditionIndex, precondition] of step.preconditions.entries()) {
      boundedText(
        precondition,
        `steps[${index}].preconditions[${preconditionIndex}]`
      );
    }
    const stateTokens = Object.entries(step.expectedStateTokens);
    if (stateTokens.length > MAX_STATE_TOKENS_PER_STEP) {
      throw new Error(
        `steps[${index}].expectedStateTokens exceeds ${MAX_STATE_TOKENS_PER_STEP} entries.`
      );
    }
    for (const [key, value] of stateTokens) {
      boundedId(key, `steps[${index}].expectedStateTokens key`);
      boundedText(value, `steps[${index}].expectedStateTokens.${key}`);
    }
  }

  const budgetEntries = Object.entries(definition.budgetLimits);
  if (budgetEntries.length > MAX_BUDGET_DIMENSIONS) {
    throw new Error(`budgetLimits exceeds ${MAX_BUDGET_DIMENSIONS} dimensions.`);
  }
  for (const [dimension, limit] of budgetEntries) {
    boundedId(dimension, "budget dimension");
    positiveInteger(limit, `budgetLimits.${dimension}`);
  }

  if (definition.criticalProperties.length > MAX_CRITICAL_PROPERTIES) {
    throw new Error(
      `criticalProperties exceeds ${MAX_CRITICAL_PROPERTIES} entries.`
    );
  }
  const propertyIds = new Set<string>();
  for (const property of definition.criticalProperties) {
    const propertyId = boundedId(property.propertyId, "propertyId");
    assertOneOf(property.criticality, CRITICALITIES, `criticality for ${propertyId}`);
    if (propertyIds.has(propertyId)) {
      throw new Error(`Duplicate critical property "${propertyId}".`);
    }
    propertyIds.add(propertyId);
  }
}

function initialState(definition: ExecutionPlanDefinition): ExecutionJournalMutableState {
  return {
    status: "PENDING",
    steps: definition.steps.map((step) => ({
      stepId: step.stepId,
      status: "PENDING",
      effectState: "NOT_APPLIED",
      confirmedEffect: {
        stableIds: [],
        confirmedItems: 0
      },
      verificationEvidenceIds: []
    })),
    budgets: Object.fromEntries(
      Object.keys(sortedObject(definition.budgetLimits)).map((dimension) => [
        dimension,
        { reserved: 0, consumed: 0 }
      ])
    ),
    verificationEvidence: []
  };
}

function validateMutableState(
  definition: ExecutionPlanDefinition,
  state: ExecutionJournalMutableState
): void {
  assertOneOf(state.status, EXECUTION_STATUSES, "execution status");
  if (state.steps.length !== definition.steps.length) {
    throw new Error("Journal step state must match the immutable plan step set exactly.");
  }

  for (const [index, stepState] of state.steps.entries()) {
    const definitionStep = definition.steps[index]!;
    if (stepState.stepId !== definitionStep.stepId) {
      throw new Error("Journal step state must preserve immutable step order and IDs.");
    }
    assertOneOf(stepState.status, STEP_STATUSES, `steps[${index}].status`);
    assertOneOf(stepState.effectState, EFFECT_STATES, `steps[${index}].effectState`);
    nonNegativeInteger(
      stepState.confirmedEffect.confirmedItems,
      `steps[${index}].confirmedEffect.confirmedItems`
    );
    if (stepState.confirmedEffect.stableIds.length > MAX_CONFIRMED_EFFECT_IDS) {
      throw new Error(
        `steps[${index}].confirmedEffect.stableIds exceeds ${MAX_CONFIRMED_EFFECT_IDS} entries.`
      );
    }
    const stableIds = new Set<string>();
    for (const stableId of stepState.confirmedEffect.stableIds) {
      let stableIdKey: string;
      if (typeof stableId === "string") {
        boundedId(stableId, `steps[${index}].confirmedEffect.stableIds`);
        stableIdKey = `s:${stableId}`;
      } else if (typeof stableId === "number" && Number.isSafeInteger(stableId) && stableId > 0) {
        stableIdKey = `n:${stableId}`;
      } else {
        throw new Error(`steps[${index}] contains an invalid stable effect ID.`);
      }
      if (stableIds.has(stableIdKey)) {
        throw new Error(`steps[${index}] contains a duplicate stable effect ID.`);
      }
      stableIds.add(stableIdKey);
    }
    if (stepState.verificationEvidenceIds.length > MAX_EVIDENCE_IDS_PER_STEP) {
      throw new Error(
        `steps[${index}].verificationEvidenceIds exceeds ${MAX_EVIDENCE_IDS_PER_STEP} entries.`
      );
    }
    const stepEvidenceIds = new Set<string>();
    for (const evidenceId of stepState.verificationEvidenceIds) {
      boundedId(evidenceId, `steps[${index}].verificationEvidenceIds`);
      if (stepEvidenceIds.has(evidenceId)) {
        throw new Error(`steps[${index}] contains a duplicate verification evidence ID.`);
      }
      stepEvidenceIds.add(evidenceId);
    }
  }

  const expectedBudgetDimensions = Object.keys(sortedObject(definition.budgetLimits));
  const actualBudgetDimensions = Object.keys(sortedObject(state.budgets));
  if (canonicalJson(expectedBudgetDimensions) !== canonicalJson(actualBudgetDimensions)) {
    throw new Error("Journal budget state must match immutable budget dimensions exactly.");
  }
  for (const dimension of expectedBudgetDimensions) {
    const usage = state.budgets[dimension]!;
    nonNegativeInteger(usage.reserved, `budgets.${dimension}.reserved`);
    nonNegativeInteger(usage.consumed, `budgets.${dimension}.consumed`);
  }

  if (state.verificationEvidence.length > MAX_EVIDENCE_PER_EXECUTION) {
    throw new Error(
      `verificationEvidence exceeds ${MAX_EVIDENCE_PER_EXECUTION} entries.`
    );
  }
  const propertyDefinitions = new Map(
    definition.criticalProperties.map((property) => [property.propertyId, property])
  );
  const evidenceIds = new Set<string>();
  for (const evidence of state.verificationEvidence) {
    const evidenceId = boundedId(evidence.evidenceId, "evidenceId");
    if (evidenceIds.has(evidenceId)) {
      throw new Error(`Duplicate verification evidence ID "${evidenceId}".`);
    }
    evidenceIds.add(evidenceId);
    boundedId(evidence.propertyId, `verificationEvidence.${evidenceId}.propertyId`);
    assertOneOf(evidence.criticality, CRITICALITIES, `criticality for ${evidenceId}`);
    assertOneOf(evidence.verdict, VERDICTS, `verdict for ${evidenceId}`);
    const property = propertyDefinitions.get(evidence.propertyId);
    if (!property || property.criticality !== evidence.criticality) {
      throw new Error(
        `Verification evidence "${evidenceId}" does not match an immutable property definition.`
      );
    }
    if (
      evidence.executionId !== definition.identity.executionId ||
      evidence.planVersion !== definition.identity.planVersion ||
      evidence.principalId !== definition.identity.principalId
    ) {
      throw new Error(
        `Verification evidence "${evidenceId}" does not match immutable execution identity.`
      );
    }
    boundedText(evidence.method, `verificationEvidence.${evidenceId}.method`);
    if (!Number.isFinite(Date.parse(evidence.timestamp))) {
      throw new Error(`Verification evidence "${evidenceId}" has an invalid timestamp.`);
    }
    if (evidence.targetStateToken !== undefined) {
      boundedText(
        evidence.targetStateToken,
        `verificationEvidence.${evidenceId}.targetStateToken`
      );
    }
    if (evidence.dependencies.length > MAX_EVIDENCE_DEPENDENCIES) {
      throw new Error(
        `Verification evidence "${evidenceId}" exceeds ${MAX_EVIDENCE_DEPENDENCIES} dependencies.`
      );
    }
    for (const dependency of evidence.dependencies) {
      boundedText(dependency, `verificationEvidence.${evidenceId}.dependencies`);
    }
  }

  for (const step of state.steps) {
    for (const evidenceId of step.verificationEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(
          `Step "${step.stepId}" references unknown verification evidence "${evidenceId}".`
        );
      }
    }
  }
}

function parseRecord(executionId: string, serialized: string): ExecutionJournalRecord {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new ExecutionJournalCorruptError(executionId);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ExecutionJournalCorruptError(executionId);
  }

  const record = value as ExecutionJournalRecord;
  try {
    validateDefinition(record.definition);
    if (record.definition.identity.executionId !== executionId) {
      throw new Error("execution mismatch");
    }
    nonNegativeInteger(record.revision, "revision");
    if (!Number.isFinite(Date.parse(record.createdAt))) throw new Error("createdAt");
    if (!Number.isFinite(Date.parse(record.updatedAt))) throw new Error("updatedAt");
    validateMutableState(record.definition, record);
  } catch (error) {
    if (error instanceof ExecutionJournalCorruptError) throw error;
    throw new ExecutionJournalCorruptError(executionId);
  }
  return record;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

export interface FileExecutionJournalOptions {
  now?: () => Date;
}

const PROCESS_WRITE_CHAINS = new Map<string, Promise<unknown>>();

/**
 * Durable journal for the isolated J1 controlled environment.
 *
 * Records are written as one JSON file per execution. File contents are fsync'd
 * before an atomic publish/replace. Mutations are serialized per resolved
 * directory/execution across FileExecutionJournal instances in this process.
 * The implementation therefore assumes this process is the sole writer for the
 * directory; it is not a distributed lock or production multi-writer store.
 */
export class FileExecutionJournal implements ExecutionJournal {
  private readonly directory: string;
  private readonly now: () => Date;

  constructor(directory: string, options: FileExecutionJournalOptions = {}) {
    this.directory = resolve(directory);
    this.now = options.now ?? (() => new Date());
  }

  async initialize(definition: ExecutionPlanDefinition): Promise<ExecutionJournalRecord> {
    const immutableDefinition = clone(definition);
    validateDefinition(immutableDefinition);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });

    const executionId = immutableDefinition.identity.executionId;
    const existing = await this.load(executionId);
    if (existing) {
      if (canonicalJson(existing.definition) !== canonicalJson(immutableDefinition)) {
        throw new ExecutionDefinitionConflictError(executionId);
      }
      return clone(existing);
    }

    const timestamp = this.now().toISOString();
    const state = initialState(immutableDefinition);
    validateMutableState(immutableDefinition, state);
    const record: ExecutionJournalRecord = {
      definition: clone(immutableDefinition),
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...state
    };

    const path = this.recordPath(executionId);
    const tempPath = await this.writeTemp(path, record);
    try {
      await link(tempPath, path);
    } catch (error) {
      if (!isNodeErrorWithCode(error, "EEXIST")) throw error;
      const concurrent = await this.load(executionId);
      if (!concurrent) throw error;
      if (canonicalJson(concurrent.definition) !== canonicalJson(immutableDefinition)) {
        throw new ExecutionDefinitionConflictError(executionId);
      }
      return clone(concurrent);
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
    await this.syncDirectory();
    return clone(record);
  }

  async load(executionId: string): Promise<ExecutionJournalRecord | null> {
    boundedId(executionId, "executionId");
    try {
      const serialized = await readFile(this.recordPath(executionId), "utf8");
      return clone(parseRecord(executionId, serialized));
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) return null;
      throw error;
    }
  }

  async compareAndSet(
    executionId: string,
    expectedRevision: number,
    nextState: ExecutionJournalMutableState
  ): Promise<ExecutionJournalRecord> {
    boundedId(executionId, "executionId");
    nonNegativeInteger(expectedRevision, "expectedRevision");
    return this.serializeWrite(executionId, async () => {
      const current = await this.load(executionId);
      if (!current) throw new ExecutionJournalNotFoundError(executionId);
      if (current.revision !== expectedRevision) {
        throw new ExecutionJournalRevisionError(
          executionId,
          expectedRevision,
          current.revision
        );
      }
      validateMutableState(current.definition, nextState);

      const next: ExecutionJournalRecord = {
        definition: clone(current.definition),
        revision: current.revision + 1,
        createdAt: current.createdAt,
        updatedAt: this.now().toISOString(),
        ...clone(nextState)
      };
      const path = this.recordPath(executionId);
      const tempPath = await this.writeTemp(path, next);
      try {
        await rename(tempPath, path);
      } finally {
        await unlink(tempPath).catch(() => undefined);
      }
      await this.syncDirectory();
      return clone(next);
    });
  }

  private serializeWrite<T>(executionId: string, operation: () => Promise<T>): Promise<T> {
    const key = `${this.directory}\u0000${executionId}`;
    const previous = PROCESS_WRITE_CHAINS.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    PROCESS_WRITE_CHAINS.set(key, current);
    return current.finally(() => {
      if (PROCESS_WRITE_CHAINS.get(key) === current) {
        PROCESS_WRITE_CHAINS.delete(key);
      }
    });
  }

  private recordPath(executionId: string): string {
    const validated = boundedId(executionId, "executionId");
    const storageKey = createHash("sha256").update(validated, "utf8").digest("base64url");
    return join(this.directory, `${storageKey}.json`);
  }

  private async writeTemp(
    destinationPath: string,
    record: ExecutionJournalRecord
  ): Promise<string> {
    const tempPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(tempPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return tempPath;
  }

  private async syncDirectory(): Promise<void> {
    const handle = await open(this.directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
}