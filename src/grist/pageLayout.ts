export const MAX_NORMALIZED_LAYOUT_NODES = 1000;
export const MAX_NORMALIZED_LAYOUT_DEPTH = 50;
export const MAX_NORMALIZED_LAYOUT_WIDGET_IDS = 1000;

type JsonRecord = Record<string, unknown>;

export type NormalizedPageLayoutNode =
  | {
      kind: "widget";
      widgetId: number;
      size?: number;
    }
  | {
      kind: "group";
      children: NormalizedPageLayoutNode[];
      size?: number;
    };

export interface NormalizedPageLayout {
  root?: NormalizedPageLayoutNode;
  collapsedWidgetIds: number[];
  unplacedWidgetIds: number[];
}

export interface PageLayoutNormalizationResult {
  layoutNormalized?: NormalizedPageLayout;
  layoutNormalizationIncomplete?: true;
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

function normalizedSize(value: unknown): { size?: number; incomplete: boolean } {
  if (value === undefined) return { incomplete: false };
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return { size: value, incomplete: false };
  }
  return { incomplete: true };
}

/**
 * Normalize Grist's BoxSpec page layout into stable public widget IDs.
 *
 * Grist serializes page layouts as a bounded tree of `leaf`, `children` and
 * optional `size` values; page-layout leaves are view-section IDs, which are
 * the same stable IDs already exposed publicly as widget IDs. Unknown/stale
 * leaves are never returned. Malformed or unsupported state is represented by
 * `layoutNormalizationIncomplete` rather than guessed.
 */
export function normalizePageLayout(
  layoutSpec: unknown,
  widgetIds: readonly number[]
): PageLayoutNormalizationResult {
  if (layoutSpec === undefined) return {};

  const knownWidgetIds = new Set(
    widgetIds.filter((id) => Number.isInteger(id) && id > 0)
  );
  const placedWidgetIds = new Set<number>();
  const collapsedWidgetIds = new Set<number>();
  let visitedNodes = 0;
  let incomplete = false;

  const normalizeNode = (
    value: unknown,
    depth: number,
    isRoot: boolean
  ): NormalizedPageLayoutNode | undefined => {
    if (depth > MAX_NORMALIZED_LAYOUT_DEPTH) {
      incomplete = true;
      return undefined;
    }
    if (visitedNodes >= MAX_NORMALIZED_LAYOUT_NODES) {
      incomplete = true;
      return undefined;
    }

    const node = record(value);
    if (!node) {
      incomplete = true;
      return undefined;
    }
    visitedNodes += 1;

    if (!isRoot && node.collapsed !== undefined) incomplete = true;

    const hasLeaf = node.leaf !== undefined;
    const hasChildrenProperty = node.children !== undefined;
    const children = Array.isArray(node.children) ? node.children : undefined;

    if (hasLeaf === hasChildrenProperty) {
      incomplete = true;
      return undefined;
    }
    if (hasChildrenProperty && !children) {
      incomplete = true;
      return undefined;
    }

    const { size, incomplete: sizeIncomplete } = normalizedSize(node.size);
    if (sizeIncomplete) incomplete = true;

    if (hasLeaf) {
      const widgetId = positiveInteger(node.leaf);
      if (
        widgetId === undefined ||
        !knownWidgetIds.has(widgetId) ||
        placedWidgetIds.has(widgetId)
      ) {
        incomplete = true;
        return undefined;
      }
      placedWidgetIds.add(widgetId);
      return {
        kind: "widget",
        widgetId,
        ...(size !== undefined ? { size } : {})
      };
    }

    if (!children || children.length === 0) {
      incomplete = true;
      return undefined;
    }

    const normalizedChildren = children.flatMap((child) => {
      const normalized = normalizeNode(child, depth + 1, false);
      return normalized ? [normalized] : [];
    });
    if (normalizedChildren.length === 0) {
      incomplete = true;
      return undefined;
    }

    return {
      kind: "group",
      children: normalizedChildren,
      ...(size !== undefined ? { size } : {})
    };
  };

  const root = normalizeNode(layoutSpec, 0, true);
  const rootRecord = record(layoutSpec);
  const collapsed = rootRecord?.collapsed;
  if (collapsed !== undefined) {
    if (!Array.isArray(collapsed)) {
      incomplete = true;
    } else {
      for (let index = 0; index < collapsed.length; index += 1) {
        if (index >= MAX_NORMALIZED_LAYOUT_WIDGET_IDS) {
          incomplete = true;
          break;
        }
        const entry = record(collapsed[index]);
        const widgetId = positiveInteger(entry?.leaf);
        if (
          !entry ||
          widgetId === undefined ||
          !knownWidgetIds.has(widgetId) ||
          entry.children !== undefined ||
          entry.collapsed !== undefined ||
          placedWidgetIds.has(widgetId) ||
          collapsedWidgetIds.has(widgetId)
        ) {
          incomplete = true;
          continue;
        }
        const { incomplete: sizeIncomplete } = normalizedSize(entry.size);
        if (sizeIncomplete) incomplete = true;
        collapsedWidgetIds.add(widgetId);
      }
    }
  }

  const unplaced = [...knownWidgetIds]
    .filter(
      (widgetId) =>
        !placedWidgetIds.has(widgetId) && !collapsedWidgetIds.has(widgetId)
    )
    .sort((a, b) => a - b);
  if (unplaced.length > MAX_NORMALIZED_LAYOUT_WIDGET_IDS) incomplete = true;

  return {
    layoutNormalized: {
      ...(root ? { root } : {}),
      collapsedWidgetIds: [...collapsedWidgetIds],
      unplacedWidgetIds: unplaced.slice(0, MAX_NORMALIZED_LAYOUT_WIDGET_IDS)
    },
    ...(incomplete ? { layoutNormalizationIncomplete: true } : {})
  };
}
