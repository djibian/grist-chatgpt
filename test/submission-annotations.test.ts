import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { OPERATION_REGISTRY } from "../src/operations/registry.js";
import {
  buildSubmissionArtifactTools,
  buildSubmissionToolAnnotations
} from "../src/operations/submissionAnnotations.js";

const destructiveWrites = [
  "delete_columns",
  "delete_records",
  "delete_table",
  "rename_column",
  "rename_page",
  "update_columns",
  "update_page_layout",
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

const auditedReads = [
  "list_documents",
  "list_tables",
  "list_columns",
  "query_records",
  "inspect_document",
  "get_pages",
  "get_page_widgets"
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
    [...additiveWrites, ...auditedReads].sort()
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

test("tracked ChatGPT submission tool metadata cannot drift from the operation registry", async () => {
  const raw = await readFile(new URL("../chatgpt-app-submission.json", import.meta.url), "utf8");
  const artifact = JSON.parse(raw) as { tools?: unknown };

  assert.deepEqual(artifact.tools, buildSubmissionArtifactTools());
});

test("audited reads retain read capability and report only additive audit side effects", () => {
  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => operation.auditOnly)
      .map((operation) => operation.name)
      .sort(),
    auditedReads
  );
  for (const name of auditedReads) {
    const operation = OPERATION_REGISTRY.find((entry) => entry.name === name)!;
    assert.equal(operation.capability, "doc:read");
    const tool = buildSubmissionToolAnnotations().find((entry) => entry.name === name)!;
    assert.deepEqual(tool.annotations, {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false
    });
    assert.match(tool.justifications.readOnlyHint, /appends an audit event/);
    assert.match(tool.justifications.destructiveHint, /does not overwrite or delete user data/);
  }
  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => operation.readOnly).map((operation) => operation.name),
    ["grist_help"]
  );
});
