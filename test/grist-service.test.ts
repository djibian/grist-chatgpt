import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService, PartialBatchError } from "../src/grist/service.js";

function service(
  maxReadRecords = 1000,
  maxWriteRecords = 100,
  writeBatchRecords = 2,
  maxSchemaItems = 10,
  overrides: Record<string, unknown> = {}
) {
  const observed: unknown[] = [];
  const client = {
    queryRecords: async (documentId: string, tableId: string, options: unknown) => {
      observed.push({ action: "query", documentId, tableId, options });
      return { records: [] };
    },
    createRecords: async (documentId: string, tableId: string, records: unknown) => {
      observed.push({ action: "create", documentId, tableId, records });
      return { records: [] };
    },
    updateRecords: async (documentId: string, tableId: string, records: unknown) => {
      observed.push({ action: "update", documentId, tableId, records });
      return null;
    },
    deleteRecords: async (documentId: string, tableId: string, recordIds: unknown) => {
      observed.push({ action: "delete", documentId, tableId, recordIds });
      return null;
    },
    listTables: async () => ({ tables: [] }),
    listColumns: async (documentId: string, tableId: string, options: unknown) => {
      observed.push({ action: "listColumns", documentId, tableId, options });
      return { columns: [] };
    },
    createTables: async (documentId: string, tables: unknown) => {
      observed.push({ action: "createTables", documentId, tables });
      return { tables: [] };
    },
    updateTables: async (documentId: string, tables: unknown) => {
      observed.push({ action: "updateTables", documentId, tables });
      return null;
    },
    createColumns: async (documentId: string, tableId: string, columns: unknown) => {
      observed.push({ action: "createColumns", documentId, tableId, columns });
      return { columns: [] };
    },
    updateColumns: async (documentId: string, tableId: string, columns: unknown) => {
      observed.push({ action: "updateColumns", documentId, tableId, columns });
      return null;
    },
    deleteColumn: async (documentId: string, tableId: string, columnId: string) => {
      observed.push({ action: "deleteColumn", documentId, tableId, columnId });
      return null;
    },
    applyUserActions: async (documentId: string, actions: unknown) => {
      observed.push({ action: "apply", documentId, actions });
      return { actionNum: 1 };
    },
    ...overrides
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId,
    listAllowedDocuments: async () => []
  } as unknown as AccessPolicy;

  return {
    grist: new GristService(client, accessPolicy, {
      maxReadRecords,
      maxWriteRecords,
      writeBatchRecords,
      maxSchemaItems
    }),
    observed
  };
}

test("service forwards richer read options and enforces configured maximum", async () => {
  const { grist, observed } = service(1000, 100);
  await grist.queryRecords("doc", "Table1", {
    sort: "Nom,-Date",
    limit: 999,
    hidden: true,
    cellFormat: "typed"
  });

  assert.deepEqual(observed, [
    {
      action: "query",
      documentId: "doc",
      tableId: "Table1",
      options: {
        sort: "Nom,-Date",
        limit: 999,
        hidden: true,
        cellFormat: "typed"
      }
    }
  ]);

  await assert.rejects(
    () => grist.queryRecords("doc", "Table1", { limit: 1001 }),
    /exceeds configured maximum 1000/
  );
});

test("large writes are split into sequential internal batches", async () => {
  const { grist, observed } = service(1000, 10, 2);
  const result = await grist.createRecords("doc", "Table1", [
    { fields: { n: 1 } },
    { fields: { n: 2 } },
    { fields: { n: 3 } },
    { fields: { n: 4 } },
    { fields: { n: 5 } }
  ]);

  assert.equal((result as { batches: number }).batches, 3);
  assert.deepEqual(
    observed.map((entry: any) => entry.records.length),
    [2, 2, 1]
  );
});

