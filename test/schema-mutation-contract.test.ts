import assert from "node:assert/strict";
import test from "node:test";

import { buildSchemaOpenApiPaths } from "../src/actions/schemaApi.js";
import {
  columnMutationFieldsSchema,
  tableMutationFieldsSchema
} from "../src/operations/schemaMutationContract.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test("column mutation fields accept only the stable public semantic allowlist", () => {
  const accepted = {
    label: "Amount",
    type: "Numeric",
    isFormula: true,
    formula: "$Price * $Quantity",
    description: "Computed amount",
    widgetOptions: "{}"
  };

  assert.deepEqual(columnMutationFieldsSchema.parse(accepted), accepted);
  assert.equal(
    columnMutationFieldsSchema.safeParse({ ...accepted, visibleCol: 17 }).success,
    false
  );
  assert.equal(
    columnMutationFieldsSchema.safeParse({ enginePrivateField: 42 }).success,
    false
  );
});

test("table mutation fields accept only tableId and onDemand", () => {
  const accepted = { tableId: "Renamed", onDemand: true };

  assert.deepEqual(tableMutationFieldsSchema.parse(accepted), accepted);
  assert.equal(
    tableMutationFieldsSchema.safeParse({ ...accepted, summarySourceTable: 7 }).success,
    false
  );
  assert.equal(
    tableMutationFieldsSchema.safeParse({ tableId: "" }).success,
    false
  );
});

test("GPT Actions OpenAPI exposes the same closed column and table field sets", () => {
  const paths = buildSchemaOpenApiPaths(100);

  const tableUpdatePath = record(paths["/api/v1/documents/{documentId}/schema/tables/update"]);
  const tablePost = record(tableUpdatePath.post);
  const tableRequest = record(tablePost.requestBody);
  const tableContent = record(tableRequest.content);
  const tableJson = record(tableContent["application/json"]);
  const tableBody = record(tableJson.schema);
  const tableProperties = record(tableBody.properties);
  const tables = record(tableProperties.tables);
  const tableItem = record(tables.items);
  const tableItemProperties = record(tableItem.properties);
  const tableFields = record(tableItemProperties.fields);

  assert.equal(tableFields.additionalProperties, false);
  assert.deepEqual(Object.keys(record(tableFields.properties)).sort(), ["onDemand", "tableId"]);

  const columnUpdatePath = record(
    paths["/api/v1/documents/{documentId}/tables/{tableId}/columns/update"]
  );
  const columnPost = record(columnUpdatePath.post);
  const columnRequest = record(columnPost.requestBody);
  const columnContent = record(columnRequest.content);
  const columnJson = record(columnContent["application/json"]);
  const columnBody = record(columnJson.schema);
  const columnProperties = record(columnBody.properties);
  const columns = record(columnProperties.columns);
  const columnItem = record(columns.items);
  const columnItemProperties = record(columnItem.properties);
  const columnFields = record(columnItemProperties.fields);

  assert.equal(columnFields.additionalProperties, false);
  assert.deepEqual(Object.keys(record(columnFields.properties)).sort(), [
    "description",
    "formula",
    "isFormula",
    "label",
    "type",
    "widgetOptions"
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(record(columnFields.properties), "visibleCol"), false);
});
