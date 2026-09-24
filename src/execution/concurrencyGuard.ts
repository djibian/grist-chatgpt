import { getOperation } from "../operations/registry.js";

export type OperationConcurrencyClass =
  | "READ_ONLY"
  | "ADDITIVE"
  | "OVERWRITE_SENSITIVE";

const ADDITIVE_OPERATIONS = new Set([
  "create_records",
  "create_tables",
  "create_columns",
  "create_page",
  "add_page_widget"
]);

const OVERWRITE_SENSITIVE_OPERATIONS = new Set([
  "update_records",
  "delete_records",
  "update_tables",
  "delete_table",
  "update_columns",
  "rename_column",
  "delete_columns",
  "rename_page",
  "update_page_layout",
  "update_page_widget"
]);

export class ConcurrencyProtectionUnavailableError extends Error {
  constructor(public readonly operation: string) {
    super(
      `Operation "${operation}" may overwrite or erase concurrent human changes and has no proven direct concurrency protection. Contractual direct execution is refused; use an effectively isolated execution mode when one is implemented and verified.`
    );
    this.name = "ConcurrencyProtectionUnavailableError";
  }
}

export function getOperationConcurrencyClass(
  operationName: string
): OperationConcurrencyClass {
  const operation = getOperation(operationName);

  if (operation.readOnly || operation.auditOnly) return "READ_ONLY";
  if (ADDITIVE_OPERATIONS.has(operation.name)) return "ADDITIVE";
  if (OVERWRITE_SENSITIVE_OPERATIONS.has(operation.name)) {
    return "OVERWRITE_SENSITIVE";
  }

  // New mutation operations must be classified explicitly before they are
  // eligible for contractual execution. This keeps future registry growth
  // fail-closed rather than accidentally inheriting a permissive default.
  throw new ConcurrencyProtectionUnavailableError(operation.name);
}

export async function executeDirectContractualOperation<T>(
  operationName: string,
  action: () => Promise<T>
): Promise<T> {
  const concurrencyClass = getOperationConcurrencyClass(operationName);
  if (concurrencyClass === "OVERWRITE_SENSITIVE") {
    throw new ConcurrencyProtectionUnavailableError(operationName);
  }
  return action();
}
