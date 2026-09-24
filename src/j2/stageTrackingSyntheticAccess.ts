import {
  J2_STAGE_TRACKING_FIXTURE_STATES,
  type J2TeacherId
} from "./stageTrackingFixture.js";

const HARD_READ_LIMIT = 32;
const FIXTURE_STATE = J2_STAGE_TRACKING_FIXTURE_STATES["date-present-human-modified"];
const PROTECTED_TRACE_COLUMNS = [
  "Type_de_contact",
  "Date_du_contact",
  "Ponctuel",
  "Implication",
  "Commentaire"
] as const;

const RESOURCE_IDS = Object.freeze({
  default: 1001,
  stages: 1002,
  protectedTrace: 1003,
  assignment: 1004,
  teachers: 1005
});

const RULE_IDS = Object.freeze({
  userAttribute: 1001,
  defaultOwner: 1002,
  defaultEveryone: 1003,
  teachersOwner: 1004,
  teachersEveryone: 1005,
  stagesOwner: 1006,
  stagesCurrentTeacher: 1007,
  stagesEveryone: 1008,
  traceOwner: 1009,
  traceCurrentTeacher: 1010,
  traceEveryone: 1011,
  assignmentOwner: 1012,
  assignmentEveryone: 1013
});

const CURRENT_TEACHER_FORMULA =
  "rec.Suivi_par == user.Teacher.id and user.Teacher.Acces_Stages_Actif";
const OWNER_FORMULA = "user.Access == OWNER";
const USER_ATTRIBUTE = JSON.stringify({
  name: "Teacher",
  tableId: "Enseignants",
  lookupColId: "Token_Stages",
  charId: "LinkKey.Token"
});

interface QueryOptions {
  filter?: Record<string, unknown[]>;
  sort?: string;
  limit?: number;
  hidden?: boolean;
  cellFormat?: "normal" | "typed";
}

export interface J2SyntheticAccessClient {
  queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options?: QueryOptions
  ): Promise<unknown>;
  listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options?: { hidden?: boolean }
  ): Promise<unknown>;
  applyUserActions(documentIdOrUrl: string, actions: unknown[][]): Promise<unknown>;
}

export interface J2SyntheticLinkKeyVault {
  /**
   * Return the server-held synthetic secret for a stable logical handle.
   * Implementations must never log or expose the returned value to model-facing output.
   */
  getOrCreate(handle: string): Promise<string>;
}

export interface J2SyntheticAccessAuthority {
  documentId: string;
  principalId: string;
  mandateId: string;
  ownerAuthorized: boolean;
}

export interface J2SyntheticAccessProvisioningResult {
  documentId: string;
  status: "PROVISIONED" | "ALREADY_PROVISIONED" | "PROVISIONED_AFTER_UNCERTAIN_RESPONSE";
  accessModel: "J2_SYNTHETIC_ORACLE_POLICY_V1";
  secretHandles: Readonly<Record<J2TeacherId, string>>;
  aclResourceCount: 5;
  aclRuleCount: 13;
}

interface MetadataRecord {
  id: number;
  fields: Record<string, unknown>;
}

interface TeacherRecord extends MetadataRecord {
  fixtureId: J2TeacherId;
}

interface FixtureSecrets {
  "teacher-a": string;
  "teacher-b": string;
}

interface Snapshot {
  teachers: MetadataRecord[];
  resources: MetadataRecord[];
  rules: MetadataRecord[];
}

