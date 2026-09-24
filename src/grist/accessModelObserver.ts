import { createHash } from "node:crypto";

import type { GristService } from "./service.js";

const HARD_METADATA_LIMIT = 2_000;
const MAX_IDENTIFIER_LENGTH = 160;
const PERMISSION_KEYS = ["create", "read", "update", "delete", "schemaEdit"] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];
type PermissionDecision = "allow" | "deny" | "unchanged";

export interface AccessModelObservationAuthority {
  documentId: string;
  principalId: string;
  mandateId: string;
  ownerAuthorized: boolean;
}

export interface AccessModelResource {
  id: number;
  tableId: string;
  columnIds: "*" | string[];
  defaultResource: boolean;
}

export interface AccessModelUserAttribute {
  name: string;
  tableId: string;
  lookupColumnId: string;
  userCharacteristic: string;
}

export interface AccessModelRule {
  id: number;
  resourceId: number;
  position: number | null;
  permissions: Record<PermissionKey, PermissionDecision>;
  defaultRule: boolean;
  userAttribute: AccessModelUserAttribute | null;
  dependencies: {
    userAttributes: string[];
    recordFields: string[];
    usesLinkKey: boolean;
    usesSuiviPar: boolean;
    usesAccesStagesActif: boolean;
  };
  dependencyExtractionComplete: boolean;
}

export interface AccessModelObservation {
  documentId: string;
  principalId: string;
  mandateId: string;
  observationMode: "owner-authorized-internal-read";
  schemaVersion: number | null;
  metadataFingerprint: string;
  completeness: "COMPLETE" | "PARTIAL";
  resources: AccessModelResource[];
  rules: AccessModelRule[];
  sharing: {
    shareCount: number;
    publishedShareCount: number;
    virtualRuleContext: "NOT_APPLICABLE" | "UNKNOWN";
  };
  issues: string[];
}

interface MetadataReader {
  readonly maxReadRecords: number;
  queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options?: {
      limit?: number;
      hidden?: boolean;
      cellFormat?: "normal" | "typed";
    }
  ): Promise<unknown>;
}

interface MetadataRecord {
  id: number;
  fields: Record<string, unknown>;
}

interface RawSnapshot {
  resources: unknown;
  rules: unknown;
  shares: unknown;
  docInfo: unknown;
}

function boundedIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > MAX_IDENTIFIER_LENGTH) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value) && value !== "*") return null;
  return value;
}

function boundedAuthorityValue(value: string, label: string): string {
  if (!value || value.length > 256 || /[?#]/.test(value) || /^https?:\/\//i.test(value)) {
    throw new Error(`${label} must be a bounded non-URL identifier without query or fragment data.`);
  }
  return value;
}

function recordsFromResponse(value: unknown): MetadataRecord[] | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const records = (value as Record<string, unknown>).records;
  if (!Array.isArray(records)) return null;

  const normalized: MetadataRecord[] = [];
  for (const candidate of records) {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const record = candidate as Record<string, unknown>;
    if (!Number.isInteger(record.id) || (record.id as number) === 0) return null;
    if (record.fields === null || typeof record.fields !== "object" || Array.isArray(record.fields)) {
      return null;
    }
    normalized.push({
      id: record.id as number,
      fields: record.fields as Record<string, unknown>
    });
  }
  return normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key])])
  );
}

function fingerprint(snapshot: RawSnapshot): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)), "utf8")
    .digest("hex");
}

function parseColumnIds(value: unknown): "*" | string[] | null {
  if (value === "*") return "*";
  if (typeof value !== "string") return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const safe = parts.map(boundedIdentifier);
  if (safe.some((part) => part === null)) return null;
  return safe as string[];
}

function emptyPermissions(): Record<PermissionKey, PermissionDecision> {
  return {
    create: "unchanged",
    read: "unchanged",
    update: "unchanged",
    delete: "unchanged",
    schemaEdit: "unchanged"
  };
}

function parsePermissions(value: unknown): Record<PermissionKey, PermissionDecision> | null {
  if (typeof value !== "string") return null;
  const text = value === "all" ? "+CRUDS" : value === "none" ? "-CRUDS" : value;
  const permissions = emptyPermissions();
  const keys: Record<string, PermissionKey> = {
    C: "create",
    R: "read",
    U: "update",
    D: "delete",
    S: "schemaEdit"
  };
  let decision: PermissionDecision | null = null;
  const seen = new Set<PermissionKey>();

  for (const character of text) {
    if (character === "+") {
      decision = "allow";
      continue;
    }
    if (character === "-") {
      decision = "deny";
      continue;
    }
    const key = keys[character];
    if (!key || !decision || seen.has(key)) return null;
    permissions[key] = decision;
    seen.add(key);
  }
  return permissions;
}

