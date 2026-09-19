import assert from "node:assert/strict";
import test from "node:test";

import { assertDirectSelectByAllowed } from "../src/grist/selectBy.js";
import { pageWidgetsOutputSchema, pagesOutputSchema } from "../src/mcp/outputSchemas.js";
import { GristApiError } from "../src/grist/client.js";
import { DocumentUiService } from "../src/grist/documentUi.js";

const tables = {
  tables: [
    { id: "Eleves", fields: { tableRef: 1, onDemand: false } },
    { id: "Enseignants", fields: { tableRef: 2, onDemand: false } }
  ]
};

const pages = {
  records: [
    { id: 10, fields: { viewRef: 101, indentation: 0, pagePos: 1 } },
    { id: 11, fields: { viewRef: 102, indentation: 1, pagePos: 2 } }
  ]
};

const views = {
  records: [
    {
      id: 101,
      fields: {
        name: "Pilotage",
        type: "empty",
        layoutSpec:
          "{\"children\":[{\"leaf\":201,\"size\":60},{\"leaf\":202,\"size\":40}],\"collapsed\":[]}"
      }
    },
    { id: 102, fields: { name: "Détail", type: "empty", layoutSpec: "" } }
  ]
};

const sections = {
  records: [
    {
      id: 201,
      fields: {
        parentId: 101,
        tableRef: 2,
        parentKey: "record",
        title: "Enseignants",
        description: "Liste maître",
        chartType: "",
        options: "{}",
        layoutSpec: "",
        sortColRefs: "[]",
        linkSrcSectionRef: 0,
        linkSrcColRef: 0,
        linkTargetColRef: 0
      }
    },
    {
      id: 202,
      fields: {
        parentId: 101,
        tableRef: 1,
        parentKey: "record",
        title: "Élèves",
        chartType: "",
        options: "{\"customView\":{\"mode\":\"url\"}}",
        layoutSpec: "",
        sortColRefs: "[3,-4]",
        linkSrcSectionRef: 201,
        linkSrcColRef: 12,
        linkTargetColRef: 14
      }
    }
  ]
};

test("builds normalized pages, widgets, layout and select-by links", () => {
  const service = new DocumentUiService();
  const context = service.build("doc-1", tables, pages, views, sections);

  assert.deepEqual(context.summary, { pageCount: 2, widgetCount: 2 });
  assert.equal(context.pages[0]?.id, 101);
  assert.equal(context.pages[0]?.name, "Pilotage");
  assert.deepEqual(context.pages[0]?.layoutSpec, {
    children: [{ leaf: 201, size: 60 }, { leaf: 202, size: 40 }],
    collapsed: []
  });
  assert.deepEqual(context.pages[0]?.layoutNormalized, {
    root: {
      kind: "group",
      children: [
        { kind: "widget", widgetId: 201, size: 60 },
        { kind: "widget", widgetId: 202, size: 40 }
      ]
    },
    collapsedWidgetIds: [],
    unplacedWidgetIds: []
  });
  assert.equal(context.pages[0]?.layoutNormalizationIncomplete, undefined);
  assert.equal(context.pages[0]?.widgets[0]?.tableId, "Enseignants");
  assert.equal(context.pages[0]?.widgets[1]?.tableId, "Eleves");
  assert.deepEqual(context.pages[0]?.widgets[1]?.sortColRefs, [3, -4]);
  assert.deepEqual(context.pages[0]?.widgets[1]?.selectBy, {
    sourceSectionId: 201,
    sourceColumnRef: 12,
    targetColumnRef: 14
  });
});

test("lists pages compactly and returns widgets for an explicit page", () => {
  const service = new DocumentUiService();
  const context = service.build("doc-1", tables, pages, views, sections);

  const listed = service.listPages(context) as {
    pages: Array<{ id: number; widgetCount: number; widgetIds: number[] }>;
  };
  assert.deepEqual(listed.pages[0], {
    id: 101,
    pageRecordId: 10,
    name: "Pilotage",
    type: "empty",
    indentation: 0,
    pagePos: 1,
    layoutSpec: {
      children: [{ leaf: 201, size: 60 }, { leaf: 202, size: 40 }],
      collapsed: []
    },
    layoutNormalized: {
      root: {
        kind: "group",
        children: [
          { kind: "widget", widgetId: 201, size: 60 },
          { kind: "widget", widgetId: 202, size: 40 }
        ]
      },
      collapsedWidgetIds: [],
      unplacedWidgetIds: []
    },
    widgetCount: 2,
    widgetIds: [201, 202]
  });
  assert.equal(pagesOutputSchema.safeParse(listed).success, true);

  const result = service.getPageWidgets(context, 101);
  const widgets = result as { widgets: Array<{ id: number }> };
  assert.deepEqual(widgets.widgets.map((widget) => widget.id), [201, 202]);
  assert.equal(pageWidgetsOutputSchema.safeParse(result).success, true);

  assert.throws(
    () => service.getPageWidgets(context, 999),
    (error: unknown) =>
      error instanceof GristApiError &&
      error.status === 404 &&
      /Grist page 999 does not exist/.test(error.message)
  );
});

