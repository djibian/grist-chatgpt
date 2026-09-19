import assert from "node:assert/strict";
import test from "node:test";

import { DocumentUiService } from "../src/grist/documentUi.js";
import { normalizeExistingSelectBy } from "../src/grist/selectByContext.js";
import { pageWidgetsOutputSchema } from "../src/mcp/outputSchemas.js";

const expandedTables = {
  tables: [
    {
      id: "Personnes",
      fields: { tableRef: 2 },
      columns: [
        { id: "Equipe", fields: { colRef: 21, type: "Ref:Equipes" } },
        { id: "Manager", fields: { colRef: 22, type: "Ref:Personnes" } }
      ]
    }
  ]
};

const pages = {
  records: [{ id: 12, fields: { viewRef: 7, indentation: 0, pagePos: 1 } }]
};

const views = {
  records: [{ id: 7, fields: { name: "Vue", type: "empty", layoutSpec: "" } }]
};

function section(
  id: number,
  fields: Record<string, unknown>
): { id: number; fields: Record<string, unknown> } {
  return {
    id,
    fields: {
      parentId: 7,
      tableRef: 2,
      parentKey: "record",
      title: `Widget ${id}`,
      description: "",
      chartType: "",
      options: "{}",
      layoutSpec: "",
      sortColRefs: "[]",
      linkSrcSectionRef: 0,
      linkSrcColRef: 0,
      linkTargetColRef: 0,
      ...fields
    }
  };
}

test("normalizes an existing direct select-by link to sourceWidgetId", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pages,
    views,
    {
      records: [
        section(11, {}),
        section(12, { linkSrcSectionRef: 11 })
      ]
    }
  );

  const target = context.pages[0]?.widgets.find((widget) => widget.id === 12);
  assert.deepEqual(target?.selectByNormalized, { sourceWidgetId: 11 });
  assert.equal(target?.selectByNormalizationIncomplete, false);
  assert.deepEqual(target?.selectBy, { sourceSectionId: 11 });
});

test("normalizes existing select-by column refs to stable column IDs", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pages,
    views,
    {
      records: [
        section(11, {}),
        section(12, {
          linkSrcSectionRef: 11,
          linkSrcColRef: 21,
          linkTargetColRef: 22
        })
      ]
    }
  );

  const output = pageWidgetsOutputSchema.parse(
    service.getPageWidgets(context, 7, expandedTables)
  );
  const target = output.widgets.find((widget) => widget.id === 12);
  assert.deepEqual(target?.selectByNormalized, {
    sourceWidgetId: 11,
    sourceColumnId: "Equipe",
    targetColumnId: "Manager"
  });
  assert.equal(target?.selectByNormalizationIncomplete, false);
  assert.deepEqual(target?.selectBy, {
    sourceSectionId: 11,
    sourceColumnRef: 21,
    targetColumnRef: 22
  });
});

test("unresolved existing select-by refs are explicit and never partially guessed", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pages,
    views,
    {
      records: [
        section(11, {}),
        section(12, {
          linkSrcSectionRef: 11,
          linkSrcColRef: 21,
          linkTargetColRef: 999
        })
      ]
    }
  );

  const target = context.pages[0]?.widgets.find((widget) => widget.id === 12);
  assert.equal(target?.selectByNormalized, undefined);
  assert.equal(target?.selectByNormalizationIncomplete, true);
});

test("missing source widget prevents normalized select-by state", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pages,
    views,
    {
      records: [section(12, { linkSrcSectionRef: 999 })]
    }
  );

  const target = context.pages[0]?.widgets[0];
  assert.equal(target?.selectByNormalized, undefined);
  assert.equal(target?.selectByNormalizationIncomplete, true);
});

test("standalone normalizer leaves widgets without a link untouched", () => {
  const service = new DocumentUiService();
  const context = service.build(
    "doc-1",
    expandedTables,
    pages,
    views,
    { records: [section(11, {})] }
  );
  const target = context.pages[0]?.widgets[0];
  assert.ok(target);
  assert.equal(normalizeExistingSelectBy(context, expandedTables, target), undefined);
});