function attrPath(node: unknown): string[] | null {
  if (!Array.isArray(node) || node.length < 2) return null;
  if (node[0] === "Name" && typeof node[1] === "string") {
    return boundedIdentifier(node[1]) ? [node[1]] : null;
  }
  if (node[0] === "Attr" && node.length >= 3 && typeof node[2] === "string") {
    const base = attrPath(node[1]);
    const attribute = boundedIdentifier(node[2]);
    return base && attribute ? [...base, attribute] : null;
  }
  return null;
}

function collectAttributePaths(node: unknown, paths: Set<string>, state: { complete: boolean }): void {
  if (!Array.isArray(node)) return;
  if (node[0] === "Attr") {
    const path = attrPath(node);
    if (path && path.length >= 2) {
      paths.add(path.join("."));
    } else {
      state.complete = false;
    }
  }
  for (const child of node.slice(1)) collectAttributePaths(child, paths, state);
}

function dependenciesFromParsedFormula(
  parsedFormula: unknown,
  formulaPresent: boolean
): {
  userAttributes: string[];
  recordFields: string[];
  complete: boolean;
} {
  if (!formulaPresent) {
    return { userAttributes: [], recordFields: [], complete: true };
  }
  if (typeof parsedFormula !== "string" || !parsedFormula) {
    return { userAttributes: [], recordFields: [], complete: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(parsedFormula);
  } catch {
    return { userAttributes: [], recordFields: [], complete: false };
  }

  const paths = new Set<string>();
  const state = { complete: true };
  collectAttributePaths(parsed, paths, state);
  const userAttributes = [...paths]
    .filter((path) => path.startsWith("user."))
    .map((path) => path.slice("user.".length))
    .sort();
  const recordFields = [...paths]
    .filter((path) => path.startsWith("rec."))
    .map((path) => path.slice("rec.".length))
    .sort();
  return { userAttributes, recordFields, complete: state.complete };
}

function parseUserAttribute(value: unknown): AccessModelUserAttribute | null | "invalid" {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string") return "invalid";

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return "invalid";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const record = parsed as Record<string, unknown>;
  const name = boundedIdentifier(record.name);
  const tableId = boundedIdentifier(record.tableId);
  const lookupColumnId = boundedIdentifier(record.lookupColId);
  const userCharacteristic = boundedIdentifier(record.charId);
  if (!name || !tableId || !lookupColumnId || !userCharacteristic) return "invalid";
  return { name, tableId, lookupColumnId, userCharacteristic };
}

function publishedShareCount(records: MetadataRecord[]): { count: number; complete: boolean } {
  let count = 0;
  let complete = true;
  for (const record of records) {
    const options = record.fields.options;
    if (options === "" || options === null || options === undefined) continue;
    if (typeof options !== "string") {
      complete = false;
      continue;
    }
    try {
      const parsed = JSON.parse(options) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        if ((parsed as Record<string, unknown>).publish === true) count += 1;
      } else {
        complete = false;
      }
    } catch {
      complete = false;
    }
  }
  return { count, complete };
}

