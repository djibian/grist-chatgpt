import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_NORMALIZED_LAYOUT_DEPTH,
  MAX_NORMALIZED_LAYOUT_NODES,
  normalizePageLayout
} from "../src/grist/pageLayout.js";

test("normalizes BoxSpec leaves to stable widget IDs", () => {
  const result = normalizePageLayout(
    {
      children: [
        { leaf: 201, size: 60 },
        {
          children: [{ leaf: 202 }, { leaf: 203 }],
          size: 40
        }
      ],
      collapsed: [{ leaf: 204, size: 25 }]
    },
    [201, 202, 203, 204, 205]
  );

  assert.deepEqual(result, {
    layoutNormalized: {
      root: {
        kind: "group",
        children: [
          { kind: "widget", widgetId: 201, size: 60 },
          {
            kind: "group",
            children: [
              { kind: "widget", widgetId: 202 },
              { kind: "widget", widgetId: 203 }
            ],
            size: 40
          }
        ]
      },
      collapsedWidgetIds: [204],
      unplacedWidgetIds: [205]
    }
  });
});

test("unknown, duplicate and malformed leaves are never exposed", () => {
  const result = normalizePageLayout(
    {
      children: [
        { leaf: 201 },
        { leaf: 999 },
        { leaf: 201 },
        { leaf: "202" },
        { children: [] }
      ],
      collapsed: [
        { leaf: 202 },
        { leaf: 999 },
        { leaf: 202 },
        { leaf: 203, children: [{ leaf: 201 }] }
      ]
    },
    [201, 202, 203]
  );

  assert.deepEqual(result, {
    layoutNormalized: {
      root: {
        kind: "group",
        children: [{ kind: "widget", widgetId: 201 }]
      },
      collapsedWidgetIds: [202],
      unplacedWidgetIds: [203]
    },
    layoutNormalizationIncomplete: true
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("999"), false);
  assert.equal(serialized.includes('"202"'), false);
});

test("invalid layout shape is explicit and still reports known unplaced widgets", () => {
  assert.deepEqual(normalizePageLayout("not-json", [3, 1, 2]), {
    layoutNormalized: {
      collapsedWidgetIds: [],
      unplacedWidgetIds: [1, 2, 3]
    },
    layoutNormalizationIncomplete: true
  });

  assert.deepEqual(normalizePageLayout(undefined, [1, 2]), {});
});

test("normalization is bounded by depth", () => {
  let spec: unknown = { leaf: 1 };
  for (let index = 0; index <= MAX_NORMALIZED_LAYOUT_DEPTH; index += 1) {
    spec = { children: [spec] };
  }

  const result = normalizePageLayout(spec, [1]);
  assert.equal(result.layoutNormalizationIncomplete, true);
  assert.deepEqual(result.layoutNormalized?.unplacedWidgetIds, [1]);
});

test("normalization is bounded by node count", () => {
  const spec = {
    children: Array.from(
      { length: MAX_NORMALIZED_LAYOUT_NODES + 25 },
      (_, index) => ({ leaf: index + 1 })
    )
  };
  const widgetIds = Array.from(
    { length: MAX_NORMALIZED_LAYOUT_NODES + 25 },
    (_, index) => index + 1
  );

  const result = normalizePageLayout(spec, widgetIds);
  assert.equal(result.layoutNormalizationIncomplete, true);
  assert.ok(result.layoutNormalized?.root);
  const root = result.layoutNormalized?.root;
  assert.equal(root?.kind, "group");
  if (root?.kind === "group") {
    // One node slot is consumed by the root itself.
    assert.equal(root.children.length, MAX_NORMALIZED_LAYOUT_NODES - 1);
  }
  assert.equal(result.layoutNormalized?.unplacedWidgetIds.length, 26);
});
