import assert from "node:assert/strict";
import test from "node:test";

import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";
import {
  UiWriteVerificationError,
  type GristUiActionsAdapter
} from "../src/grist/uiActionsAdapter.js";

const principal: Principal = {
  id: "authorized-page-layout-test",
  transport: "mcp",
  grants: [
    {
      documentIds: ["doc-1"],
      workspaceIds: [],
      capabilities: ["doc.schema:write"]
    }
  ]
};

const authorization = {
  assertDocumentAllowed: async (
    _principal: Principal,
    documentId: string
  ) => documentId
} as unknown as AuthorizationService;

const audit = {
  nextRequestId: () => "request-page-layout",
  record: () => undefined
} as unknown as AuditLogger;

function sectionRecord(id: number) {
  return {
    id,
    fields: {
      parentId: 7,
      tableRef: 2,
      parentKey: "record",
      title: `Widget ${id}`,
      description: "",
      chartType: "",
      options: "{}",
      layoutSpec: "",
      sortColRefs: "[]",
      linkSrcSectionRef: 0,
      linkSrcColRef: 0,
      linkTargetColRef: 0
    }
  };
}

function harness(options: {
  applyWrite?: boolean;
  initialLayoutSpec?: string;
} = {}) {
  const applyWrite = options.applyWrite ?? true;
  let layoutSpec = options.initialLayoutSpec ?? JSON.stringify({
    children: [{ leaf: 11 }, { leaf: 12 }]
  });
  const writes: Array<{
    documentId: string;
    pageId: number;
    layoutSpecJson: string;
  }> = [];

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
        return {
          records: [
            {
              id: 17,
              fields: { viewRef: 7, indentation: 0, pagePos: 1 }
            }
          ]
        };
      }
      if (tableId === "_grist_Views") {
        return {
          records: [
            {
              id: 7,
              fields: { name: "Dashboard", type: "raw_data", layoutSpec }
            }
          ]
        };
      }
      if (tableId === "_grist_Views_section") {
        return { records: [sectionRecord(11), sectionRecord(12)] };
      }
      return { records: [] };
    }
  } as unknown as GristService;

  const uiActions = {
    updatePageLayout: async (
      documentId: string,
      pageId: number,
      layoutSpecJson: string
    ) => {
      writes.push({ documentId, pageId, layoutSpecJson });
      if (applyWrite) layoutSpec = layoutSpecJson;
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
    writes
  };
}

test("authorized page layout update emits one bounded BoxSpec write and verifies exact normalized state", async () => {
  const { service, writes } = harness();

  const result = await service.updatePageLayout("doc-1", 7, {
    root: { kind: "widget", widgetId: 11, size: 75 },
    collapsedWidgetIds: [12]
  }) as {
    documentId: string;
    page: {
      id: number;
      layoutNormalized?: unknown;
      widgetCount: number;
      widgetIds: number[];
    };
  };

  assert.deepEqual(writes, [
    {
      documentId: "doc-1",
      pageId: 7,
      layoutSpecJson: JSON.stringify({
        leaf: 11,
        size: 75,
        collapsed: [{ leaf: 12 }]
      })
    }
  ]);
  assert.equal(result.documentId, "doc-1");
  assert.equal(result.page.id, 7);
  assert.deepEqual(result.page.widgetIds, [11, 12]);
  assert.equal(result.page.widgetCount, 2);
  assert.deepEqual(result.page.layoutNormalized, {
    root: { kind: "widget", widgetId: 11, size: 75 },
    collapsedWidgetIds: [12],
    unplacedWidgetIds: []
  });
});

test("page layout post-write divergence is a non-retryable verification failure", async () => {
  const { service, writes } = harness({ applyWrite: false });

  await assert.rejects(
    () =>
      service.updatePageLayout("doc-1", 7, {
        root: { kind: "widget", widgetId: 11 },
        collapsedWidgetIds: [12]
      }),
    (error: unknown) => {
      assert.ok(error instanceof UiWriteVerificationError);
      assert.match(error.message, /did not match the requested normalized layout/i);
      assert.match(error.message, /do not retry the whole operation blindly/i);
      return true;
    }
  );
  assert.equal(writes.length, 1);
});

test("page layout update refuses incomplete current layout before writing", async () => {
  const { service, writes } = harness({
    initialLayoutSpec: JSON.stringify({
      children: [{ leaf: 11 }, { leaf: 999 }]
    })
  });

  await assert.rejects(
    () =>
      service.updatePageLayout("doc-1", 7, {
        root: {
          kind: "group",
          children: [
            { kind: "widget", widgetId: 11 },
            { kind: "widget", widgetId: 12 }
          ]
        }
      }),
    /incomplete or unsupported current layout metadata/i
  );
  assert.deepEqual(writes, []);
});
