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
  id: "q0-ui-completeness",
  transport: "mcp",
  grants: [
    {
      documentIds: ["doc-1"],
      workspaceIds: [],
      capabilities: ["doc:read", "doc.schema:write"]
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
  nextRequestId: () => "q0-ui-completeness",
  record: () => undefined
} as unknown as AuditLogger;

function tableResponse() {
  return {
    tables: [
      {
        id: "Personnes",
        fields: { tableRef: 2 }
      }
    ]
  };
}

function pageRecord(id: number, viewRef: number) {
  return { id, fields: { viewRef, indentation: 0, pagePos: id } };
}

function viewRecord(id: number, name: string) {
  return { id, fields: { name, type: "empty", layoutSpec: "" } };
}

function sectionRecord(id: number, linkSrcSectionRef: number) {
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
      linkSrcSectionRef,
      linkSrcColRef: 0,
      linkTargetColRef: 0
    }
  };
}

test("metadata reads that reach the bound are marked incomplete and block topology-sensitive mutation", async () => {
  const writes: unknown[] = [];
  const inner = {
    maxReadRecords: 2,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async () => tableResponse(),
    queryRecords: async (_documentId: string, tableId: string) => {
      if (tableId === "_grist_Pages") {
        return { records: [pageRecord(1, 7)] };
      }
      if (tableId === "_grist_Views") {
        return { records: [viewRecord(7, "Vue générale")] };
      }
      if (tableId === "_grist_Views_section") {
        return {
          records: [
            sectionRecord(11, 0),
            sectionRecord(12, 11)
          ]
        };
      }
      return { records: [] };
    }
  } as unknown as GristService;

  const uiActions = {
    updatePageWidget: async (
      documentId: string,
      widgetId: number,
      update: unknown
    ) => {
      writes.push({ documentId, widgetId, update });
    }
  } as unknown as GristUiActionsAdapter;

  const service = new AuthorizedGristService(
    inner,
    authorization,
    audit,
    principal,
    uiActions
  );

  const widgets = await service.getPageWidgets("doc-1", 7) as {
    metadataSnapshotIncomplete?: boolean;
  };
  assert.equal(widgets.metadataSnapshotIncomplete, true);

  await assert.rejects(
    () => service.updatePageWidget("doc-1", 7, 11, {
      selectBy: { sourceWidgetId: 12 }
    }),
    /metadata snapshot reached the configured read limit.*refusing a UI mutation/i
  );
  assert.deepEqual(writes, []);
});

test("post-write verification fails closed if the metadata snapshot reaches the bound", async () => {
  let created = false;
  let createCalls = 0;
  const inner = {
    maxReadRecords: 2,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async () => tableResponse(),
    queryRecords: async (_documentId: string, tableId: string) => {
      if (tableId === "_grist_Pages") {
        return {
          records: created
            ? [pageRecord(1, 7), pageRecord(2, 8)]
            : [pageRecord(1, 7)]
        };
      }
      if (tableId === "_grist_Views") {
        return {
          records: created
            ? [viewRecord(7, "Vue générale"), viewRecord(8, "Nouvelle vue")]
            : [viewRecord(7, "Vue générale")]
        };
      }
      if (tableId === "_grist_Views_section") {
        return { records: [] };
      }
      return { records: [] };
    }
  } as unknown as GristService;

  const uiActions = {
    createEmptyPage: async () => {
      createCalls++;
      created = true;
      return { pageId: 8 };
    }
  } as unknown as GristUiActionsAdapter;

  const service = new AuthorizedGristService(
    inner,
    authorization,
    audit,
    principal,
    uiActions
  );

  await assert.rejects(
    () => service.createPage("doc-1", "Personnes", "Nouvelle vue"),
    (error: unknown) => {
      assert.ok(error instanceof UiWriteVerificationError);
      assert.match(error.message, /metadata snapshot reached the configured read limit/i);
      assert.match(error.message, /do not retry the whole operation blindly/i);
      return true;
    }
  );
  assert.equal(createCalls, 1);
});
