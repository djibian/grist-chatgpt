import assert from "node:assert/strict";
import test from "node:test";

import { buildUiOpenApiPaths } from "../src/actions/uiApi.js";

test("widget update OpenAPI preserves stable-ID and bounded-setting guidance", () => {
  const paths = buildUiOpenApiPaths() as any;
  const patch = paths[
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"
  ].patch;
  const properties = patch.requestBody.content["application/json"].schema.properties;

  assert.match(patch.description, /stable column IDs/);
  assert.match(patch.description, /directSelectByOptions/);
  assert.match(patch.description, /columnSelectByOptions/);
  assert.match(patch.description, /gridOptions/);

  const sort = properties.sort.anyOf[0];
  assert.match(sort.description, /stable column IDs/);
  assert.match(sort.items.properties.columnId.description, /Never invent a numeric Grist colRef/);
  assert.match(sort.items.properties.emptyLast.description, /empty values/);
  assert.match(sort.items.properties.naturalSort.description, /Text columns/);
  assert.match(sort.items.properties.orderByChoice.description, /Choice\/ChoiceList/);

  const selectBy = properties.selectBy.anyOf[0].properties;
  assert.match(selectBy.sourceWidgetId.description, /getGristPageWidgets/);
  assert.match(selectBy.sourceColumnId.description, /columnSelectByOptions/);
  assert.match(selectBy.targetColumnId.description, /columnSelectByOptions/);

  assert.match(properties.customWidgetSettings.description, /stable-ID column mappings/);
  assert.match(
    properties.customWidgetSettings.properties.columnsMapping.anyOf[0].description,
    /Numeric Grist colRefs are never accepted/
  );

  assert.match(properties.gridOptions.description, /Table widget only/);
  assert.deepEqual(properties.gridOptions.properties.rowNumbers.enum, [
    "number",
    "rowId",
    "hidden"
  ]);
});
