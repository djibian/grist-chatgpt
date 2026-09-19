import assert from "node:assert/strict";
import test from "node:test";

import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";
import type { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function harness(applyWrite = true) {
  let options: Record<string, unknown> = {
    verticalGridlines: true,
    horizontalGridlines: true,
    zebraStripes: false,
    unrelated: { keep: [1, 2, 3] }
  };
  const writes: unknown[] = [];

  const inner = {
    maxReadRecords: 5000,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async () => ({
      tables: [{ id: "People", fields: { tableRef: 2 } }]
    }),
    queryRecords: async (_documentId: string, tableId: string) => {
      if (tableId === "_grist_Pages") {
        return { records: [{ id: 12, fields: { viewRef: 7, indentation: 0, pagePos: 1 } }] };
      }
      if (tableId === "_grist_Views") {
        return { records: [{ id: 7, fields: { name: "Page", type: "empty", layoutSpec: "" } }] };
      }
      if (tableId === "_grist_Views_section") {
        return {
          records: [{
            id: 21,
            fields: {
              parentId: 7,
              tableRef: 2,
              parentKey: "record",
              title: "People",
              description: "",
              chartType: "",
              options: JSON.stringify(options),
              layoutSpec: "",
              sortColRefs: "[]",
              linkSrcSectionRef: 0,
              linkSrcColRef: 0,
              linkTargetColRef: 0
            }
          }]
        };
      }
      return { records: [] };
    }
  } as unknown as GristService;

  const authorization = {
    assertDocumentAllowed: async (_principal: Principal, documentId: string) => documentId
  } as unknown as AuthorizationService;
  const audit = {
    nextRequestId: () => "request-grid-options",
    record: () => undefined
  } as unknown as AuditLogger;
  const principal: Principal = {
    id: "test-client",
    transport: "mcp",
    grants: [{
      documentIds: ["doc-1"],
      workspaceIds: [],
      capabilities: ["doc.schema:write"]
    }]
  };
  const uiActions = {
    updatePageWidget: async (
      documentId: string,
      widgetId: number,
      update: { optionsJson?: string }
    ) => {
      writes.push({ documentId, widgetId, update });
      if (applyWrite && update.optionsJson !== undefined) {
        options = JSON.parse(update.optionsJson) as Record<string, unknown>;
      }
    }
  } as unknown as GristUiActionsAdapter;

  return {
    service: new AuthorizedGristService(inner, authorization, audit, principal, uiActions),
    writes,
    currentOptions: () => options
  };
}

test("authorized grid update preserves unrelated options and returns normalized effective state", async () => {
  const { service, writes, currentOptions } = harness();

  const result = await service.updatePageWidget("doc-1", 7, 21, {
    gridOptions: {
      verticalGridlines: false,
      zebraStripes: true,
      rowNumbers: "rowId"
    }
  }) as {
    widget: {
      options: unknown;
      gridOptions?: unknown;
      gridOptionsNormalizationIncomplete?: boolean;
    };
  };

  assert.equal(writes.length, 1);
  const written = writes[0] as {
    documentId: string;
    widgetId: number;
    update: { optionsJson: string };
  };
  assert.equal(written.documentId, "doc-1");
  assert.equal(written.widgetId, 21);
  assert.deepEqual(JSON.parse(written.update.optionsJson), {
    verticalGridlines: false,
    horizontalGridlines: true,
    zebraStripes: true,
    rowNumbers: "rowId",
    unrelated: { keep: [1, 2, 3] }
  });
  assert.deepEqual(result.widget.options, currentOptions());
  assert.deepEqual(result.widget.gridOptions, {
    verticalGridlines: false,
    horizontalGridlines: true,
    zebraStripes: true,
    rowNumbers: "rowId"
  });
  assert.equal(result.widget.gridOptionsNormalizationIncomplete, undefined);
});

test("grid option post-write divergence is a non-retryable verification failure", async () => {
  const { service } = harness(false);

  await assert.rejects(
    () => service.updatePageWidget("doc-1", 7, 21, {
      gridOptions: { rowNumbers: "hidden" }
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "UiWriteVerificationError");
      assert.match(error.message, /did not preserve the exact expected options/);
      assert.match(error.message, /do not retry the whole operation blindly/i);
      return true;
    }
  );
});
