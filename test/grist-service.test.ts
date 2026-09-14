import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService } from "../src/grist/service.js";

function service(
  maxReadRecords = 1000,
  maxWriteRecords = 100,
  writeBatchRecords = 2
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
    listTables: async () => ({ tables: [] })
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId,
    listAllowedDocuments: async () => []
  } as unknown as AccessPolicy;

  return {
    grist: new GristService(client, accessPolicy, {
      maxReadRecords,
      maxWriteRecords,
      writeBatchRecords
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

test("zero limits mean unlimited bridge-side guardrails", async () => {
  const { grist } = service(0, 0, 200);
  await grist.queryRecords("doc", "Table1", { limit: 100000 });
  await grist.createRecords(
    "doc",
    "Table1",
    Array.from({ length: 1000 }, (_, i) => ({ fields: { i } }))
  );
});
