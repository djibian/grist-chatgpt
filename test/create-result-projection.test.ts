import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService } from "../src/grist/service.js";

function makeService(overrides: Record<string, unknown> = {}) {
  let nextRecordId = 50;
  const client = {
    createTables: async () => ({
      tables: [
        { id: "People", fields: { tableRef: 17 }, engine: "private" },
        { id: "Places", fields: { tableRef: 18 }, engine: "private" }
      ],
      engineEnvelope: "private"
    }),
    createColumns: async () => ({
      columns: [
        { id: "Name", fields: { colRef: 21 }, engine: "private" },
        { id: "Age", fields: { colRef: 22 }, engine: "private" }
      ],
      engineEnvelope: "private"
    }),
    createRecords: async (_documentId: string, _tableId: string, records: unknown[]) => ({
      records: records.map(() => ({
        id: nextRecordId++,
        fields: { unexpected: true },
        engine: "private"
      })),
      engineEnvelope: "private"
    }),
    ...overrides
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId
  } as unknown as AccessPolicy;

  return new GristService(client, accessPolicy, {
    maxReadRecords: 1000,
    maxWriteRecords: 100,
    writeBatchRecords: 2,
    maxSchemaItems: 100
  });
}

test("create results retain only documented functional IDs", async () => {
  const grist = makeService();

  assert.deepEqual(
    await grist.createTables("doc", [
      { id: "People" },
      { id: "Places" }
    ]),
    {
      tables: [{ id: "People" }, { id: "Places" }]
    }
  );

  assert.deepEqual(
    await grist.createColumns("doc", "People", [
      { id: "Name" },
      { id: "Age" }
    ]),
    {
      columns: [{ id: "Name" }, { id: "Age" }]
    }
  );

  assert.deepEqual(
    await grist.createRecords("doc", "People", [
      { fields: { Name: "A" } },
      { fields: { Name: "B" } },
      { fields: { Name: "C" } }
    ]),
    {
      batches: 2,
      results: [
        { records: [{ id: 50 }, { id: 51 }] },
        { records: [{ id: 52 }] }
      ]
    }
  );
});

test("unexpected successful create responses are marked incomplete instead of throwing", async () => {
  const grist = makeService({
    createTables: async () => ({ tables: [{ id: "People", engine: "private" }] }),
    createColumns: async () => ({ columns: [{ id: "Name" }, { wrong: "shape" }] }),
    createRecords: async () => ({ records: [{ id: 77 }, { id: "not-a-record-id" }] })
  });

  assert.deepEqual(
    await grist.createTables("doc", [
      { id: "People" },
      { id: "Places" }
    ]),
    {
      tables: [{ id: "People" }],
      resultNormalizationIncomplete: true
    }
  );

  assert.deepEqual(
    await grist.createColumns("doc", "People", [
      { id: "Name" },
      { id: "Age" }
    ]),
    {
      columns: [{ id: "Name" }],
      resultNormalizationIncomplete: true
    }
  );

  assert.deepEqual(
    await grist.createRecords("doc", "People", [
      { fields: { Name: "A" } },
      { fields: { Name: "B" } }
    ]),
    {
      records: [{ id: 77 }],
      resultNormalizationIncomplete: true
    }
  );

  const serialized = JSON.stringify([
    await grist.createTables("doc", [{ id: "People" }, { id: "Places" }]),
    await grist.createColumns("doc", "People", [{ id: "Name" }, { id: "Age" }])
  ]);
  assert.equal(serialized.includes("engine"), false);
});
