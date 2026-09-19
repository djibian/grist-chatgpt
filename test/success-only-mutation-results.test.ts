import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService, PartialBatchError } from "../src/grist/service.js";

function service(overrides: Record<string, unknown> = {}) {
  const observed: Array<{ action: string; payload: unknown }> = [];
  let nextRecordId = 100;
  const client = {
    updateTables: async (_documentId: string, tables: unknown) => {
      observed.push({ action: "updateTables", payload: tables });
      return { engineActionNum: 41, internal: "do-not-expose" };
    },
    updateColumns: async (_documentId: string, _tableId: string, columns: unknown) => {
      observed.push({ action: "updateColumns", payload: columns });
      return { engineActionNum: 42, internal: "do-not-expose" };
    },
    deleteColumn: async (_documentId: string, _tableId: string, columnId: string) => {
      observed.push({ action: "deleteColumn", payload: columnId });
      return { engineActionNum: 43, internal: "do-not-expose" };
    },
    updateRecords: async (_documentId: string, _tableId: string, records: unknown[]) => {
      observed.push({ action: "updateRecords", payload: records });
      return { engineActionNum: 44, internal: "do-not-expose" };
    },
    deleteRecords: async (_documentId: string, _tableId: string, recordIds: number[]) => {
      observed.push({ action: "deleteRecords", payload: recordIds });
      return { engineActionNum: 45, internal: "do-not-expose" };
    },
    createRecords: async (_documentId: string, _tableId: string, records: unknown[]) => {
      observed.push({ action: "createRecords", payload: records });
      return {
        records: records.map(() => ({ id: nextRecordId++ }))
      };
    },
    ...overrides
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId
  } as unknown as AccessPolicy;

  return {
    grist: new GristService(client, accessPolicy, {
      maxReadRecords: 1000,
      maxWriteRecords: 100,
      writeBatchRecords: 2,
      maxSchemaItems: 100
    }),
    observed
  };
}

test("success-only record and schema mutations return bounded semantic acknowledgements", async () => {
  const { grist, observed } = service();

  assert.deepEqual(
    await grist.updateTables("doc", [
      { id: "People", fields: { onDemand: true } },
      { id: "Places", fields: { onDemand: false } }
    ]),
    {
      targetTableIds: ["People", "Places"],
      updated: true
    }
  );

  assert.deepEqual(
    await grist.updateColumns("doc", "People", [
      { id: "Name", fields: { label: "Full name" } },
      { id: "Age", fields: { type: "Int" } }
    ]),
    {
      tableId: "People",
      targetColumnIds: ["Name", "Age"],
      updated: true
    }
  );

  assert.deepEqual(
    await grist.deleteColumns("doc", "People", ["OldA", "OldB"]),
    {
      tableId: "People",
      columnIds: ["OldA", "OldB"],
      deleted: true
    }
  );

  assert.deepEqual(
    await grist.updateRecords("doc", "People", [
      { id: 1, fields: { Name: "A" } },
      { id: 2, fields: { Name: "B" } },
      { id: 3, fields: { Name: "C" } }
    ]),
    {
      tableId: "People",
      recordIds: [1, 2, 3],
      updated: true
    }
  );

  assert.deepEqual(
    await grist.deleteRecords("doc", "People", [4, 5, 6]),
    {
      tableId: "People",
      recordIds: [4, 5, 6],
      deleted: true
    }
  );

  assert.deepEqual(
    observed.filter((entry) => entry.action === "updateRecords").map((entry) => entry.payload),
    [
      [
        { id: 1, fields: { Name: "A" } },
        { id: 2, fields: { Name: "B" } }
      ],
      [{ id: 3, fields: { Name: "C" } }]
    ]
  );
  assert.deepEqual(
    observed.filter((entry) => entry.action === "deleteRecords").map((entry) => entry.payload),
    [[4, 5], [6]]
  );

  const serializedResults = JSON.stringify([
    await grist.updateTables("doc", [{ id: "Again", fields: {} }]),
    await grist.updateColumns("doc", "People", [{ id: "Again", fields: {} }])
  ]);
  assert.equal(serializedResults.includes("engineActionNum"), false);
  assert.equal(serializedResults.includes("do-not-expose"), false);
});

test("creation keeps functional upstream record IDs", async () => {
  const { grist } = service();

  const result = await grist.createRecords("doc", "People", [
    { fields: { Name: "A" } },
    { fields: { Name: "B" } },
    { fields: { Name: "C" } }
  ]);

  assert.deepEqual(result, {
    batches: 2,
    results: [
      { records: [{ id: 100 }, { id: 101 }] },
      { records: [{ id: 102 }] }
    ]
  });
});

test("acknowledgement batching preserves partial-write recovery semantics", async () => {
  let calls = 0;
  const { grist } = service({
    updateRecords: async () => {
      calls += 1;
      if (calls === 2) throw new Error("upstream failure");
      return { engineActionNum: 99 };
    }
  });

  await assert.rejects(
    () =>
      grist.updateRecords("doc", "People", [
        { id: 1, fields: { Name: "A" } },
        { id: 2, fields: { Name: "B" } },
        { id: 3, fields: { Name: "C" } }
      ]),
    (error: unknown) => {
      assert.ok(error instanceof PartialBatchError);
      assert.equal(error.operation, "updateRecords");
      assert.equal(error.completedBatches, 1);
      assert.equal(error.completedItems, 2);
      assert.equal(error.failedBatch, 2);
      assert.match(error.message, /Do not retry the whole operation blindly/);
      return true;
    }
  );
});
