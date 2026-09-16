import assert from "node:assert/strict";
import test from "node:test";

import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";
import type { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function buildHarness() {
  let pageCreated = false;
  let widgetCreated = false;
  const capabilities: string[] = [];
  const uiCalls: unknown[] = [];

  const inner = {
    maxReadRecords: 5000,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async () => ({
      tables: [{ id: "Personnes", fields: { tableRef: 2 } }]
    }),
    queryRecords: async (_documentId: string, tableId: string) => {
      if (tableId === "_grist_Pages") {
        return {
          records: pageCreated
            ? [{ id: 12, fields: { viewRef: 7, indentation: 0, pagePos: 1 } }]
            : []
        };
      }
      if (tableId === "_grist_Views") {
        return {
          records: pageCreated
            ? [{ id: 7, fields: { name: "Vue générale", type: "empty", layoutSpec: "" } }]
            : []
        };
      }
      if (tableId === "_grist_Views_section") {
        return {
          records: widgetCreated
            ? [
                {
                  id: 11,
                  fields: {
                    parentId: 7,
                    tableRef: 2,
                    parentKey: "record",
                    title: "",
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
            : []
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
      capabilities.push(capability);
      return documentId;
    }
  } as unknown as AuthorizationService;

  const audit = {
    nextRequestId: () => "request-ui",
    record: () => undefined
  } as unknown as AuditLogger;

  const principal: Principal = {
    id: "test-client",
    transport: "mcp",
    grants: [
      {
        documentIds: ["doc-1"],
        workspaceIds: [],
        capabilities: ["doc.schema:write"]
      }
    ]
  };

  const uiActions = {
    createEmptyPage: async (documentId: string, tableId: string, name: string) => {
      uiCalls.push({ action: "page", documentId, tableId, name });
      pageCreated = true;
      return { pageId: 7 };
    },
    addPageWidget: async (
      documentId: string,
      pageId: number,
      tableRef: number,
      type: string
    ) => {
      uiCalls.push({ action: "widget", documentId, pageId, tableRef, type });
      widgetCreated = true;
      return { pageId, tableRef, widgetId: 11 };
    }
  } as unknown as GristUiActionsAdapter;

  return {
    service: new AuthorizedGristService(
      inner,
      authorization,
      audit,
      principal,
      uiActions
    ),
    capabilities,
    uiCalls
  };
}

test("page creation requires structure capability and returns the re-read page", async () => {
  const { service, capabilities, uiCalls } = buildHarness();

  const result = await service.createPage("doc-1", "Personnes", "Vue générale");

  assert.deepEqual(capabilities, ["doc.schema:write"]);
  assert.deepEqual(uiCalls, [
    {
      action: "page",
      documentId: "doc-1",
      tableId: "Personnes",
      name: "Vue générale"
    }
  ]);
  assert.deepEqual(result, {
    documentId: "doc-1",
    page: {
      id: 7,
      pageRecordId: 12,
      name: "Vue générale",
      type: "empty",
      indentation: 0,
      pagePos: 1,
      widgetCount: 0,
      widgetIds: []
    }
  });
});

test("widget creation resolves tableRef internally and returns the re-read widget", async () => {
  const { service, capabilities, uiCalls } = buildHarness();

  await service.createPage("doc-1", "Personnes", "Vue générale");
  capabilities.length = 0;
  uiCalls.length = 0;

  const result = await service.addPageWidget(
    "doc-1",
    7,
    "Personnes",
    "record"
  );

  assert.deepEqual(capabilities, ["doc.schema:write"]);
  assert.deepEqual(uiCalls, [
    {
      action: "widget",
      documentId: "doc-1",
      pageId: 7,
      tableRef: 2,
      type: "record"
    }
  ]);
  assert.deepEqual(result, {
    documentId: "doc-1",
    pageId: 7,
    widget: {
      id: 11,
      pageId: 7,
      tableRef: 2,
      tableId: "Personnes",
      type: "record",
      title: "",
      options: {},
      sortColRefs: []
    }
  });
});
