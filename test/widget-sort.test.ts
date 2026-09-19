import assert from "node:assert/strict";
import test from "node:test";

import { buildUiOpenApiPaths } from "../src/actions/uiApi.js";
import type { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristClient } from "../src/grist/client.js";
import type { GristService } from "../src/grist/service.js";
import { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";
import {
  MAX_WIDGET_SORT_COLUMNS,
  resolveWidgetSort
} from "../src/grist/widgetSort.js";

const expandedTables = {
  tables: [
    {
      id: "Personnes",
      fields: { tableRef: 2 },
      columns: [
        { id: "Nom", fields: { colRef: 21, type: "Text" } },
        { id: "Score", fields: { colRef: 22, type: "Numeric" } },
        { id: "Statut", fields: { colRef: 23, type: "Choice" } }
      ]
    }
  ]
};

function authorizedHarness() {
  let sortColRefs: Array<number | string> = [];
  const uiCalls: unknown[] = [];
  const listTableOptions: unknown[] = [];

  const inner = {
    maxReadRecords: 5000,
    maxWriteRecords: 500,
    writeBatchRecords: 200,
    maxSchemaItems: 100,
    listTables: async (_documentId: string, options: unknown) => {
      listTableOptions.push(options);
      return expandedTables;
    },
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
                parentKey: "record",
                title: "Widget",
                description: "",
                chartType: "",
                options: "{}",
                layoutSpec: "",
                sortColRefs: JSON.stringify(sortColRefs),
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
    nextRequestId: () => "request-sort",
    record: () => undefined
  } as unknown as AuditLogger;

  const principal: Principal = {
    id: "sort-test",
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
      update: { sortColRefs?: Array<number | string> }
    ) => {
      uiCalls.push({ documentId, widgetId, update });
      if (update.sortColRefs !== undefined) {
        sortColRefs = [...update.sortColRefs];
      }
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
    uiCalls,
    listTableOptions
  };
}

test("sort resolver maps stable column IDs to bounded Grist sort specs", () => {
  const widget = {
    id: 11,
    pageId: 7,
    tableRef: 2,
    tableId: "Personnes",
    type: "record",
    title: "Widget"
  };

  assert.deepEqual(
    resolveWidgetSort(widget, expandedTables, [
      { columnId: "Nom", direction: "desc", emptyLast: true, naturalSort: true },
      { columnId: "Statut", direction: "asc", orderByChoice: true },
      { columnId: "Score", direction: "asc" }
    ]),
    ["-21:emptyLast;naturalSort", "23:orderByChoice", 22]
  );
});

test("sort resolver rejects unknown, duplicate and incompatible sort requests", () => {
  const widget = {
    id: 11,
    pageId: 7,
    tableRef: 2,
    tableId: "Personnes",
    type: "record",
    title: "Widget"
  };

  assert.throws(
    () => resolveWidgetSort(widget, expandedTables, [{ columnId: "Missing", direction: "asc" }]),
    /does not exist/
  );
  assert.throws(
    () =>
      resolveWidgetSort(widget, expandedTables, [
        { columnId: "Nom", direction: "asc" },
        { columnId: "Nom", direction: "desc" }
      ]),
    /duplicated/
  );
  assert.throws(
    () =>
      resolveWidgetSort(widget, expandedTables, [
        { columnId: "Score", direction: "asc", naturalSort: true }
      ]),
    /naturalSort is limited to Text/
  );
  assert.throws(
    () =>
      resolveWidgetSort(widget, expandedTables, [
        { columnId: "Nom", direction: "asc", orderByChoice: true }
      ]),
    /orderByChoice is limited/
  );
});

test("UI adapter writes only JSON encoded sortColRefs for a sort-only update", async () => {
  const observed: unknown[][][] = [];
  const client = {
    applyUserActions: async (_documentId: string, actions: unknown[][]) => {
      observed.push(actions);
      return { actionNum: 1, retValues: [] };
    }
  } as Pick<GristClient, "applyUserActions">;
  const adapter = new GristUiActionsAdapter(client);

  await adapter.updatePageWidget("doc-1", 11, {
    sortColRefs: [-21, "23:orderByChoice"]
  });

  assert.deepEqual(observed, [
    [
      [
        "UpdateRecord",
        "_grist_Views_section",
        11,
        { sortColRefs: '[-21,"23:orderByChoice"]' }
      ]
    ]
  ]);
});

test("saved sort uses expanded current metadata and is verified by re-read", async () => {
  const { service, uiCalls, listTableOptions } = authorizedHarness();

  const result = await service.updatePageWidget("doc-1", 7, 11, {
    sort: [
      { columnId: "Nom", direction: "desc", naturalSort: true },
      { columnId: "Statut", direction: "asc", orderByChoice: true }
    ]
  });

  assert.deepEqual(uiCalls, [
    {
      documentId: "doc-1",
      widgetId: 11,
      update: { sortColRefs: ["-21:naturalSort", "23:orderByChoice"] }
    }
  ]);
  assert.deepEqual(listTableOptions[0], { expandColumns: true });
  assert.deepEqual(
    (result as { widget: { sortColRefs?: unknown } }).widget.sortColRefs,
    ["-21:naturalSort", "23:orderByChoice"]
  );
});

test("null clears saved sort and unknown columns fail before write", async () => {
  const clear = authorizedHarness();
  await clear.service.updatePageWidget("doc-1", 7, 11, { sort: null });
  assert.deepEqual(clear.uiCalls, [
    { documentId: "doc-1", widgetId: 11, update: { sortColRefs: [] } }
  ]);

  const invalid = authorizedHarness();
  await assert.rejects(
    () =>
      invalid.service.updatePageWidget("doc-1", 7, 11, {
        sort: [{ columnId: "Missing", direction: "asc" }]
      }),
    /does not exist/
  );
  assert.deepEqual(invalid.uiCalls, []);
});

test("GPT Actions publishes bounded stable-column sort schema", () => {
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
  const sort = properties.sort as Record<string, unknown>;
  const variants = sort.anyOf as Array<Record<string, unknown>>;
  const arrayVariant = variants[0];
  const items = arrayVariant.items as Record<string, unknown>;
  const itemProperties = items.properties as Record<string, unknown>;
  const direction = itemProperties.direction as Record<string, unknown>;

  assert.equal(arrayVariant.maxItems, MAX_WIDGET_SORT_COLUMNS);
  assert.deepEqual(direction.enum, ["asc", "desc"]);
  assert.deepEqual(items.required, ["columnId", "direction"]);
});
