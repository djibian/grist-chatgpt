export const GRID_ROW_NUMBER_MODES = ["number", "rowId", "hidden"] as const;
export type GridRowNumbersMode = (typeof GRID_ROW_NUMBER_MODES)[number];

export interface NormalizedGridOptions {
  verticalGridlines?: boolean;
  horizontalGridlines?: boolean;
  zebraStripes?: boolean;
  rowNumbers?: GridRowNumbersMode;
}

export interface GridOptionsUpdateInput {
  verticalGridlines?: boolean | undefined;
  horizontalGridlines?: boolean | undefined;
  zebraStripes?: boolean | undefined;
  rowNumbers?: GridRowNumbersMode | undefined;
}

export interface ResolvedGridOptionsUpdate {
  options: Record<string, unknown>;
  optionsJson: string;
}

type JsonRecord = Record<string, unknown>;

interface GridWidgetTarget {
  id: number;
  type: string;
  options?: unknown;
}

const DEFAULT_GRID_OPTIONS: Required<NormalizedGridOptions> = {
  verticalGridlines: true,
  horizontalGridlines: true,
  zebraStripes: false,
  rowNumbers: "number"
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function cloneJsonRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function isRowNumbersMode(value: unknown): value is GridRowNumbersMode {
  return (
    typeof value === "string" &&
    (GRID_ROW_NUMBER_MODES as readonly string[]).includes(value)
  );
}

/**
 * Normalize only the four display settings exposed by Grist's Grid Options panel.
 * Missing keys use Grist's documented ViewSectionRec defaults. Malformed present
 * values are omitted and marked incomplete instead of guessed.
 */
export function normalizeGridOptions(
  widget: GridWidgetTarget
):
  | {
      gridOptions: NormalizedGridOptions;
      gridOptionsNormalizationIncomplete?: true;
    }
  | undefined {
  if (widget.type !== "record") return undefined;

  if (widget.options === undefined || widget.options === null) {
    return { gridOptions: { ...DEFAULT_GRID_OPTIONS } };
  }

  const options = record(widget.options);
  if (!options) {
    return {
      gridOptions: {},
      gridOptionsNormalizationIncomplete: true
    };
  }

  const normalized: NormalizedGridOptions = {};
  let incomplete = false;

  for (const key of [
    "verticalGridlines",
    "horizontalGridlines",
    "zebraStripes"
  ] as const) {
    const value = options[key];
    if (value === undefined) {
      normalized[key] = DEFAULT_GRID_OPTIONS[key];
    } else if (typeof value === "boolean") {
      normalized[key] = value;
    } else {
      incomplete = true;
    }
  }

  const rowNumbers = options.rowNumbers;
  if (rowNumbers === undefined) {
    normalized.rowNumbers = DEFAULT_GRID_OPTIONS.rowNumbers;
  } else if (isRowNumbersMode(rowNumbers)) {
    normalized.rowNumbers = rowNumbers;
  } else {
    incomplete = true;
  }

  return {
    gridOptions: normalized,
    ...(incomplete ? { gridOptionsNormalizationIncomplete: true as const } : {})
  };
}

/**
 * Read-modify-write resolver for the same four grid display settings. It never
 * accepts or rewrites arbitrary widget options: every untargeted existing key is
 * preserved byte-semantically after JSON parse/stringify normalization.
 */
export function resolveGridOptionsUpdate(
  widget: GridWidgetTarget,
  update: GridOptionsUpdateInput
): ResolvedGridOptionsUpdate {
  if (widget.type !== "record") {
    throw new Error(`Grist widget ${widget.id} is not a table widget.`);
  }
  if (
    update.verticalGridlines === undefined &&
    update.horizontalGridlines === undefined &&
    update.zebraStripes === undefined &&
    update.rowNumbers === undefined
  ) {
    throw new Error("At least one grid display option must be supplied.");
  }

  const currentOptions =
    widget.options === undefined || widget.options === null
      ? {}
      : record(widget.options);
  if (!currentOptions) {
    throw new Error(
      `Table widget ${widget.id} has malformed current options; refusing to overwrite them.`
    );
  }

  const options = cloneJsonRecord(currentOptions);
  if (update.verticalGridlines !== undefined) {
    options.verticalGridlines = update.verticalGridlines;
  }
  if (update.horizontalGridlines !== undefined) {
    options.horizontalGridlines = update.horizontalGridlines;
  }
  if (update.zebraStripes !== undefined) {
    options.zebraStripes = update.zebraStripes;
  }
  if (update.rowNumbers !== undefined) {
    if (!isRowNumbersMode(update.rowNumbers)) {
      throw new Error(`Unsupported row-number mode "${update.rowNumbers}".`);
    }
    options.rowNumbers = update.rowNumbers;
  }

  return { options, optionsJson: JSON.stringify(options) };
}
