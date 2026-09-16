import assert from "node:assert/strict";
import test from "node:test";

import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";

function harness() {
  const queriedTables: string[] = [];
  const inner = {
    maxReadRecords: 5000,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async () => ({
      tables: [{ id: "MCP_Test", fields: { tableRef: 1 } }]
    }),
    queryRecords: async (_documentId: string, tableId: string) => {
      queriedTables.push(tableId);
      if (tableId === "_grist_Pages") {
        return { records: [{ id: 10, fields: { viewRef: 1, indentation: 0, pagePos: 1 } }] };
      }
      if (tableId === "_grist_Views") {
        return { records: [{ id: 1, fields: { name: "MCP_Test", type: "raw_data", layoutSpec: "" } }] };
      }
      if (tableId === "_grist_Views_section") {
        return {
          records: [
            {
              id: 20,
              fields: {
                parentId: 1,
                tableRef: 1,
                parentKey: "record",
                title: "MCP_Test",
                description: "",
                chartType: "",
                options: "{}",
                layoutSpec: "",
                sortColRefs: "[]",
                linkSrcSectionRef: 0,
                linkSrcColRef: 0,
                linkTargetColRef: 0
              }
            }
          ]
        };
      }
      return { records: [] };
    }
  } as unknown as GristService;

  const authorization = {
    assertDocumentAllowed: async (
      _principal: Principal,
      documentId: string,
      capability: string
    ) => {
      assert.equal(capability, "doc:read");
      return documentId;
    }
  } as unknown as AuthorizationService;

  const audit = {
    nextRequestId: () => "request-1",
    record: () => undefined
  } as unknown as AuditLogger;

  const principal: Principal = {
    id: "test-client",
    transport: "mcp",
    grants: [
      {
        documentIds: ["doc-1"],
        workspaceIds: [],
        capabilities: ["doc:read"]
      }
    ]
  };

  return {
    service: new AuthorizedGristService(inner, authorization, audit, principal),
    queriedTables
  };
}

test("raw Grist metadata tables cannot be queried through model-facing query_records", async () => {
  const { service, queriedTables } = harness();

  await assert.rejects(
    () => service.queryRecords("doc-1", "_grist_Views", { limit: 10 }),
    /metadata tables are internal to the bridge/
  );
  assert.deepEqual(queriedTables, []);
});

test("semantic page inspection reads only the fixed internal metadata allowlist", async () => {
  const { service, queriedTables } = harness();

  const result = (await service.getPages("doc-1")) as {
    pages: Array<{ id: number; name: string; widgetIds: number[] }>;
  };

  assert.deepEqual(queriedTables, [
    "_grist_Pages",
    "_grist_Views",
    "_grist_Views_section"
  ]);
  assert.deepEqual(result.pages[0], {
    id: 1,
    pageRecordId: 10,
    name: "MCP_Test",
    type: "raw_data",
    indentation: 0,
    pagePos: 1,
    widgetCount: 1,
    widgetIds: [20]
  });
});
