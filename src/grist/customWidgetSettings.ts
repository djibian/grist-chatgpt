export const MAX_CUSTOM_WIDGET_MAPPING_KEYS = 100;
export const MAX_CUSTOM_WIDGET_MAPPED_COLUMNS = 1000;
export const MAX_CUSTOM_WIDGET_SCHEMA_COLUMNS = 5000;

type JsonRecord = Record<string, unknown>;

export type CustomWidgetAccessLevel = "none" | "read table" | "full";
export type CustomWidgetColumnMapping = Record<
  string,
  string | string[] | null
>;

export interface NormalizedCustomWidgetSettings {
  access?: CustomWidgetAccessLevel;
  widgetId?: string;
  columnsMapping: CustomWidgetColumnMapping | null;
}

export interface CustomWidgetSettingsNormalizationResult {
  customWidgetSettings?: NormalizedCustomWidgetSettings;
  customWidgetSettingsNormalizationIncomplete?: true;
}

interface WidgetSettingsInput {
  type: string;
  tableId?: string;
  tableRef: number;
  options?: unknown;
}

interface TableIndexEntry {
  id: string;
  ref: number;
  columnsByRef: Map<number, string>;
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

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function accessLevel(value: unknown): CustomWidgetAccessLevel | undefined {
  if (value === undefined || value === "") return "none";
  return value === "none" || value === "read table" || value === "full"
    ? value
    : undefined;
}

function findWidgetTable(
  tableResponse: unknown,
  widget: WidgetSettingsInput
): { table?: TableIndexEntry; truncated: boolean } {
  const root = record(tableResponse);
  const tables = Array.isArray(root?.tables) ? root.tables : [];
  let remainingColumns = MAX_CUSTOM_WIDGET_SCHEMA_COLUMNS;
  let truncated = false;

  for (const value of tables) {
    const table = record(value);
    const id = nonEmptyText(table?.id);
    const fields = record(table?.fields);
    const ref = positiveInteger(fields?.tableRef);
    if (!id || !ref) continue;
    if (
      (widget.tableId !== undefined && id !== widget.tableId) ||
      (widget.tableId === undefined && ref !== widget.tableRef)
    ) {
      continue;
    }

    const columns = Array.isArray(table.columns) ? table.columns : [];
    if (columns.length > remainingColumns) truncated = true;
    const limit = Math.min(columns.length, remainingColumns);
    const columnsByRef = new Map<number, string>();
    for (let index = 0; index < limit; index += 1) {
      const column = record(columns[index]);
      const columnId = nonEmptyText(column?.id);
      const columnFields = record(column?.fields);
      const columnRef = positiveInteger(columnFields?.colRef);
      if (columnId && columnRef) columnsByRef.set(columnRef, columnId);
    }
    remainingColumns -= limit;
    return {
      table: { id, ref, columnsByRef },
      truncated
    };
  }

  return { truncated: false };
}

/**
 * Normalize persisted Grist custom-widget settings without exposing raw URLs,
 * plugin internals or numeric column refs.
 *
 * Grist stores these values below `_grist_Views_section.options.customView`.
 * Column mappings use row IDs (`colRef`) into the widget's table. The public
 * bridge translates only fully resolved mapping entries to stable column IDs.
 */
export function normalizeCustomWidgetSettings(
  widget: WidgetSettingsInput,
  tableResponse: unknown
): CustomWidgetSettingsNormalizationResult | undefined {
  // `custom.calendar` is a legacy native-calendar alias in modern Grist and is
  // deliberately excluded from custom-widget semantics.
  if (widget.type !== "custom") return undefined;

  const options = record(widget.options);
  const customView = record(options?.customView);
  if (!options || !customView) {
    return { customWidgetSettingsNormalizationIncomplete: true };
  }

  let incomplete = false;
  const normalizedAccess = accessLevel(customView.access);
  if (normalizedAccess === undefined) incomplete = true;

  let widgetId: string | undefined;
  if (customView.widgetId !== undefined && customView.widgetId !== null) {
    widgetId = nonEmptyText(customView.widgetId);
    if (widgetId === undefined) incomplete = true;
  }

  const rawMapping = customView.columnsMapping;
  let columnsMapping: CustomWidgetColumnMapping | null = null;
  if (rawMapping !== undefined && rawMapping !== null) {
    const mapping = record(rawMapping);
    if (!mapping) {
      incomplete = true;
    } else {
      const { table, truncated } = findWidgetTable(tableResponse, widget);
      if (truncated) incomplete = true;
      if (!table) {
        incomplete = true;
      } else {
        const normalized: CustomWidgetColumnMapping = {};
        const entries = Object.entries(mapping).sort(([left], [right]) =>
          left.localeCompare(right)
        );
        if (entries.length > MAX_CUSTOM_WIDGET_MAPPING_KEYS) incomplete = true;

        let mappedColumns = 0;
        for (let index = 0; index < entries.length; index += 1) {
          if (index >= MAX_CUSTOM_WIDGET_MAPPING_KEYS) break;
          const [key, rawValue] = entries[index]!;
          if (!key.trim()) {
            incomplete = true;
            continue;
          }

          if (rawValue === null) {
            normalized[key] = null;
            continue;
          }

          if (Array.isArray(rawValue)) {
            if (
              mappedColumns + rawValue.length >
              MAX_CUSTOM_WIDGET_MAPPED_COLUMNS
            ) {
              incomplete = true;
              continue;
            }
            const resolved: string[] = [];
            let valid = true;
            const seen = new Set<number>();
            for (const rawRef of rawValue) {
              const ref = positiveInteger(rawRef);
              const columnId = ref ? table.columnsByRef.get(ref) : undefined;
              if (!ref || !columnId || seen.has(ref)) {
                valid = false;
                break;
              }
              seen.add(ref);
              resolved.push(columnId);
            }
            if (!valid) {
              incomplete = true;
              continue;
            }
            normalized[key] = resolved;
            mappedColumns += resolved.length;
            continue;
          }

          if (mappedColumns >= MAX_CUSTOM_WIDGET_MAPPED_COLUMNS) {
            incomplete = true;
            continue;
          }
          const ref = positiveInteger(rawValue);
          const columnId = ref ? table.columnsByRef.get(ref) : undefined;
          if (!ref || !columnId) {
            incomplete = true;
            continue;
          }
          normalized[key] = columnId;
          mappedColumns += 1;
        }
        columnsMapping = normalized;
      }
    }
  }

  const settings: NormalizedCustomWidgetSettings = {
    ...(normalizedAccess !== undefined ? { access: normalizedAccess } : {}),
    ...(widgetId !== undefined ? { widgetId } : {}),
    columnsMapping
  };

  return {
    customWidgetSettings: settings,
    ...(incomplete
      ? { customWidgetSettingsNormalizationIncomplete: true }
      : {})
  };
}
