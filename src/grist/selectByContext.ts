import type { DocumentUiContext, GristPageWidget } from "./documentUi.js";
import type { ColumnSelectByInput } from "./selectBy.js";

type JsonRecord = Record<string, unknown>;

const MAX_SELECT_BY_CONTEXT_COLUMNS = 5000;

interface TableIndexEntry {
  id: string;
  ref: number;
  columnsByRef: Map<number, string>;
}

interface SchemaIndex {
  byId: Map<string, TableIndexEntry>;
  byRef: Map<number, TableIndexEntry>;
  truncated: boolean;
}

export interface NormalizedSelectByContext {
  selectByNormalized?: ColumnSelectByInput;
  selectByNormalizationIncomplete: boolean;
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function buildIndex(tableResponse: unknown): SchemaIndex {
  const root = record(tableResponse);
  const tables = Array.isArray(root?.tables) ? root.tables : [];
  const byId = new Map<string, TableIndexEntry>();
  const byRef = new Map<number, TableIndexEntry>();

  for (const value of tables) {
    const table = record(value);
    const id = text(table?.id);
    const fields = record(table?.fields);
    const ref = positiveInteger(fields?.tableRef);
    if (!id || !ref) continue;
    const entry: TableIndexEntry = { id, ref, columnsByRef: new Map() };
    byId.set(id, entry);
    byRef.set(ref, entry);
  }

  let remainingColumns = MAX_SELECT_BY_CONTEXT_COLUMNS;
  let truncated = false;
  for (const value of tables) {
    const table = record(value);
    const id = text(table?.id);
    const entry = id ? byId.get(id) : undefined;
    if (!entry) continue;
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    if (columns.length > remainingColumns) truncated = true;
    const limit = Math.min(columns.length, remainingColumns);
    for (let index = 0; index < limit; index++) {
      const column = record(columns[index]);
      const columnId = text(column?.id);
      const fields = record(column?.fields);
      const columnRef = positiveInteger(fields?.colRef);
      if (columnId && columnRef) entry.columnsByRef.set(columnRef, columnId);
    }
    remainingColumns -= limit;
    if (remainingColumns === 0) {
      if (
        tables.slice(tables.indexOf(value) + 1).some((candidate) => {
          const next = record(candidate);
          return Array.isArray(next?.columns) && next.columns.length > 0;
        })
      ) {
        truncated = true;
      }
      break;
    }
  }

  return { byId, byRef, truncated };
}

function tableForWidget(
  widget: GristPageWidget,
  schema: SchemaIndex
): TableIndexEntry | undefined {
  return (
    (widget.tableId ? schema.byId.get(widget.tableId) : undefined) ??
    schema.byRef.get(widget.tableRef)
  );
}

export function normalizeExistingSelectBy(
  context: DocumentUiContext,
  tableResponse: unknown,
  target: GristPageWidget
): NormalizedSelectByContext | undefined {
  const raw = target.selectBy;
  if (!raw) return undefined;

  const source = context.pages
    .find((page) => page.id === target.pageId)
    ?.widgets.find((widget) => widget.id === raw.sourceSectionId);
  if (!source) {
    return { selectByNormalizationIncomplete: true };
  }

  const sourceRef = raw.sourceColumnRef;
  const targetRef = raw.targetColumnRef;
  if (sourceRef === undefined && targetRef === undefined) {
    return {
      selectByNormalized: { sourceWidgetId: source.id },
      selectByNormalizationIncomplete: false
    };
  }

  const schema = buildIndex(tableResponse);
  const sourceTable = tableForWidget(source, schema);
  const targetTable = tableForWidget(target, schema);
  if (!sourceTable || !targetTable) {
    return { selectByNormalizationIncomplete: true };
  }

  const sourceColumnId =
    sourceRef !== undefined ? sourceTable.columnsByRef.get(sourceRef) : undefined;
  const targetColumnId =
    targetRef !== undefined ? targetTable.columnsByRef.get(targetRef) : undefined;

  if (
    (sourceRef !== undefined && sourceColumnId === undefined) ||
    (targetRef !== undefined && targetColumnId === undefined)
  ) {
    return { selectByNormalizationIncomplete: true };
  }

  return {
    selectByNormalized: {
      sourceWidgetId: source.id,
      ...(sourceColumnId !== undefined ? { sourceColumnId } : {}),
      ...(targetColumnId !== undefined ? { targetColumnId } : {})
    },
    selectByNormalizationIncomplete: false
  };
}
