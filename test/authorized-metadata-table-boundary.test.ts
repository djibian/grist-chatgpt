import assert from "node:assert/strict";
import test from "node:test";

import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";
import type { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function harness() {
  const calls: string[] = [];
  const called = (name: string, result: unknown = {}) => async () => {
    calls.push(name);
    return result;
  };

  const inner = {
    maxReadRecords: 5000,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listColumns: called("listColumns", { columns: [] }),
    queryRecords: called("queryRecords", { records: [] }),
    createRecords: called("createRecords"),
    updateRecords: called("updateRecords"),
    deleteRecords: called("deleteRecords"),
    createTables: called("createTables"),
    updateTables: called("updateTables"),
    deleteTable: called("deleteTable"),
    createColumns: called("createColumns"),
    updateColumns: called("updateColumns"),
    renameColumn: called("renameColumn"),
    deleteColumns: called("deleteColumns")
  } as unknown as GristService;

  const authorization = {
    assertDocumentAllowed: async (_principal: Principal, documentId: string) => documentId
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
        capabilities: ["doc:read", "doc:write", "doc.schema:write"]
      }
    ]
  };

  return {
    calls,
    service: new AuthorizedGristService(
      inner,
      authorization,
      audit,
      principal,
      {} as GristUiActionsAdapter
    )
  };
}

const metadataError = /metadata tables are internal to the bridge/;

test("all model-facing table-targeted operations reject _grist_ metadata tables before upstream access", async () => {
  const { service, calls } = harness();
  const attempts: Array<() => Promise<unknown>> = [
    () => service.listColumns("doc-1", "_grist_Tables"),
    () => service.queryRecords("doc-1", "_grist_Views", { limit: 1 }),
    () => service.createRecords("doc-1", "_grist_Tables", [{ fields: {} }]),
    () => service.updateRecords("doc-1", "_grist_Tables", [{ id: 1, fields: {} }]),
    () => service.deleteRecords("doc-1", "_grist_Tables", [1]),
    () => service.updateTables("doc-1", [{ id: "_grist_Tables", fields: { onDemand: false } }]),
    () => service.deleteTable("doc-1", "_grist_Tables"),
    () => service.createColumns("doc-1", "_grist_Tables", [{ id: "Column" }]),
    () => service.updateColumns("doc-1", "_grist_Tables", [{ id: "Column", fields: { label: "Column" } }]),
    () => service.renameColumn("doc-1", "_grist_Tables", "Old", "New"),
    () => service.deleteColumns("doc-1", "_grist_Tables", ["Column"])
  ];

  for (const attempt of attempts) {
    await assert.rejects(attempt, metadataError);
  }
  assert.deepEqual(calls, []);
});

test("table creation and rename cannot target reserved _grist_ identifiers", async () => {
  const { service, calls } = harness();

  await assert.rejects(
    () => service.createTables("doc-1", [{ id: "_grist_Custom" }]),
    metadataError
  );
  await assert.rejects(
    () => service.updateTables("doc-1", [{ id: "MCP_Test", fields: { tableId: "_grist_Custom" } }]),
    metadataError
  );

  assert.deepEqual(calls, []);
});

test("ordinary user-table operations still reach the authorized upstream service", async () => {
  const { service, calls } = harness();

  await service.listColumns("doc-1", "MCP_Test");
  await service.createRecords("doc-1", "MCP_Test", [{ fields: { Name: "ok" } }]);
  await service.updateTables("doc-1", [{ id: "MCP_Test", fields: { tableId: "Renamed" } }]);

  assert.deepEqual(calls, ["listColumns", "createRecords", "updateTables"]);
});
