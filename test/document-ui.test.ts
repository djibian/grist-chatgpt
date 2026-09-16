import assert from "node:assert/strict";
import test from "node:test";

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
        layoutSpec: "{\"children\":[1,2]}"
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

test("builds normalized pages, widgets, table IDs and select-by links", () => {
  const service = new DocumentUiService();
  const context = service.build("doc-1", tables, pages, views, sections);

  assert.deepEqual(context.summary, { pageCount: 2, widgetCount: 2 });
  assert.equal(context.pages[0]?.id, 101);
  assert.equal(context.pages[0]?.name, "Pilotage");
  assert.deepEqual(context.pages[0]?.layoutSpec, { children: [1, 2] });
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
    layoutSpec: { children: [1, 2] },
    widgetCount: 2,
    widgetIds: [201, 202]
  });

  const widgets = service.getPageWidgets(context, 101) as {
    widgets: Array<{ id: number }>;
  };
  assert.deepEqual(widgets.widgets.map((widget) => widget.id), [201, 202]);

  assert.throws(
    () => service.getPageWidgets(context, 999),
    (error: unknown) =>
      error instanceof GristApiError &&
      error.status === 404 &&
      /Grist page 999 does not exist/.test(error.message)
  );
});
