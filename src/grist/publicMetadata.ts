type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function publicColumn(entry: unknown): { id: string; fields: JsonRecord } {
  const column = record(entry);
  const id = typeof column?.id === "string" ? column.id : undefined;
  const fields = record(column?.fields);
  if (!id || !fields) {
    throw new Error("Unexpected Grist column metadata shape.");
  }

  const projected: JsonRecord = {};
  if (typeof fields.label === "string") projected.label = fields.label;
  if (typeof fields.type === "string") projected.type = fields.type;
  if (typeof fields.isFormula === "boolean") projected.isFormula = fields.isFormula;
  if (typeof fields.formula === "string") projected.formula = fields.formula;
  if (typeof fields.description === "string") projected.description = fields.description;
  if (typeof fields.widgetOptions === "string") {
    projected.widgetOptions = fields.widgetOptions;
  }

  return { id, fields: projected };
}

function tableEntries(value: unknown): unknown[] {
  const root = record(value);
  if (!root || !Array.isArray(root.tables)) {
    throw new Error("Unexpected Grist table metadata response shape.");
  }
  return root.tables;
}

function columnEntries(value: unknown): unknown[] {
  const root = record(value);
  if (!root || !Array.isArray(root.columns)) {
    throw new Error("Unexpected Grist column metadata response shape.");
  }
  return root.columns;
}

/**
 * Project Grist's intentionally open-ended table metadata response to the
 * bounded metadata contract exposed to models. Internal numeric metadata refs
 * remain available to the bridge through the raw service path but are not
 * copied into the public response.
 */
export function projectPublicTables(value: unknown): unknown {
  const entries = tableEntries(value);
  const tableIdByRef = new Map<number, string>();

  for (const entry of entries) {
    const table = record(entry);
    const id = typeof table?.id === "string" ? table.id : undefined;
    const fields = record(table?.fields);
    const tableRef = positiveInteger(fields?.tableRef);
    if (!id || !fields) {
      throw new Error("Unexpected Grist table metadata shape.");
    }
    if (tableRef !== undefined) tableIdByRef.set(tableRef, id);
  }

  return {
    tables: entries.map((entry) => {
      const table = record(entry)!;
      const id = table.id as string;
      const fields = record(table.fields)!;
      const projected: JsonRecord = {};

      if (typeof fields.onDemand === "boolean") projected.onDemand = fields.onDemand;

      const summarySourceRef = positiveInteger(fields.summarySourceTable);
      if (summarySourceRef !== undefined) {
        projected.isSummary = true;
        const sourceId = tableIdByRef.get(summarySourceRef);
        if (sourceId !== undefined) projected.summarySourceTableId = sourceId;
      } else {
        projected.isSummary = false;
      }

      const columns = Array.isArray(table.columns)
        ? table.columns.map(publicColumn)
        : undefined;

      return {
        id,
        fields: projected,
        ...(columns !== undefined ? { columns } : {})
      };
    })
  };
}

/** Project the public list_columns response without internal engine refs. */
export function projectPublicColumns(value: unknown): unknown {
  return { columns: columnEntries(value).map(publicColumn) };
}
