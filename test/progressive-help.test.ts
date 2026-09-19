import assert from "node:assert/strict";
import test from "node:test";

import { OPERATION_REGISTRY, getOperation } from "../src/operations/registry.js";
import { progressiveOperationHelp } from "../src/operations/progressiveHelp.js";

test("default help remains a complete catalog with compact category counts", () => {
  const help = progressiveOperationHelp();

  assert.equal(help.operations.length, OPERATION_REGISTRY.length);
  assert.equal(
    help.categories.reduce((count, category) => count + category.operationCount, 0),
    OPERATION_REGISTRY.length
  );
  assert.equal("workflows" in help, false);
});

test("help can progressively filter one registry category", () => {
  const help = progressiveOperationHelp({ category: "ui" });

  assert.ok(help.operations.length > 0);
  assert.ok(help.operations.every((operation) => operation.category === "ui"));
  assert.deepEqual(
    help.operations.map((operation) => operation.name),
    OPERATION_REGISTRY.filter((operation) => operation.category === "ui").map(
      (operation) => operation.name
    )
  );
});

test("help keeps explicit operation lookup semantics and rejects mixed filters", () => {
  assert.deepEqual(
    progressiveOperationHelp({ operations: ["inspect_document", "query_records"] })
      .operations.map((operation) => operation.name),
    ["inspect_document", "query_records"]
  );

  assert.throws(
    () =>
      progressiveOperationHelp({
        operations: ["query_records"],
        category: "data"
      }),
    /operations or category, not both/
  );
});

test("optional workflows contain only current registry operations and risk metadata", () => {
  const help = progressiveOperationHelp({ includeWorkflows: true });
  assert.ok("workflows" in help);
  const workflows = help.workflows ?? [];
  assert.ok(workflows.length >= 4);

  for (const workflow of workflows) {
    assert.ok(workflow.id.length > 0);
    assert.ok(workflow.summary.length > 0);
    assert.ok(workflow.steps.length >= 2);
    for (const step of workflow.steps) {
      const operation = getOperation(step.operation);
      assert.equal(step.title, operation.title);
      assert.equal(step.capability, operation.capability);
      assert.equal(step.destructive, operation.destructive);
    }
  }
});