function schemaVersion(records: MetadataRecord[]): number | null {
  if (records.length !== 1) return null;
  const value = records[0]!.fields.schemaVersion;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export class AccessModelObserver {
  constructor(private readonly reader: MetadataReader) {}

  async observe(authority: AccessModelObservationAuthority): Promise<AccessModelObservation> {
    if (authority.ownerAuthorized !== true) {
      throw new Error("AccessModel observation requires explicit owner authorization.");
    }
    const documentId = boundedAuthorityValue(authority.documentId, "documentId");
    const principalId = boundedAuthorityValue(authority.principalId, "principalId");
    const mandateId = boundedAuthorityValue(authority.mandateId, "mandateId");
    const limit =
      this.reader.maxReadRecords > 0
        ? Math.min(this.reader.maxReadRecords, HARD_METADATA_LIMIT)
        : HARD_METADATA_LIMIT;

    const [resourcesRaw, rulesRaw, sharesRaw, docInfoRaw] = await Promise.all([
      this.reader.queryRecords(documentId, "_grist_ACLResources", { limit, hidden: true }),
      this.reader.queryRecords(documentId, "_grist_ACLRules", { limit, hidden: true }),
      this.reader.queryRecords(documentId, "_grist_Shares", { limit, hidden: true }),
      this.reader.queryRecords(documentId, "_grist_DocInfo", { limit: 2, hidden: true })
    ]);
    const snapshot: RawSnapshot = {
      resources: resourcesRaw,
      rules: rulesRaw,
      shares: sharesRaw,
      docInfo: docInfoRaw
    };

    const resourceRecords = recordsFromResponse(resourcesRaw);
    const ruleRecords = recordsFromResponse(rulesRaw);
    const shareRecords = recordsFromResponse(sharesRaw);
    const docInfoRecords = recordsFromResponse(docInfoRaw);
    if (!resourceRecords || !ruleRecords || !shareRecords || !docInfoRecords) {
      throw new Error("Grist returned an unsupported internal metadata response shape.");
    }

    const issues = new Set<string>();
    if (
      resourceRecords.length >= limit ||
      ruleRecords.length >= limit ||
      shareRecords.length >= limit
    ) {
      issues.add("metadata_limit_reached");
    }

    const resources: AccessModelResource[] = [];
    const resourceIds = new Set<number>();
    for (const record of resourceRecords) {
      const tableId = boundedIdentifier(record.fields.tableId);
      const columnIds = parseColumnIds(record.fields.colIds);
      if (!tableId || columnIds === null) {
        issues.add("unsupported_acl_resource");
        continue;
      }
      if (resourceIds.has(record.id)) {
        issues.add("duplicate_acl_resource_id");
        continue;
      }
      resourceIds.add(record.id);
      resources.push({
        id: record.id,
        tableId,
        columnIds,
        defaultResource: tableId === "*" && columnIds === "*"
      });
    }
    resources.sort((a, b) => a.id - b.id);

    const rules: AccessModelRule[] = [];
    for (const record of ruleRecords) {
      const resourceId = record.fields.resource;
      if (!Number.isInteger(resourceId) || !resourceIds.has(resourceId as number)) {
        issues.add("invalid_acl_rule_resource");
        continue;
      }
      const permissions = parsePermissions(record.fields.permissionsText);
      if (!permissions) {
        issues.add("unsupported_acl_permissions");
        continue;
      }
      const formulaPresent =
        typeof record.fields.aclFormula === "string" && record.fields.aclFormula.length > 0;
      const dependencies = dependenciesFromParsedFormula(
        record.fields.aclFormulaParsed,
        formulaPresent
      );
      if (!dependencies.complete) issues.add("acl_formula_dependency_unknown");

      const userAttribute = parseUserAttribute(record.fields.userAttributes);
      if (userAttribute === "invalid") issues.add("user_attribute_unknown");
      const safeUserAttribute = userAttribute === "invalid" ? null : userAttribute;
      const allDependencyNames = new Set([
        ...dependencies.userAttributes,
        ...dependencies.recordFields,
        ...(safeUserAttribute
          ? [
              safeUserAttribute.name,
              safeUserAttribute.tableId,
              safeUserAttribute.lookupColumnId,
              safeUserAttribute.userCharacteristic
            ]
          : [])
      ]);
      const position =
        typeof record.fields.rulePos === "number" && Number.isFinite(record.fields.rulePos)
          ? record.fields.rulePos
          : null;
      if (position === null) issues.add("rule_position_unknown");

      const resource = resources.find((candidate) => candidate.id === resourceId);
      rules.push({
        id: record.id,
        resourceId: resourceId as number,
        position,
        permissions,
        defaultRule: Boolean(resource?.defaultResource),
        userAttribute: safeUserAttribute,
        dependencies: {
          userAttributes: dependencies.userAttributes,
          recordFields: dependencies.recordFields,
          usesLinkKey: [...allDependencyNames].some((name) => name === "LinkKey" || name.startsWith("LinkKey.")),
          usesSuiviPar: allDependencyNames.has("Suivi_par"),
          usesAccesStagesActif: allDependencyNames.has("Acces_Stages_Actif")
        },
        dependencyExtractionComplete: dependencies.complete && userAttribute !== "invalid"
      });
    }
    rules.sort((a, b) => {
      if (a.position === null && b.position === null) return a.id - b.id;
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position || a.id - b.id;
    });

    const published = publishedShareCount(shareRecords);
    if (!published.complete) issues.add("share_options_unknown");
    if (shareRecords.length > 0) issues.add("virtual_share_rules_unknown");
    const version = schemaVersion(docInfoRecords);
    if (version === null) issues.add("schema_version_unknown");

    return {
      documentId,
      principalId,
      mandateId,
      observationMode: "owner-authorized-internal-read",
      schemaVersion: version,
      metadataFingerprint: fingerprint(snapshot),
      completeness: issues.size === 0 ? "COMPLETE" : "PARTIAL",
      resources,
      rules,
      sharing: {
        shareCount: shareRecords.length,
        publishedShareCount: published.count,
        virtualRuleContext: shareRecords.length === 0 ? "NOT_APPLICABLE" : "UNKNOWN"
      },
      issues: [...issues].sort()
    };
  }
}

export type AccessModelMetadataReader = Pick<GristService, "maxReadRecords" | "queryRecords">;
