import assert from "node:assert/strict";
import test from "node:test";

import {
  ConcurrencyProtectionUnavailableError,
  executeDirectContractualOperation,
  getOperationConcurrencyClass
} from "../src/execution/concurrencyGuard.js";
import { OPERATION_REGISTRY } from "../src/operations/registry.js";

const overwriteSensitive = [
  "update_records",
  "delete_records",
  "update_tables",
  "delete_table",
  "update_columns",
  "rename_column",
  "delete_columns",
  "rename_page",
  "update_page_layout",
  "update_page_widget"
] as const;

const additive = [
  "create_records",
  "create_tables",
  "create_columns",
  "create_page",
  "add_page_widget"
] as const;

test("every current operation has an explicit contractual concurrency classification", () => {
  for (const operation of OPERATION_REGISTRY) {
    const concurrencyClass = getOperationConcurrencyClass(operation.name);
    assert.ok(
      ["READ_ONLY", "ADDITIVE", "OVERWRITE_SENSITIVE"].includes(concurrencyClass),
      `${operation.name} was not classified`
    );
  }
});

test("current overwrite-sensitive operations are explicitly classified", () => {
  for (const operation of overwriteSensitive) {
    assert.equal(getOperationConcurrencyClass(operation), "OVERWRITE_SENSITIVE");
  }
});

test("current additive operations are explicitly classified", () => {
  for (const operation of additive) {
    assert.equal(getOperationConcurrencyClass(operation), "ADDITIVE");
  }
});

test("J0 T2: direct contractual widget overwrite is refused before a human change can be erased", async () => {
  const state = {
    widgetOptions: { access: "read table", mapping: "original" },
    writes: 0
  };

  // Simulate a human changing the live document after the Builder inspected it.
  state.widgetOptions = { access: "read table", mapping: "human-change" };

  await assert.rejects(
    () =>
      executeDirectContractualOperation("update_page_widget", async () => {
        state.writes += 1;
        state.widgetOptions = { access: "full", mapping: "builder-change" };
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConcurrencyProtectionUnavailableError);
      assert.equal(error.operation, "update_page_widget");
      return true;
    }
  );

  assert.equal(state.writes, 0);
  assert.deepEqual(state.widgetOptions, {
    access: "read table",
    mapping: "human-change"
  });
});

test("additive and read-only contractual operations may execute directly", async () => {
  let calls = 0;
  const created = await executeDirectContractualOperation("create_records", async () => {
    calls += 1;
    return 701;
  });
  const read = await executeDirectContractualOperation("inspect_document", async () => {
    calls += 1;
    return "observed";
  });

  assert.equal(created, 701);
  assert.equal(read, "observed");
  assert.equal(calls, 2);
});
