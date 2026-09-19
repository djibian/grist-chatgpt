import type { DocumentUiContext, GristPageWidget } from "./documentUi.js";

type JsonRecord = Record<string, unknown>;

const MAX_SELECT_BY_SCHEMA_COLUMNS = 5000;

interface SelectByColumn {
  id: string;
  ref: number;
  targetTableId: string;
}

interface SelectByTable {
  id: string;
  ref: number;
  isSummary: boolean;
  columns: SelectByColumn[];
}

interface SelectBySchemaIndex {
  byId: Map<string, SelectByTable>;
  byRef: Map<number, SelectByTable>;
  truncated: boolean;
}

interface SelectByNode {
  logicalTableId: string;
  columnId?: string;
  columnRef?: number;
}

export interface ColumnSelectByInput {
  sourceWidgetId: number;
  sourceColumnId?: string | undefined;
  targetColumnId?: string | undefined;
}

export interface ColumnSelectByOption extends ColumnSelectByInput {}

export interface ResolvedSelectByRefs {
  sourceSectionId: number;
  sourceColumnRef?: number;
  targetColumnRef?: number;
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

function buildSelectBySchemaIndex(tableResponse: unknown): SelectBySchemaIndex {
  const root = record(tableResponse);
  const tables = Array.isArray(root?.tables) ? root.tables : [];
  const byId = new Map<string, SelectByTable>();
  const byRef = new Map<number, SelectByTable>();

  for (const value of tables) {
    const table = record(value);
    const id = text(table?.id);
    const fields = record(table?.fields);
    const ref = positiveInteger(fields?.tableRef);
    if (!id || !ref) continue;
    const parsed: SelectByTable = {
      id,
      ref,
      isSummary: positiveInteger(fields?.summarySourceTable) !== undefined,
      columns: []
    };
    byId.set(id, parsed);
    byRef.set(ref, parsed);
  }

  let remainingColumns = MAX_SELECT_BY_SCHEMA_COLUMNS;
  let truncated = false;
  for (const value of tables) {
    const table = record(value);
    const id = text(table?.id);
    const parsed = id ? byId.get(id) : undefined;
    if (!parsed) continue;
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    if (columns.length > remainingColumns) truncated = true;
    const limit = Math.min(columns.length, remainingColumns);
    for (let index = 0; index < limit; index++) {
      const column = record(columns[index]);
      const columnId = text(column?.id);
      const fields = record(column?.fields);
      const colRef = positiveInteger(fields?.colRef);
      const type = text(fields?.type);
      const match = type ? /^(Ref|RefList):(.+)$/.exec(type) : null;
      if (!columnId || !colRef || !match) continue;
      const targetTableId = match[2];
      const targetTable = targetTableId ? byId.get(targetTableId) : undefined;
      if (!targetTable || targetTable.isSummary) continue;
      parsed.columns.push({ id: columnId, ref: colRef, targetTableId: targetTable.id });
    }
    remainingColumns -= limit;
    if (remainingColumns === 0) {
      if (tables.slice(tables.indexOf(value) + 1).some((entry) => {
        const next = record(entry);
        return Array.isArray(next?.columns) && next.columns.length > 0;
      })) {
        truncated = true;
      }
      break;
    }
  }

  return { byId, byRef, truncated };
}

function tableForWidget(
  widget: GristPageWidget,
  schema: SelectBySchemaIndex
): SelectByTable | undefined {
  const table =
    (widget.tableId ? schema.byId.get(widget.tableId) : undefined) ??
    schema.byRef.get(widget.tableRef);
  return table && !table.isSummary ? table : undefined;
}

function nodesForWidget(
  widget: GristPageWidget,
  schema: SelectBySchemaIndex
): SelectByNode[] {
  const table = tableForWidget(widget, schema);
  if (!table) return [];
  return [
    { logicalTableId: table.id },
    ...table.columns.map((column) => ({
      logicalTableId: column.targetTableId,
      columnId: column.id,
      columnRef: column.ref
    }))
  ];
}

function nodeForColumnId(
  widget: GristPageWidget,
  schema: SelectBySchemaIndex,
  columnId: string | undefined
): SelectByNode {
  const table = tableForWidget(widget, schema);
  if (!table) {
    throw new Error(
      `Widget ${widget.id} is backed by a summary or unavailable table and is outside this bounded select-by subset.`
    );
  }
  if (columnId === undefined) return { logicalTableId: table.id };
  const column = table.columns.find((candidate) => candidate.id === columnId);
  if (!column) {
    throw new Error(
      `Column "${columnId}" is not a supported Ref/RefList select-by column for widget ${widget.id}.`
    );
  }
  return {
    logicalTableId: column.targetTableId,
    columnId: column.id,
    columnRef: column.ref
  };
}

// One index per snapshot, and one graph walk per source, shared across targets.
function selectByGraphValidator(context: DocumentUiContext) {
  const widgets = new Map(
    context.pages.flatMap((page) => page.widgets.map((widget) => [widget.id, widget] as const))
  );
  const paths = new Map<number, { ancestors: Set<number>; cycle: boolean }>();
  return (source: GristPageWidget, target: GristPageWidget): void => {
    if (source.id === target.id) throw new Error("A Grist widget cannot select itself.");
    if (source.pageId !== target.pageId) {
      throw new Error("Select-by is limited to widgets on the same Grist page.");
    }
    if (source.type === "chart" || source.type === "custom") {
      throw new Error(
        `Widget type "${source.type}" is not allowed as a select-by source in this safe subset.`
      );
    }
    let path = paths.get(source.id);
    if (!path) {
      const ancestors = new Set<number>();
      const visited = new Set<number>();
      let current: GristPageWidget | undefined = source;
      let cycle = false;
      while (current?.selectBy?.sourceSectionId) {
        if (visited.has(current.id)) {
          cycle = true;
          break;
        }
        visited.add(current.id);
        ancestors.add(current.selectBy.sourceSectionId);
        current = widgets.get(current.selectBy.sourceSectionId);
      }
      path = { ancestors, cycle };
      paths.set(source.id, path);
    }
    if (path.ancestors.has(target.id)) {
      throw new Error("The requested select-by link would create a cycle; refusing the update.");
    }
    if (path.cycle) {
      throw new Error("The existing select-by graph already contains a cycle; refusing to modify it.");
    }
  };
}

export function directSelectByValidator(context: DocumentUiContext) {
  const assertGraphSafe = selectByGraphValidator(context);
  return (source: GristPageWidget, target: GristPageWidget): void => {
    assertGraphSafe(source, target);
    if (source.tableRef !== target.tableRef || source.tableId !== target.tableId) {
      throw new Error(
        "This tranche only allows direct select-by between widgets backed by the same Grist table."
      );
    }
  };
}

export function assertDirectSelectByAllowed(
  context: DocumentUiContext,
  source: GristPageWidget,
  target: GristPageWidget
): void {
  directSelectByValidator(context)(source, target);
}

export function discoverColumnSelectByOptions(
  context: DocumentUiContext,
  tableResponse: unknown,
  target: GristPageWidget,
  limits: { maxOptions?: number; maxCandidates?: number } = {}
): { options: ColumnSelectByOption[]; truncated: boolean } {
  const maxOptions = limits.maxOptions ?? 1000;
  const maxCandidates = limits.maxCandidates ?? 10000;
  const schema = buildSelectBySchemaIndex(tableResponse);
  const targetNodes = nodesForWidget(target, schema);
  const page = context.pages.find((candidate) => candidate.id === target.pageId);
  if (!page || targetNodes.length === 0) {
    return { options: [], truncated: schema.truncated };
  }

  const assertGraphSafe = selectByGraphValidator(context);
  const options: ColumnSelectByOption[] = [];
  let candidates = 0;
  let truncated = schema.truncated;

  outer: for (const source of page.widgets) {
    try {
      assertGraphSafe(source, target);
    } catch {
      continue;
    }
    const sourceNodes = nodesForWidget(source, schema);
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        if (sourceNode.columnId === undefined && targetNode.columnId === undefined) continue;
        if (candidates >= maxCandidates || options.length >= maxOptions) {
          truncated = true;
          break outer;
        }
        candidates++;
        if (sourceNode.logicalTableId !== targetNode.logicalTableId) continue;
        options.push({
          sourceWidgetId: source.id,
          ...(sourceNode.columnId !== undefined
            ? { sourceColumnId: sourceNode.columnId }
            : {}),
          ...(targetNode.columnId !== undefined
            ? { targetColumnId: targetNode.columnId }
            : {})
        });
      }
    }
  }

  return { options, truncated };
}

export function resolveColumnSelectByAllowed(
  context: DocumentUiContext,
  tableResponse: unknown,
  source: GristPageWidget,
  target: GristPageWidget,
  input: ColumnSelectByInput
): ResolvedSelectByRefs {
  if (input.sourceColumnId === undefined && input.targetColumnId === undefined) {
    throw new Error("At least one select-by column ID is required for a column link.");
  }
  selectByGraphValidator(context)(source, target);
  const schema = buildSelectBySchemaIndex(tableResponse);
  const sourceNode = nodeForColumnId(source, schema, input.sourceColumnId);
  const targetNode = nodeForColumnId(target, schema, input.targetColumnId);
  if (sourceNode.logicalTableId !== targetNode.logicalTableId) {
    throw new Error(
      "The requested Ref/RefList select-by columns do not resolve to the same logical Grist table."
    );
  }
  return {
    sourceSectionId: source.id,
    ...(sourceNode.columnRef !== undefined
      ? { sourceColumnRef: sourceNode.columnRef }
      : {}),
    ...(targetNode.columnRef !== undefined
      ? { targetColumnRef: targetNode.columnRef }
      : {})
  };
}
