import assert from "node:assert/strict";
import test from "node:test";

import type { McpServer } from "@modelcontextprotocol/server";

import { registerCoreTools } from "../src/mcp/coreTools.js";
import { registerDiscoveryTools } from "../src/mcp/discoveryTools.js";
import { registerSchemaTools } from "../src/mcp/schemaTools.js";
import { registerUiTools } from "../src/mcp/uiTools.js";
import {
  getMcpToolMetadata,
  OPERATION_REGISTRY
} from "../src/operations/registry.js";

interface Registration {
  name: string;
  options: {
    title?: string;
    description?: string;
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      openWorldHint?: boolean;
    };
    outputSchema?: unknown;
  };
  callback: (...args: any[]) => any;
}

function captureSurface(): Registration[] {
  const registrations: Registration[] = [];
  const server = {
    registerTool: (name: string, options: Registration["options"], callback: Registration["callback"]) => {
      registrations.push({ name, options, callback });
      return {};
    }
  } as unknown as McpServer;

  const grist = {} as any;
  registerCoreTools(server, grist, { maxReadRecords: 200, maxWriteRecords: 50 });
  registerSchemaTools(server, grist, 100);
  registerDiscoveryTools(server, grist);
  registerUiTools(server, grist);
  return registrations;
}

test("complete MCP surface is derived from the operation registry without annotation drift", () => {
  const registrations = captureSurface();
  const registeredNames = registrations.map((entry) => entry.name);
  const registryNames = OPERATION_REGISTRY.map((operation) => operation.name);

  assert.equal(new Set(registeredNames).size, registeredNames.length);
  assert.deepEqual([...registeredNames].sort(), [...registryNames].sort());

  const byName = new Map(registrations.map((entry) => [entry.name, entry]));
  for (const operation of OPERATION_REGISTRY) {
    const registration = byName.get(operation.name);
    assert.ok(registration, `missing MCP registration for ${operation.name}`);
    const metadata = getMcpToolMetadata(operation.name);
    assert.equal(registration.options.title, metadata.title);
    assert.equal(registration.options.description, metadata.description);
    assert.deepEqual(registration.options.annotations, metadata.annotations);
    assert.ok(metadata.title.trim().length > 0);
    assert.ok(metadata.description.trim().length > 0);
    assert.doesNotMatch(
      metadata.description,
      /\b(?:AddView|CreateViewSection|UserAction|RenameColumn|RemoveTable|UpdateRecord)\b/,
      `${operation.name} leaks an internal Grist action name`
    );
  }

  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => operation.readOnly)
      .map((operation) => operation.name)
      .sort(),
    [
      "get_page_widgets",
      "get_pages",
      "grist_help",
      "inspect_document",
      "list_columns",
      "list_documents",
      "list_tables",
      "query_records"
    ]
  );
  assert.deepEqual(
    OPERATION_REGISTRY.filter((operation) => operation.destructive)
      .map((operation) => operation.name)
      .sort(),
    [
      "delete_columns",
      "delete_records",
      "delete_table",
      "rename_column",
      "rename_page",
      "update_columns",
      "update_page_widget",
      "update_records",
      "update_tables"
    ]
  );
  assert.ok(OPERATION_REGISTRY.every((operation) => operation.openWorld === false));
  assert.ok(
    registrations.every(
      (entry) => entry.options.annotations?.openWorldHint === false
    )
  );
});

test("structured output schemas are limited to stable normalized UI contracts", () => {
  const structured = captureSurface()
    .filter((entry) => entry.options.outputSchema !== undefined)
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(structured, [
    "add_page_widget",
    "create_page",
    "get_page_widgets",
    "get_pages",
    "rename_page",
    "update_page_widget"
  ]);
});

test("stable page discovery returns reusable IDs in structuredContent", async () => {
  const registrations: Registration[] = [];
  const server = {
    registerTool: (name: string, options: Registration["options"], callback: Registration["callback"]) => {
      registrations.push({ name, options, callback });
      return {};
    }
  } as unknown as McpServer;

  registerDiscoveryTools(server, {
    inspectDocument: async () => ({}),
    getPages: async () => ({
      documentId: "doc-1",
      summary: { pageCount: 1, widgetCount: 2 },
      pages: [
        {
          id: 7,
          pageRecordId: 70,
          name: "Dashboard",
          type: "raw_data",
          indentation: 0,
          widgetCount: 2,
          widgetIds: [11, 12]
        }
      ]
    }),
    getPageWidgets: async () => ({})
  });

  const getPages = registrations.find((entry) => entry.name === "get_pages");
  assert.ok(getPages);
  const result = await getPages.callback({ documentId: "doc-1" });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent.pages[0].widgetIds, [11, 12]);
  assert.equal(result.structuredContent.pages[0].id, 7);
  assert.deepEqual(
    JSON.parse(result.content[0].text),
    result.structuredContent
  );
});
