import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import type { GristClient } from "../src/grist/client.js";
import { GristService } from "../src/grist/service.js";

function harness() {
  const observed: unknown[] = [];
  const client = {
    applyUserActions: async (documentId: string, actions: unknown) => {
      observed.push({ documentId, actions });
      return {
        actionNum: 481,
        retValues: ["internal-engine-result"],
        stored: ["must-not-be-forwarded"]
      };
    }
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId
  } as unknown as AccessPolicy;

  return {
    grist: new GristService(client, accessPolicy, {
      maxReadRecords: 1000,
      maxWriteRecords: 100,
      writeBatchRecords: 20,
      maxSchemaItems: 100
    }),
    observed
  };
}

test("rename_column returns only the requested stable identifiers", async () => {
  const { grist, observed } = harness();

  assert.deepEqual(
    await grist.renameColumn("doc-1", "People", "FullName", "Name"),
    {
      tableId: "People",
      oldColumnId: "FullName",
      newColumnId: "Name",
      renamed: true
    }
  );
  assert.deepEqual(observed, [
    {
      documentId: "doc-1",
      actions: [["RenameColumn", "People", "FullName", "Name"]]
    }
  ]);
});

test("delete_table returns a semantic acknowledgement without Grist action internals", async () => {
  const { grist, observed } = harness();

  const result = await grist.deleteTable("doc-1", "OldTable");
  assert.deepEqual(result, { tableId: "OldTable", deleted: true });
  assert.equal(JSON.stringify(result).includes("actionNum"), false);
  assert.equal(JSON.stringify(result).includes("retValues"), false);
  assert.equal(JSON.stringify(result).includes("stored"), false);
  assert.deepEqual(observed, [
    {
      documentId: "doc-1",
      actions: [["RemoveTable", "OldTable"]]
    }
  ]);
});
