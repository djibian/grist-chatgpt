import type { GristCapability } from "../auth/principal.js";

export type OperationCategory =
  | "discovery"
  | "data"
  | "schema"
  | "context"
  | "ui"
  | "utility";

export interface OperationDefinition {
  name: string;
  category: OperationCategory;
  capability: GristCapability | null;
  readOnly: boolean;
  destructive: boolean;
  summary: string;
}

export const OPERATION_REGISTRY: readonly OperationDefinition[] = [
  { name: "list_documents", category: "discovery", capability: "doc:read", readOnly: true, destructive: false, summary: "List documents visible to the current principal." },
  { name: "list_tables", category: "discovery", capability: "doc:read", readOnly: true, destructive: false, summary: "List tables in one document." },
  { name: "list_columns", category: "discovery", capability: "doc:read", readOnly: true, destructive: false, summary: "List columns and metadata in one table." },
  { name: "query_records", category: "data", capability: "doc:read", readOnly: true, destructive: false, summary: "Read, filter and sort records." },
  { name: "create_records", category: "data", capability: "doc:write", readOnly: false, destructive: false, summary: "Create records." },
  { name: "update_records", category: "data", capability: "doc:write", readOnly: false, destructive: false, summary: "Update records by explicit ID." },
  { name: "delete_records", category: "data", capability: "doc:write", readOnly: false, destructive: true, summary: "Delete records by explicit ID." },
  { name: "create_tables", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: false, summary: "Create tables and optional initial columns." },
  { name: "update_tables", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: false, summary: "Update table metadata or identifiers." },
  { name: "delete_table", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: true, summary: "Delete one explicitly identified table." },
  { name: "create_columns", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: false, summary: "Create columns." },
  { name: "update_columns", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: false, summary: "Update column metadata, types or formulas." },
  { name: "rename_column", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: false, summary: "Rename one column identifier." },
  { name: "delete_columns", category: "schema", capability: "doc.schema:write", readOnly: false, destructive: true, summary: "Delete explicitly identified columns." },
  { name: "inspect_document", category: "context", capability: "doc:read", readOnly: true, destructive: false, summary: "Build a compact semantic view of tables, columns, formulas, relationships, pages and widgets." },
  { name: "get_pages", category: "ui", capability: "doc:read", readOnly: true, destructive: false, summary: "List Grist pages and their widget IDs without reading row data." },
  { name: "get_page_widgets", category: "ui", capability: "doc:read", readOnly: true, destructive: false, summary: "Inspect normalized page widget metadata and select-by links." },
  { name: "grist_help", category: "utility", capability: null, readOnly: true, destructive: false, summary: "Discover bridge operations and their required capabilities." }
] as const;

const OPERATION_MAP = new Map(OPERATION_REGISTRY.map((operation) => [operation.name, operation]));

export function getOperation(name: string): OperationDefinition {
  const operation = OPERATION_MAP.get(name);
  if (!operation) throw new Error(`Unknown operation "${name}".`);
  return operation;
}

export function getRequiredCapability(name: string): GristCapability {
  const operation = getOperation(name);
  if (!operation.capability) {
    throw new Error(`Operation "${name}" does not target a Grist document capability.`);
  }
  return operation.capability;
}

export function operationHelp(names?: readonly string[]): { operations: OperationDefinition[] } {
  if (!names || names.length === 0) {
    return { operations: [...OPERATION_REGISTRY] };
  }
  return { operations: names.map(getOperation) };
}