function boundedAuthorityValue(value: string, label: string): string {
  if (!value || value.length > 256 || /[?#]/.test(value) || /^https?:\/\//i.test(value)) {
    throw new Error(`${label} must be a bounded non-URL identifier without query or fragment data.`);
  }
  return value;
}

function recordsFromResponse(value: unknown, label: string): MetadataRecord[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned an unsupported response shape.`);
  }
  const records = (value as Record<string, unknown>).records;
  if (!Array.isArray(records) || records.length > HARD_READ_LIMIT) {
    throw new Error(`${label} exceeded the bounded fixture read shape.`);
  }
  return records.map((candidate) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`${label} contained an invalid record.`);
    }
    const record = candidate as Record<string, unknown>;
    if (!Number.isInteger(record.id) || (record.id as number) <= 0) {
      throw new Error(`${label} contained an invalid record ID.`);
    }
    if (record.fields === null || typeof record.fields !== "object" || Array.isArray(record.fields)) {
      throw new Error(`${label} contained invalid fields.`);
    }
    return { id: record.id as number, fields: record.fields as Record<string, unknown> };
  });
}

function columnsFromResponse(value: unknown, label: string): Map<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned an unsupported column response.`);
  }
  const columns = (value as Record<string, unknown>).columns;
  if (!Array.isArray(columns) || columns.length > HARD_READ_LIMIT) {
    throw new Error(`${label} exceeded the bounded fixture column shape.`);
  }
  const result = new Map<string, string>();
  for (const candidate of columns) {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`${label} contained an invalid column.`);
    }
    const column = candidate as Record<string, unknown>;
    const fields = column.fields;
    if (
      typeof column.id !== "string" ||
      fields === null ||
      typeof fields !== "object" ||
      Array.isArray(fields) ||
      typeof (fields as Record<string, unknown>).type !== "string"
    ) {
      throw new Error(`${label} contained an unsupported column definition.`);
    }
    result.set(column.id, (fields as Record<string, unknown>).type as string);
  }
  return result;
}

function requireColumn(columns: Map<string, string>, id: string, expectedType: string): void {
  if (columns.get(id) !== expectedType) {
    throw new Error(`Synthetic fixture requires ${id} with type ${expectedType}.`);
  }
}

function validateFixtureSchema(stageColumns: Map<string, string>, teacherColumns: Map<string, string>): void {
  requireColumn(stageColumns, "Fixture_Id", "Text");
  requireColumn(stageColumns, "Eleve", "Text");
  requireColumn(stageColumns, "Suivi_par", "Ref:Enseignants");
  requireColumn(stageColumns, "Type_de_contact", "Choice");
  requireColumn(stageColumns, "Date_du_contact", "Date");
  requireColumn(stageColumns, "Ponctuel", "Choice");
  requireColumn(stageColumns, "Implication", "Choice");
  requireColumn(stageColumns, "Commentaire", "Text");
  if (stageColumns.has("Auteur_du_contact")) {
    throw new Error(
      "date-present-human-modified must not pre-provision the historical author binding."
    );
  }

  requireColumn(teacherColumns, "Fixture_Id", "Text");
  requireColumn(teacherColumns, "Token_Stages", "Text");
  requireColumn(teacherColumns, "Acces_Stages_Actif", "Bool");
}

function teacherRecords(records: MetadataRecord[]): Record<J2TeacherId, TeacherRecord> {
  if (records.length !== 2) {
    throw new Error("Synthetic fixture must contain exactly two teacher rows.");
  }
  const result = new Map<J2TeacherId, TeacherRecord>();
  for (const record of records) {
    const fixtureId = record.fields.Fixture_Id;
    if (fixtureId !== "teacher-a" && fixtureId !== "teacher-b") {
      throw new Error("Synthetic fixture contains an unexpected teacher identity.");
    }
    if (record.fields.Acces_Stages_Actif !== true) {
      throw new Error(`Synthetic teacher ${fixtureId} must start active.`);
    }
    if (result.has(fixtureId)) {
      throw new Error(`Synthetic teacher ${fixtureId} is duplicated.`);
    }
    result.set(fixtureId, { ...record, fixtureId });
  }
  const teacherA = result.get("teacher-a");
  const teacherB = result.get("teacher-b");
  if (!teacherA || !teacherB) {
    throw new Error("Synthetic fixture teacher identities are incomplete.");
  }
  return { "teacher-a": teacherA, "teacher-b": teacherB };
}

