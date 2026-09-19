import type { GristPageWidget } from "./documentUi.js";

type JsonRecord = Record<string, unknown>;

export const MAX_WIDGET_SORT_COLUMNS = 20;
const MAX_WIDGET_SORT_SCHEMA_COLUMNS = 5000;

export const WIDGET_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type WidgetSortDirection = (typeof WIDGET_SORT_DIRECTIONS)[number];

export interface WidgetSortInput {
  columnId: string;
  direction: WidgetSortDirection;
  emptyLast?: boolean | undefined;
  naturalSort?: boolean | undefined;
  orderByChoice?: boolean | undefined;
}

export type ResolvedWidgetSortSpec = number | string;

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

function tableForWidget(widget: GristPageWidget, tableResponse: unknown): JsonRecord {
  const root = record(tableResponse);
  const tables = Array.isArray(root?.tables) ? root.tables : [];
  const table = tables
    .map(record)
    .find((candidate) => {
      if (!candidate) return false;
      const fields = record(candidate.fields);
      return (
        (widget.tableId !== undefined && candidate.id === widget.tableId) ||
        positiveInteger(fields?.tableRef) === widget.tableRef
      );
    });
  if (!table) {
    throw new Error(
      `Widget ${widget.id} table metadata is unavailable; refusing to configure saved sort.`
    );
  }
  return table;
}

function encodeSortSpec(input: WidgetSortInput, colRef: number): ResolvedWidgetSortSpec {
  const signed = input.direction === "desc" ? -colRef : colRef;
  const flags: string[] = [];
  if (input.emptyLast) flags.push("emptyLast");
  if (input.naturalSort) flags.push("naturalSort");
  if (input.orderByChoice) flags.push("orderByChoice");
  return flags.length === 0 ? signed : `${signed}:${flags.join(";")}`;
}

export function resolveWidgetSort(
  widget: GristPageWidget,
  tableResponse: unknown,
  sort: readonly WidgetSortInput[] | null
): ResolvedWidgetSortSpec[] {
  if (sort === null || sort.length === 0) return [];
  if (sort.length > MAX_WIDGET_SORT_COLUMNS) {
    throw new Error(
      `Widget saved sort is limited to ${MAX_WIDGET_SORT_COLUMNS} columns per update.`
    );
  }

  const table = tableForWidget(widget, tableResponse);
  const columns = Array.isArray(table.columns) ? table.columns : [];
  if (columns.length > MAX_WIDGET_SORT_SCHEMA_COLUMNS) {
    throw new Error(
      `Widget table exposes more than ${MAX_WIDGET_SORT_SCHEMA_COLUMNS} columns; refusing ambiguous saved-sort resolution.`
    );
  }

  const byId = new Map<
    string,
    { ref: number; type: string | undefined }
  >();
  for (const value of columns) {
    const column = record(value);
    const id = text(column?.id);
    const fields = record(column?.fields);
    const ref = positiveInteger(fields?.colRef);
    if (id && ref) {
      byId.set(id, { ref, type: text(fields?.type) });
    }
  }

  const seen = new Set<string>();
  return sort.map((input) => {
    const columnId = input.columnId.trim();
    if (!columnId) throw new Error("Widget sort column ID must not be empty.");
    if (!WIDGET_SORT_DIRECTIONS.includes(input.direction)) {
      throw new Error(`Unsupported widget sort direction "${input.direction}".`);
    }
    if (seen.has(columnId)) {
      throw new Error(`Widget sort column "${columnId}" is duplicated.`);
    }
    seen.add(columnId);

    const column = byId.get(columnId);
    if (!column) {
      throw new Error(
        `Column "${columnId}" does not exist on widget ${widget.id}'s table.`
      );
    }
    if (input.naturalSort && column.type !== "Text") {
      throw new Error(
        `naturalSort is limited to Text columns; "${columnId}" has type "${column.type ?? "unknown"}".`
      );
    }
    if (
      input.orderByChoice &&
      column.type !== "Choice" &&
      column.type !== "ChoiceList"
    ) {
      throw new Error(
        `orderByChoice is limited to Choice/ChoiceList columns; "${columnId}" has type "${column.type ?? "unknown"}".`
      );
    }
    return encodeSortSpec({ ...input, columnId }, column.ref);
  });
}
