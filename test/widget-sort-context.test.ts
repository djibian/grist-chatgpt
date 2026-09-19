import assert from "node:assert/strict";
import test from "node:test";

import { DocumentUiService } from "../src/grist/documentUi.js";
import { normalizeWidgetSort } from "../src/grist/widgetSort.js";
import { pageWidgetsOutputSchema } from "../src/mcp/outputSchemas.js";

const expandedTables = {
  tables: [
    {
      id: "Personnes",
      fields: { tableRef: 2 },
      columns: [
        { id: "Nom", fields: { colRef: 21, type: "Text" } },
        { id: "Score", fields: { colRef: 22, type: "Numeric" } },
        { id: "Statut", fields: { colRef: 23, type: "Choice" } }
      ]
    }
  ]
};

const pageRecords = {
  records: [{ id: 12, fields: { viewRef: 7, indentation: 0, pagePos: 1 } }]
};

const viewRecords = {
  records: [{ id: 7, fields: { name: "Vue", type: "empty", layoutSpec: "" } }]
};

function sectionRecords(sortColRefs: unknown): unknown {
  return {
    records: [
      {
        id: 11,
        fields: {
          parentId: 7,
          tableRef: 2,
          parentKey: "record",
          title: "Widget",
          description: "",
          chartType: "",
          options: "{}",
          layoutSpec: "",
          sortColRefs: JSON.stringify(sortColRefs),
          linkSrcSectionRef: 0,
          linkSrcColRef: 0,
          linkTargetColRef: 0
        }
      }
    ]
  };
}

test("normalizes stored Grist sort refs to stable column IDs", () => {
  assert.deepEqual(
    normalizeWidgetSort(
      {
        id: 11,
        tableRef: 2,
        tableId: "Personnes",
        sortColRefs: [-21, "23:orderByChoice", "22:emptyLast"]
      },
      expandedTables
    ),
    {
      sort: [
        { columnId: "Nom", direction: "desc" },
        { columnId: "Statut", direction: "asc", orderByChoice: true },
        { columnId: "Score", direction: "asc", emptyLast: true }
      ],
      sortNormalizationIncomplete: false
    }
  );
});

test("marks normalization incomplete instead of inventing unsupported semantics", () => {
  assert.deepEqual(
    normalizeWidgetSort(
      {
        id: 11,
        tableRef: 2,
        tableId: "Personnes",
        sortColRefs: [21, "999:emptyLast", "23:futureFlag", { bad: true }]
      },
      expandedTables
    ),
    {
      sort: [{ columnId: "Nom", direction: "asc" }],
      sortNormalizationIncomplete: true
    }
  );
});

test("document UI exposes normalized saved sort while preserving the raw v1 field", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pageRecords,
    viewRecords,
    sectionRecords(["-21:naturalSort", "23:orderByChoice"])
  );

  const output = pageWidgetsOutputSchema.parse(
    service.getPageWidgets(context, 7, expandedTables)
  );
  assert.deepEqual(output.widgets[0]?.sort, [
    { columnId: "Nom", direction: "desc", naturalSort: true },
    { columnId: "Statut", direction: "asc", orderByChoice: true }
  ]);
  assert.equal(output.widgets[0]?.sortNormalizationIncomplete, false);
  assert.deepEqual(output.widgets[0]?.sortColRefs, [
    "-21:naturalSort",
    "23:orderByChoice"
  ]);
});

test("non-expanded UI reads do not claim a normalized saved sort", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    { tables: [{ id: "Personnes", fields: { tableRef: 2 } }] },
    pageRecords,
    viewRecords,
    sectionRecords([-21])
  );

  const widget = context.pages[0]?.widgets[0];
  assert.deepEqual(widget?.sortColRefs, [-21]);
  assert.equal(widget?.sort, undefined);
  assert.equal(widget?.sortNormalizationIncomplete, undefined);
});
