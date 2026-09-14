import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService } from "../src/grist/service.js";

function service(maxReadRecords = 1000, maxWriteRecords = 100) {
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
    listTables: async () => ({ tables: [] })
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId,
    listAllowedDocuments: async () => []
  } as unknown as AccessPolicy;

  return {
    grist: new GristService(client, accessPolicy, {
      maxReadRecords,
      maxWriteRecords
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

test("zero limits mean unlimited bridge-side guardrails", async () => {
  const { grist } = service(0, 0);
  await grist.queryRecords("doc", "Table1", { limit: 100000 });
  await grist.createRecords(
    "doc",
    "Table1",
    Array.from({ length: 1000 }, (_, i) => ({ fields: { i } }))
  );
});
