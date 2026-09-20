export const MAX_NORMALIZED_LAYOUT_NODES = 1000;
export const MAX_NORMALIZED_LAYOUT_DEPTH = 50;
export const MAX_NORMALIZED_LAYOUT_WIDGET_IDS = 1000;

type JsonRecord = Record<string, unknown>;

export type NormalizedPageLayoutNode =
  | {
      kind: "widget";
      widgetId: number;
      size?: number | undefined;
    }
  | {
      kind: "group";
      children: NormalizedPageLayoutNode[];
      size?: number | undefined;
    };

export interface NormalizedPageLayout {
  root?: NormalizedPageLayoutNode;
  collapsedWidgetIds: number[];
  unplacedWidgetIds: number[];
}

export interface PageLayoutUpdateInput {
  root: NormalizedPageLayoutNode;
  collapsedWidgetIds?: readonly number[] | undefined;
}

export interface ResolvedPageLayoutUpdate {
  layoutSpec: JsonRecord;
  layoutSpecJson: string;
  expectedLayout: NormalizedPageLayout;
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
    return { size: value === 0 ? 0 : value, incomplete: false };
  }
  return { incomplete: true };
}

function assertOnlyKeys(node: JsonRecord, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(node).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} contains unsupported field "${unknown[0]}".`);
  }
}

/**
 * Resolve a public stable-ID layout request into Grist's private BoxSpec form.
 *
 * Mutation is intentionally stricter than read normalization: every current
 * page widget must appear exactly once, either in the placed tree or in the
 * collapsed list. This prevents a layout update from accidentally dropping or
 * implicitly inventing widget placement. Numeric Grist refs never enter the
 * public contract; page widget IDs are already stable bridge identifiers.
 */
export function resolvePageLayoutUpdate(
  input: PageLayoutUpdateInput,
  widgetIds: readonly number[]
): ResolvedPageLayoutUpdate {
  const request = record(input);
  if (!request) throw new Error("Page layout must be a JSON object.");
  assertOnlyKeys(request, ["root", "collapsedWidgetIds"], "Page layout");

  const knownWidgetIds = new Set<number>();
  for (const widgetId of widgetIds) {
    if (!Number.isInteger(widgetId) || widgetId < 1) {
      throw new Error("Current page contains an invalid widget ID.");
    }
    if (knownWidgetIds.has(widgetId)) {
      throw new Error(`Current page contains duplicate widget ID ${widgetId}.`);
    }
    knownWidgetIds.add(widgetId);
  }
  if (knownWidgetIds.size === 0) {
    throw new Error("Cannot update layout for a page with no widgets.");
  }

  const placedWidgetIds = new Set<number>();
  let visitedNodes = 0;

  const encodeNode = (
    value: unknown,
    depth: number
  ): { raw: JsonRecord; normalized: NormalizedPageLayoutNode } => {
    if (depth > MAX_NORMALIZED_LAYOUT_DEPTH) {
      throw new Error(
        `Page layout exceeds the maximum depth of ${MAX_NORMALIZED_LAYOUT_DEPTH}.`
      );
    }
    if (visitedNodes >= MAX_NORMALIZED_LAYOUT_NODES) {
      throw new Error(
        `Page layout exceeds the maximum of ${MAX_NORMALIZED_LAYOUT_NODES} nodes.`
      );
    }

    const node = record(value);
    if (!node) throw new Error("Every page layout node must be a JSON object.");
    visitedNodes += 1;

    const { size, incomplete: invalidSize } = normalizedSize(node.size);
    if (invalidSize) {
      throw new Error("Page layout node size must be a finite non-negative number.");
    }

    if (node.kind === "widget") {
      assertOnlyKeys(node, ["kind", "widgetId", "size"], "Widget layout node");
      const widgetId = positiveInteger(node.widgetId);
      if (widgetId === undefined) {
        throw new Error("Widget layout node requires a positive integer widgetId.");
      }
      if (!knownWidgetIds.has(widgetId)) {
        throw new Error(`Widget ${widgetId} does not exist on the current page.`);
      }
      if (placedWidgetIds.has(widgetId)) {
        throw new Error(`Widget ${widgetId} appears more than once in the page layout.`);
      }
      placedWidgetIds.add(widgetId);
      return {
        raw: {
          leaf: widgetId,
          ...(size !== undefined ? { size } : {})
        },
        normalized: {
          kind: "widget",
          widgetId,
          ...(size !== undefined ? { size } : {})
        }
      };
    }

    if (node.kind === "group") {
      assertOnlyKeys(node, ["kind", "children", "size"], "Group layout node");
      if (!Array.isArray(node.children) || node.children.length === 0) {
        throw new Error("Group layout node requires at least one child.");
      }
      const children = node.children.map((child) => encodeNode(child, depth + 1));
      return {
        raw: {
          children: children.map((child) => child.raw),
          ...(size !== undefined ? { size } : {})
        },
        normalized: {
          kind: "group",
          children: children.map((child) => child.normalized),
          ...(size !== undefined ? { size } : {})
        }
      };
    }

    throw new Error('Page layout node kind must be either "widget" or "group".');
  };

  const root = encodeNode(request.root, 0);
  const collapsedValue = request.collapsedWidgetIds ?? [];
  if (!Array.isArray(collapsedValue)) {
    throw new Error("collapsedWidgetIds must be an array of widget IDs.");
  }
  if (collapsedValue.length > MAX_NORMALIZED_LAYOUT_WIDGET_IDS) {
    throw new Error(
      `Page layout supports at most ${MAX_NORMALIZED_LAYOUT_WIDGET_IDS} collapsed widget IDs.`
    );
  }

  const collapsedWidgetIds: number[] = [];
  const collapsedSet = new Set<number>();
  for (const value of collapsedValue) {
    const widgetId = positiveInteger(value);
    if (widgetId === undefined) {
      throw new Error("Collapsed widget IDs must be positive integers.");
    }
    if (!knownWidgetIds.has(widgetId)) {
      throw new Error(`Collapsed widget ${widgetId} does not exist on the current page.`);
    }
    if (placedWidgetIds.has(widgetId)) {
      throw new Error(`Widget ${widgetId} cannot be both placed and collapsed.`);
    }
    if (collapsedSet.has(widgetId)) {
      throw new Error(`Collapsed widget ${widgetId} appears more than once.`);
    }
    collapsedSet.add(widgetId);
    collapsedWidgetIds.push(widgetId);
  }

  const missing = [...knownWidgetIds].filter(
    (widgetId) => !placedWidgetIds.has(widgetId) && !collapsedSet.has(widgetId)
  );
  if (missing.length > 0) {
    throw new Error(
      `Page layout must account for every current widget; missing widget ${missing[0]}.`
    );
  }

  const layoutSpec: JsonRecord = {
    ...root.raw,
    ...(collapsedWidgetIds.length > 0
      ? { collapsed: collapsedWidgetIds.map((widgetId) => ({ leaf: widgetId })) }
      : {})
  };
  const expectedLayout: NormalizedPageLayout = {
    root: root.normalized,
    collapsedWidgetIds,
    unplacedWidgetIds: []
  };

  return {
    layoutSpec,
    layoutSpecJson: JSON.stringify(layoutSpec),
    expectedLayout
  };
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
