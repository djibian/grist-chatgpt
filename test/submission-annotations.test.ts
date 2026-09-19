import assert from "node:assert/strict";
import test from "node:test";

import { OPERATION_REGISTRY } from "../src/operations/registry.js";
import { buildSubmissionToolAnnotations } from "../src/operations/submissionAnnotations.js";

const destructiveWrites = [
  "delete_columns",
  "delete_records",
  "delete_table",
  "rename_column",
  "rename_page",
  "update_columns",
  "update_page_widget",
  "update_records",
  "update_tables"
].sort();

const additiveWrites = [
  "add_page_widget",
  "create_columns",
  "create_page",
  "create_records",
  "create_tables"
].sort();

test("MCP destructive annotations distinguish overwrite/delete from additive writes", () => {
  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => !operation.readOnly && operation.destructive)
      .map((operation) => operation.name)
      .sort(),
    destructiveWrites
  );

  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => !operation.readOnly && !operation.destructive)
      .map((operation) => operation.name)
      .sort(),
    additiveWrites
  );
});

test("every public tool has non-empty submission justifications for all three annotations", () => {
  const submission = buildSubmissionToolAnnotations();
  assert.equal(submission.length, OPERATION_REGISTRY.length);

  for (const tool of submission) {
    assert.ok(tool.justifications.readOnlyHint.trim().length > 0, tool.name);
    assert.ok(tool.justifications.destructiveHint.trim().length > 0, tool.name);
    assert.ok(tool.justifications.openWorldHint.trim().length > 0, tool.name);
    assert.equal(tool.annotations.openWorldHint, false, tool.name);
  }
});
