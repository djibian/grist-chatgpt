import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCustomWidgetSettingsUpdate,
  sameJsonValue
} from "../src/grist/customWidgetSettingsUpdate.js";

const expandedTables = {
  tables: [
    {
      id: "People",
      fields: { tableRef: 1 },
      columns: [
        { id: "Name", fields: { colRef: 11, type: "Text" } },
        { id: "Email", fields: { colRef: 12, type: "Text" } },
        { id: "Tags", fields: { colRef: 13, type: "ChoiceList" } }
      ]
    }
  ]
};

const widget = {
  id: 201,
  type: "custom",
  tableId: "People",
  tableRef: 1,
  options: {
    unrelatedTopLevel: { keep: true },
    customView: {
      mode: "url",
      url: "https://widget.example.invalid/private",
      widgetId: "@example/people-widget",
      pluginId: "internal-plugin",
      access: "none",
      widgetOptions: { arbitrary: [1, 2, 3] },
      columnsMapping: { title: 11 }
    }
  }
};

test("resolves stable custom widget settings while preserving every untargeted option", () => {
  const result = resolveCustomWidgetSettingsUpdate(widget, expandedTables, {
    access: "read table",
    columnsMapping: {
      title: "Name",
      extras: ["Email", "Tags"],
      optional: null
    }
  });

  assert.deepEqual(result.options, {
    unrelatedTopLevel: { keep: true },
    customView: {
      mode: "url",
      url: "https://widget.example.invalid/private",
      widgetId: "@example/people-widget",
      pluginId: "internal-plugin",
      access: "read table",
      widgetOptions: { arbitrary: [1, 2, 3] },
      columnsMapping: {
        title: 11,
        extras: [12, 13],
        optional: null
      }
    }
  });
  assert.deepEqual(JSON.parse(result.optionsJson), result.options);
  assert.equal(widget.options.customView.access, "none");
  assert.deepEqual(widget.options.customView.columnsMapping, { title: 11 });
});

test("access-only update does not require or rewrite existing mappings", () => {
  const result = resolveCustomWidgetSettingsUpdate(widget, { tables: [] }, {
    access: "full"
  });
  assert.equal((result.options.customView as Record<string, unknown>).access, "full");
  assert.deepEqual(
    (result.options.customView as Record<string, unknown>).columnsMapping,
    { title: 11 }
  );
});

test("mapping clear is explicit and preserves the rest of customView", () => {
  const result = resolveCustomWidgetSettingsUpdate(widget, expandedTables, {
    columnsMapping: null
  });
  assert.equal(
    (result.options.customView as Record<string, unknown>).columnsMapping,
    null
  );
  assert.equal(
    (result.options.customView as Record<string, unknown>).widgetId,
    "@example/people-widget"
  );
});

test("refuses non-custom targets, malformed options and unknown or duplicate column IDs", () => {
  assert.throws(
    () =>
      resolveCustomWidgetSettingsUpdate(
        { ...widget, type: "record" },
        expandedTables,
        { access: "full" }
      ),
    /not a custom widget/
  );
  assert.throws(
    () =>
      resolveCustomWidgetSettingsUpdate(
        { ...widget, options: "broken" },
        expandedTables,
        { access: "full" }
      ),
    /refusing to overwrite/
  );
  assert.throws(
    () =>
      resolveCustomWidgetSettingsUpdate(widget, expandedTables, {
        columnsMapping: { title: "Missing" }
      }),
    /does not exist/
  );
  assert.throws(
    () =>
      resolveCustomWidgetSettingsUpdate(widget, expandedTables, {
        columnsMapping: { extras: ["Email", "Email"] }
      }),
    /duplicate column ID/
  );
});

test("refuses mapping resolution beyond the schema ceiling before write", () => {
  const columns = Array.from({ length: 5001 }, (_, index) => ({
    id: `C${index}`,
    fields: { colRef: index + 1, type: "Text" }
  }));
  assert.throws(
    () =>
      resolveCustomWidgetSettingsUpdate(
        widget,
        { tables: [{ id: "People", fields: { tableRef: 1 }, columns }] },
        { columnsMapping: { title: "C1" } }
      ),
    /more than 5000 columns/
  );
});

test("sameJsonValue compares objects structurally but preserves array order", () => {
  assert.equal(
    sameJsonValue(
      { b: [1, { y: 2, x: 1 }], a: true },
      { a: true, b: [1, { x: 1, y: 2 }] }
    ),
    true
  );
  assert.equal(sameJsonValue({ a: [1, 2] }, { a: [2, 1] }), false);
});
