import assert from "node:assert/strict";
import test from "node:test";

import { buildUiOpenApiPaths } from "../src/actions/uiApi.js";
import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import { GRIST_CHART_TYPES } from "../src/grist/chartTypes.js";
import type { GristClient } from "../src/grist/client.js";
import type { GristService } from "../src/grist/service.js";
import { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function authorizedHarness(targetType: "chart" | "record") {
  let chartType = targetType === "chart" ? "bar" : "";
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
          records: [{ id: 12, fields: { viewRef: 7, indentation: 0, pagePos: 1 } }]
        };
      }
      if (tableId === "_grist_Views") {
        return {
          records: [{ id: 7, fields: { name: "Vue", type: "empty", layoutSpec: "" } }]
        };
      }
      if (tableId === "_grist_Views_section") {
        return {
          records: [
            {
              id: 11,
              fields: {
                parentId: 7,
                tableRef: 2,
                parentKey: targetType,
                title: "Widget",
                description: "",
                chartType,
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
      _capability: string
    ) => documentId
  } as unknown as AuthorizationService;

  const audit = {
    nextRequestId: () => "request-chart",
    record: () => undefined
  } as unknown as AuditLogger;

  const principal: Principal = {
    id: "chart-test",
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
    updatePageWidget: async (
      documentId: string,
      widgetId: number,
      update: { chartType?: (typeof GRIST_CHART_TYPES)[number] }
    ) => {
      uiCalls.push({ documentId, widgetId, update });
      if (update.chartType !== undefined) chartType = update.chartType;
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
    uiCalls
  };
}

test("UI adapter writes only the bounded chartType field", async () => {
  const observed: unknown[][][] = [];
  const client = {
    applyUserActions: async (_documentId: string, actions: unknown[][]) => {
      observed.push(actions);
      return { actionNum: 1, retValues: [] };
    }
  } as Pick<GristClient, "applyUserActions">;
  const adapter = new GristUiActionsAdapter(client);

  await adapter.updatePageWidget("doc-1", 11, { chartType: "line" });

  assert.deepEqual(observed, [
    [["UpdateRecord", "_grist_Views_section", 11, { chartType: "line" }]]
  ]);
});

test("chart type update is restricted to chart widgets and verified by re-read", async () => {
  const { service, uiCalls } = authorizedHarness("chart");

  const result = await service.updatePageWidget("doc-1", 7, 11, {
    chartType: "donut"
  });

  assert.deepEqual(uiCalls, [
    { documentId: "doc-1", widgetId: 11, update: { chartType: "donut" } }
  ]);
  assert.equal(
    (result as { widget: { chartType?: string } }).widget.chartType,
    "donut"
  );
});

test("chart type update rejects a non-chart widget before any write", async () => {
  const { service, uiCalls } = authorizedHarness("record");

  await assert.rejects(
    () => service.updatePageWidget("doc-1", 7, 11, { chartType: "line" }),
    /is not a chart widget/
  );
  assert.deepEqual(uiCalls, []);
});

test("GPT Actions publishes exactly the supported native chart types", () => {
  const paths = buildUiOpenApiPaths() as Record<string, unknown>;
  const path = paths[
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"
  ] as Record<string, unknown>;
  const patch = path.patch as Record<string, unknown>;
  const requestBody = patch.requestBody as Record<string, unknown>;
  const content = requestBody.content as Record<string, unknown>;
  const json = content["application/json"] as Record<string, unknown>;
  const schema = json.schema as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown>;
  const chartType = properties.chartType as Record<string, unknown>;

  assert.deepEqual(chartType.enum, [...GRIST_CHART_TYPES]);
});