function emptyish(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === 0;
}

function isLegacyPristineAcl(resources: MetadataRecord[], rules: MetadataRecord[]): boolean {
  if (resources.length !== 1 || rules.length !== 1) return false;
  const resource = resources[0]!;
  const rule = rules[0]!;
  return (
    resource.fields.tableId === "" &&
    resource.fields.colIds === "" &&
    rule.fields.resource === resource.id &&
    emptyish(rule.fields.permissionsText) &&
    emptyish(rule.fields.aclFormula) &&
    emptyish(rule.fields.userAttributes) &&
    (emptyish(rule.fields.principals) || rule.fields.principals === "[1]")
  );
}

function validateSecret(value: string, handle: string): string {
  if (value.length < 32 || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Synthetic LinkKey vault returned an invalid secret for ${handle}.`);
  }
  return value;
}

async function loadSecrets(vault: J2SyntheticLinkKeyVault): Promise<FixtureSecrets> {
  const handles = Object.fromEntries(
    FIXTURE_STATE.teachers.map((teacher) => [teacher.id, teacher.linkKeyHandle])
  ) as Record<J2TeacherId, string>;
  const teacherA = validateSecret(
    await vault.getOrCreate(handles["teacher-a"]),
    handles["teacher-a"]
  );
  const teacherB = validateSecret(
    await vault.getOrCreate(handles["teacher-b"]),
    handles["teacher-b"]
  );
  if (teacherA === teacherB) {
    throw new Error("Synthetic teacher LinkKeys must be distinct.");
  }
  return { "teacher-a": teacherA, "teacher-b": teacherB };
}

function expectedResources(): MetadataRecord[] {
  return [
    { id: RESOURCE_IDS.default, fields: { tableId: "*", colIds: "*" } },
    { id: RESOURCE_IDS.stages, fields: { tableId: "Stages", colIds: "*" } },
    {
      id: RESOURCE_IDS.protectedTrace,
      fields: { tableId: "Stages", colIds: PROTECTED_TRACE_COLUMNS.join(",") }
    },
    { id: RESOURCE_IDS.assignment, fields: { tableId: "Stages", colIds: "Suivi_par" } },
    { id: RESOURCE_IDS.teachers, fields: { tableId: "Enseignants", colIds: "*" } }
  ];
}

function rule(id: number, resource: number, rulePos: number, fields: Record<string, unknown>): MetadataRecord {
  return { id, fields: { resource, rulePos, ...fields } };
}

function expectedRules(): MetadataRecord[] {
  return [
    rule(RULE_IDS.userAttribute, RESOURCE_IDS.default, 1, { userAttributes: USER_ATTRIBUTE }),
    rule(RULE_IDS.defaultOwner, RESOURCE_IDS.default, 2, {
      aclFormula: OWNER_FORMULA,
      permissionsText: "+CRUDS"
    }),
    rule(RULE_IDS.defaultEveryone, RESOURCE_IDS.default, 3, {
      aclFormula: "",
      permissionsText: "-CRUDS"
    }),
    rule(RULE_IDS.teachersOwner, RESOURCE_IDS.teachers, 4, {
      aclFormula: OWNER_FORMULA,
      permissionsText: "+CRUD"
    }),
    rule(RULE_IDS.teachersEveryone, RESOURCE_IDS.teachers, 5, {
      aclFormula: "",
      permissionsText: "-CRUD"
    }),
    rule(RULE_IDS.stagesOwner, RESOURCE_IDS.stages, 6, {
      aclFormula: OWNER_FORMULA,
      permissionsText: "+CRUD"
    }),
    rule(RULE_IDS.stagesCurrentTeacher, RESOURCE_IDS.stages, 7, {
      aclFormula: CURRENT_TEACHER_FORMULA,
      permissionsText: "+R"
    }),
    rule(RULE_IDS.stagesEveryone, RESOURCE_IDS.stages, 8, {
      aclFormula: "",
      permissionsText: "-CRUD"
    }),
    rule(RULE_IDS.traceOwner, RESOURCE_IDS.protectedTrace, 9, {
      aclFormula: OWNER_FORMULA,
      permissionsText: "+RU"
    }),
    rule(RULE_IDS.traceCurrentTeacher, RESOURCE_IDS.protectedTrace, 10, {
      aclFormula: CURRENT_TEACHER_FORMULA,
      permissionsText: "+RU"
    }),
    rule(RULE_IDS.traceEveryone, RESOURCE_IDS.protectedTrace, 11, {
      aclFormula: "",
      permissionsText: "-RU"
    }),
    rule(RULE_IDS.assignmentOwner, RESOURCE_IDS.assignment, 12, {
      aclFormula: OWNER_FORMULA,
      permissionsText: "+RU"
    }),
    rule(RULE_IDS.assignmentEveryone, RESOURCE_IDS.assignment, 13, {
      aclFormula: "",
      permissionsText: "-U"
    })
  ];
}

function fieldSubsetMatches(actual: MetadataRecord, expected: MetadataRecord): boolean {
  if (actual.id !== expected.id) return false;
  return Object.entries(expected.fields).every(([key, value]) => actual.fields[key] === value);
}

function metadataMatches(actual: MetadataRecord[], expected: MetadataRecord[]): boolean {
  if (actual.length !== expected.length) return false;
  const byId = new Map(actual.map((record) => [record.id, record]));
  return expected.every((record) => {
    const candidate = byId.get(record.id);
    return candidate ? fieldSubsetMatches(candidate, record) : false;
  });
}

function teacherTokensMatch(
  teachers: Record<J2TeacherId, TeacherRecord>,
  secrets: FixtureSecrets
): boolean {
  return (
    teachers["teacher-a"].fields.Token_Stages === secrets["teacher-a"] &&
    teachers["teacher-b"].fields.Token_Stages === secrets["teacher-b"]
  );
}

function teacherTokensAreEmpty(teachers: Record<J2TeacherId, TeacherRecord>): boolean {
  return (
    emptyish(teachers["teacher-a"].fields.Token_Stages) &&
    emptyish(teachers["teacher-b"].fields.Token_Stages)
  );
}

function result(
  documentId: string,
  status: J2SyntheticAccessProvisioningResult["status"]
): J2SyntheticAccessProvisioningResult {
  return {
    documentId,
    status,
    accessModel: "J2_SYNTHETIC_ORACLE_POLICY_V1",
    secretHandles: Object.freeze({
      "teacher-a": FIXTURE_STATE.teachers[0]!.linkKeyHandle,
      "teacher-b": FIXTURE_STATE.teachers[1]!.linkKeyHandle
    }),
    aclResourceCount: 5,
    aclRuleCount: 13
  };
}

function buildActions(
  legacyResourceId: number,
  legacyRuleId: number,
  teachers: Record<J2TeacherId, TeacherRecord>,
  secrets: FixtureSecrets
): unknown[][] {
  const actions: unknown[][] = [
    ["UpdateRecord", "Enseignants", teachers["teacher-a"].id, { Token_Stages: secrets["teacher-a"] }],
    ["UpdateRecord", "Enseignants", teachers["teacher-b"].id, { Token_Stages: secrets["teacher-b"] }],
    ["RemoveRecord", "_grist_ACLRules", legacyRuleId],
    ["RemoveRecord", "_grist_ACLResources", legacyResourceId]
  ];

  for (const resource of expectedResources()) {
    actions.push(["AddRecord", "_grist_ACLResources", resource.id, resource.fields]);
  }
  for (const aclRule of expectedRules()) {
    actions.push(["AddRecord", "_grist_ACLRules", aclRule.id, aclRule.fields]);
  }
  return actions;
}

export class J2StageTrackingSyntheticAccessProvisioner {
  constructor(
    private readonly client: J2SyntheticAccessClient,
    private readonly vault: J2SyntheticLinkKeyVault
  ) {}

  async provision(authority: J2SyntheticAccessAuthority): Promise<J2SyntheticAccessProvisioningResult> {
    if (authority.ownerAuthorized !== true) {
      throw new Error("Synthetic AccessModel provisioning requires explicit owner authorization.");
    }
    const documentId = boundedAuthorityValue(authority.documentId, "documentId");
    boundedAuthorityValue(authority.principalId, "principalId");
    boundedAuthorityValue(authority.mandateId, "mandateId");

    const [stageColumnsRaw, teacherColumnsRaw, initialSnapshot] = await Promise.all([
      this.client.listColumns(documentId, "Stages"),
      this.client.listColumns(documentId, "Enseignants"),
      this.readSnapshot(documentId)
    ]);
    validateFixtureSchema(
      columnsFromResponse(stageColumnsRaw, "Stages"),
      columnsFromResponse(teacherColumnsRaw, "Enseignants")
    );
    const initialTeachers = teacherRecords(initialSnapshot.teachers);
    const secrets = await loadSecrets(this.vault);

    if (
      metadataMatches(initialSnapshot.resources, expectedResources()) &&
      metadataMatches(initialSnapshot.rules, expectedRules()) &&
      teacherTokensMatch(initialTeachers, secrets)
    ) {
      return result(documentId, "ALREADY_PROVISIONED");
    }

    if (
      !isLegacyPristineAcl(initialSnapshot.resources, initialSnapshot.rules) ||
      !teacherTokensAreEmpty(initialTeachers)
    ) {
      throw new Error(
        "Synthetic fixture AccessModel is neither pristine nor the exact managed J2 policy; refusing overwrite."
      );
    }

    const actions = buildActions(
      initialSnapshot.resources[0]!.id,
      initialSnapshot.rules[0]!.id,
      initialTeachers,
      secrets
    );

    let applyFailed = false;
    try {
      await this.client.applyUserActions(documentId, actions);
    } catch {
      applyFailed = true;
    }

    const postSnapshot = await this.readSnapshot(documentId);
    const postTeachers = teacherRecords(postSnapshot.teachers);
    const exactPostcondition =
      metadataMatches(postSnapshot.resources, expectedResources()) &&
      metadataMatches(postSnapshot.rules, expectedRules()) &&
      teacherTokensMatch(postTeachers, secrets);

    if (!exactPostcondition) {
      throw new Error(
        applyFailed
          ? "Synthetic AccessModel write outcome is uncertain; exact postcondition was not observed and the operation must not be replayed blindly."
          : "Synthetic AccessModel write returned but exact postcondition verification failed."
      );
    }

    return result(
      documentId,
      applyFailed ? "PROVISIONED_AFTER_UNCERTAIN_RESPONSE" : "PROVISIONED"
    );
  }

  private async readSnapshot(documentId: string): Promise<Snapshot> {
    const [teachersRaw, resourcesRaw, rulesRaw] = await Promise.all([
      this.client.queryRecords(documentId, "Enseignants", {
        limit: HARD_READ_LIMIT,
        cellFormat: "normal"
      }),
      this.client.queryRecords(documentId, "_grist_ACLResources", {
        limit: HARD_READ_LIMIT,
        hidden: true,
        cellFormat: "normal"
      }),
      this.client.queryRecords(documentId, "_grist_ACLRules", {
        limit: HARD_READ_LIMIT,
        hidden: true,
        cellFormat: "normal"
      })
    ]);
    return {
      teachers: recordsFromResponse(teachersRaw, "Enseignants"),
      resources: recordsFromResponse(resourcesRaw, "_grist_ACLResources"),
      rules: recordsFromResponse(rulesRaw, "_grist_ACLRules")
    };
  }
}