test("malformed raw page layout remains available but normalized output fails closed", () => {
  const service = new DocumentUiService();
  const malformedViews = {
    records: [
      {
        id: 101,
        fields: {
          name: "Pilotage",
          type: "empty",
          layoutSpec: "{\"children\":[{\"leaf\":999},{\"leaf\":201},{\"leaf\":201}]}"
        }
      }
    ]
  };
  const context = service.build("doc-1", tables, { records: [pages.records[0]] }, malformedViews, sections);
  const page = context.pages[0]!;

  assert.deepEqual(page.layoutSpec, {
    children: [{ leaf: 999 }, { leaf: 201 }, { leaf: 201 }]
  });
  assert.deepEqual(page.layoutNormalized, {
    root: {
      kind: "group",
      children: [{ kind: "widget", widgetId: 201 }]
    },
    collapsedWidgetIds: [],
    unplacedWidgetIds: [202]
  });
  assert.equal(page.layoutNormalizationIncomplete, true);
  assert.equal(JSON.stringify(page.layoutNormalized).includes("999"), false);
});

test("discovers only direct select-by sources accepted for each target", () => {
  const service = new DocumentUiService();
  const widget = (id: number, tableRef = 1, type = "record", source = 0) => ({
    id, fields: { parentId: 101, tableRef, parentKey: type, linkSrcSectionRef: source }
  });
  const context = service.build("doc-1", tables, pages, views, { records: [
    widget(1), widget(2), widget(3, 2), widget(4, 1, "chart"),
    widget(5, 1, "custom"), widget(6, 1, "record", 1),
    widget(7, 1, "record", 8), widget(8, 1, "record", 7),
    { id: 9, fields: { parentId: 102, tableRef: 1, parentKey: "record" } }
  ] });
  const result = service.getPageWidgets(context, 101) as {
    widgets: Array<{ id: number; directSelectByOptions: Array<{ sourceWidgetId: number }> }>;
  };
  for (const target of result.widgets) {
    for (const option of target.directSelectByOptions) {
      const widgets = context.pages[0]!.widgets;
      assert.doesNotThrow(() => assertDirectSelectByAllowed(context,
        widgets.find(w => w.id === option.sourceWidgetId)!, widgets.find(w => w.id === target.id)!));
    }
  }
  assert.equal(pageWidgetsOutputSchema.safeParse(result).success, true);
  // Excludes self, other table/page, chart/custom and existing/new cycles.
  assert.deepEqual(result.widgets.find(w => w.id === 1)?.directSelectByOptions,
    [{ sourceWidgetId: 2 }]);
  assert.deepEqual(result.widgets.find(w => w.id === 3)?.directSelectByOptions, []);
  assert.deepEqual(result.widgets.find(w => w.id === 2)?.directSelectByOptions,
    [{ sourceWidgetId: 1 }, { sourceWidgetId: 6 }]);
});

test("bounds discovery output and marks incomplete lists deterministically", () => {
  const service = new DocumentUiService();
  const context = service.build("doc-1", tables, pages, views, { records:
    Array.from({ length: 40 }, (_, i) => ({ id: 40 - i,
      fields: { parentId: 101, tableRef: 1, parentKey: "record" } }))
  });
  const result = pageWidgetsOutputSchema.parse(service.getPageWidgets(context, 101));
  assert.equal(result.widgets.reduce((n, w) => n + w.directSelectByOptions.length, 0), 1000);
  assert.deepEqual(result.widgets[0]?.directSelectByOptions[0], { sourceWidgetId: 2 });
  assert.equal(result.widgets[0]?.directSelectByOptionsTruncated, false);
  assert.equal(result.widgets[25]?.directSelectByOptions.length, 25);
  assert.equal(result.widgets[25]?.directSelectByOptionsTruncated, true);
  assert.equal(result.widgets[39]?.directSelectByOptionsTruncated, true);
  assert.deepEqual(result.widgets[39]?.directSelectByOptions, []);
});

test("bounds rejected candidate work even when no options are produced", () => {
  const service = new DocumentUiService();
  const context = service.build("doc-1", tables, pages, views, { records:
    Array.from({ length: 101 }, (_, i) => ({ id: i + 1,
      fields: { parentId: 101, tableRef: 1, parentKey: "chart" } }))
  });
  const result = pageWidgetsOutputSchema.parse(service.getPageWidgets(context, 101));
  assert.equal(result.widgets.every(w => w.directSelectByOptions.length === 0), true);
  assert.equal(result.widgets[98]?.directSelectByOptionsTruncated, false);
  assert.equal(result.widgets[99]?.directSelectByOptionsTruncated, true);
  assert.equal(result.widgets[100]?.directSelectByOptionsTruncated, true);
});
