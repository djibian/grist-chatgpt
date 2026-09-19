import {
  MAX_CUSTOM_WIDGET_MAPPED_COLUMNS,
  MAX_CUSTOM_WIDGET_MAPPING_KEYS,
  MAX_CUSTOM_WIDGET_SCHEMA_COLUMNS,
  type CustomWidgetAccessLevel,
  type CustomWidgetColumnMapping
} from "./customWidgetSettings.js";

export interface CustomWidgetSettingsUpdateInput {
  access?: CustomWidgetAccessLevel;
  columnsMapping?: CustomWidgetColumnMapping | null;
}

export interface ResolvedCustomWidgetSettingsUpdate {
  options: Record<string, unknown>;
  optionsJson: string;
}

type JsonRecord = Record<string, unknown>;

interface WidgetSettingsUpdateTarget {
  id: number;
  type: string;
  tableId?: string;
  tableRef: number;
  options?: unknown;
}

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

function exactNonEmptyText(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new Error(`${label} must be an exact non-empty stable ID without surrounding whitespace.`);
  }
  return value;
}

function targetColumnRefs(
  widget: WidgetSettingsUpdateTarget,
  tableResponse: unknown
): Map<string, number> {
  const root = record(tableResponse);
  const tables = Array.isArray(root?.tables) ? root.tables : [];
  const table = tables
    .map(record)
    .find((candidate) => {
      if (!candidate) return false;
      const fields = record(candidate.fields);
      return (
        (widget.tableId !== undefined && candidate.id === widget.tableId) ||
        (widget.tableId === undefined && positiveInteger(fields?.tableRef) === widget.tableRef)
      );
    });
  if (!table) {
    throw new Error(`Custom widget ${widget.id} table metadata is unavailable.`);
  }

  const columns = Array.isArray(table.columns) ? table.columns : null;
  if (!columns) {
    throw new Error(`Custom widget ${widget.id} requires expanded column metadata.`);
  }
  if (columns.length > MAX_CUSTOM_WIDGET_SCHEMA_COLUMNS) {
    throw new Error(
      `Custom widget ${widget.id} table has more than ${MAX_CUSTOM_WIDGET_SCHEMA_COLUMNS} columns; refusing an ambiguous mapping update.`
    );
  }

  const byId = new Map<string, number>();
  const seenRefs = new Set<number>();
  for (const value of columns) {
    const column = record(value);
    const id = typeof column?.id === "string" ? column.id : undefined;
    const fields = record(column?.fields);
    const ref = positiveInteger(fields?.colRef);
    if (!id || !ref) continue;
    if (byId.has(id) || seenRefs.has(ref)) {
      throw new Error(
        `Custom widget ${widget.id} column metadata is ambiguous; refusing to guess a mapping.`
      );
    }
    byId.set(id, ref);
    seenRefs.add(ref);
  }
  return byId;
}

function resolveMappings(
  widget: WidgetSettingsUpdateTarget,
  tableResponse: unknown,
  mapping: CustomWidgetColumnMapping
): Record<string, number | number[] | null> {
  const entries = Object.entries(mapping);
  if (entries.length > MAX_CUSTOM_WIDGET_MAPPING_KEYS) {
    throw new Error(
      `Custom widget mapping has ${entries.length} keys; maximum is ${MAX_CUSTOM_WIDGET_MAPPING_KEYS}.`
    );
  }

  const byId = targetColumnRefs(widget, tableResponse);
  const resolved: Record<string, number | number[] | null> = {};
  let mappedColumns = 0;

  for (const [key, value] of entries) {
    exactNonEmptyText(key, "Custom widget mapping key");
    if (value === null) {
      resolved[key] = null;
      continue;
    }

    const ids = Array.isArray(value) ? value : [value];
    mappedColumns += ids.length;
    if (mappedColumns > MAX_CUSTOM_WIDGET_MAPPED_COLUMNS) {
      throw new Error(
        `Custom widget mapping addresses more than ${MAX_CUSTOM_WIDGET_MAPPED_COLUMNS} columns.`
      );
    }

    const seenIds = new Set<string>();
    const refs = ids.map((rawId) => {
      const id = exactNonEmptyText(rawId, "Custom widget mapped column ID");
      if (seenIds.has(id)) {
        throw new Error(`Custom widget mapping contains duplicate column ID "${id}".`);
      }
      seenIds.add(id);
      const ref = byId.get(id);
      if (!ref) {
        throw new Error(
          `Custom widget mapped column "${id}" does not exist on the widget's current table.`
        );
      }
      return ref;
    });
    resolved[key] = Array.isArray(value) ? refs : refs[0]!;
  }

  return resolved;
}

function cloneJsonRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

/**
 * Resolve a bounded custom-widget settings update to the exact section `options`
 * JSON to persist. Only `customView.access` and `customView.columnsMapping` may be
 * changed. Every other existing option/customView field is preserved.
 */
export function resolveCustomWidgetSettingsUpdate(
  widget: WidgetSettingsUpdateTarget,
  tableResponse: unknown,
  update: CustomWidgetSettingsUpdateInput
): ResolvedCustomWidgetSettingsUpdate {
  if (widget.type !== "custom") {
    throw new Error(`Grist widget ${widget.id} is not a custom widget.`);
  }
  if (update.access === undefined && update.columnsMapping === undefined) {
    throw new Error("At least one custom widget setting must be supplied.");
  }

  const currentOptions = record(widget.options);
  const currentCustomView = record(currentOptions?.customView);
  if (!currentOptions || !currentCustomView) {
    throw new Error(
      `Custom widget ${widget.id} has malformed or unavailable current options; refusing to overwrite them.`
    );
  }

  const options = cloneJsonRecord(currentOptions);
  const customView = record(options.customView)!;

  if (update.access !== undefined) {
    if (!(["none", "read table", "full"] as const).includes(update.access)) {
      throw new Error(`Unsupported custom widget access level "${update.access}".`);
    }
    customView.access = update.access;
  }

  if (update.columnsMapping !== undefined) {
    customView.columnsMapping =
      update.columnsMapping === null
        ? null
        : resolveMappings(widget, tableResponse, update.columnsMapping);
  }

  return { options, optionsJson: JSON.stringify(options) };
}

export function sameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJsonValue(value, right[index]))
    );
  }
  const leftRecord = record(left);
  const rightRecord = record(right);
  if (!leftRecord || !rightRecord) return false;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJsonValue(leftRecord[key], rightRecord[key])
    )
  );
}