test("partial batch failure reports already applied items and forbids blind retry", async () => {
  let calls = 0;
  const { grist } = service(1000, 10, 2, 10, {
    createRecords: async () => {
      calls += 1;
      if (calls === 2) throw new Error("upstream failure");
      return { records: [] };
    }
  });

  await assert.rejects(
    () =>
      grist.createRecords("doc", "Table1", [
        { fields: { n: 1 } },
        { fields: { n: 2 } },
        { fields: { n: 3 } }
      ]),
    (error: unknown) => {
      assert.ok(error instanceof PartialBatchError);
      assert.equal(error.operation, "createRecords");
      assert.equal(error.completedBatches, 1);
      assert.equal(error.completedItems, 2);
      assert.equal(error.failedBatch, 2);
      assert.match(error.message, /Do not retry the whole operation blindly/);
      return true;
    }
  );
});

test("delete requires unique positive IDs and batches them", async () => {
  const { grist, observed } = service(1000, 10, 2);
  await grist.deleteRecords("doc", "Table1", [1, 2, 3]);
  assert.deepEqual(
    observed.map((entry: any) => entry.recordIds),
    [[1, 2], [3]]
  );

  await assert.rejects(
    () => grist.deleteRecords("doc", "Table1", [1, 1]),
    /must be unique/
  );
  await assert.rejects(
    () => grist.deleteRecords("doc", "Table1", [0]),
    /positive integers/
  );
});

test("renameColumn and deleteTable emit only fixed targeted Grist actions", async () => {
  const { grist, observed } = service();

  await grist.renameColumn("doc", "People", "FullName", "Name");
  await grist.deleteTable("doc", "OldTable");

  assert.deepEqual(observed, [
    {
      action: "apply",
      documentId: "doc",
      actions: [["RenameColumn", "People", "FullName", "Name"]]
    },
    {
      action: "apply",
      documentId: "doc",
      actions: [["RemoveTable", "OldTable"]]
    }
  ]);
});

test("schema operations support formula/type/widget metadata and enforce guardrail", async () => {
  const { grist, observed } = service(1000, 100, 20, 2);

  await grist.createColumns("doc", "People", [
    { id: "Score", fields: { type: "Int", label: "Score" } },
    {
      id: "DoubleScore",
      fields: {
        type: "Int",
        isFormula: true,
        formula: "$Score * 2",
        widgetOptions: "{}"
      }
    }
  ]);

  assert.equal((observed[0] as any).action, "createColumns");
  await assert.rejects(
    () =>
      grist.createColumns("doc", "People", [
        { id: "A" },
        { id: "B" },
        { id: "C" }
      ]),
    /Schema item count 3 exceeds configured maximum 2/
  );
});

test("createTables counts tables and nested columns against one schema guardrail", async () => {
  const { grist } = service(1000, 100, 20, 3);

  await assert.rejects(
    () =>
      grist.createTables("doc", [
        { id: "A", columns: [{ id: "A1" }, { id: "A2" }] },
        { id: "B" }
      ]),
    /Schema item count 4 exceeds configured maximum 3/
  );
});

test("deleteColumns requires explicit unique column IDs", async () => {
  const { grist, observed } = service();
  await grist.deleteColumns("doc", "People", ["OldA", "OldB"]);
  assert.deepEqual(
    observed.map((entry: any) => entry.columnId),
    ["OldA", "OldB"]
  );

  await assert.rejects(
    () => grist.deleteColumns("doc", "People", ["OldA", "OldA"]),
    /Column IDs must be unique/
  );
});

test("zero limits mean unlimited bridge-side guardrails", async () => {
  const { grist } = service(0, 0, 200, 0);
  await grist.queryRecords("doc", "Table1", { limit: 100000 });
  await grist.createRecords(
    "doc",
    "Table1",
    Array.from({ length: 1000 }, (_, i) => ({ fields: { i } }))
  );
  await grist.createColumns(
    "doc",
    "Table1",
    Array.from({ length: 500 }, (_, i) => ({ id: `C${i}` }))
  );
});
