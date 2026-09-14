import assert from "node:assert/strict";
import test from "node:test";

import type { McpServer } from "@modelcontextprotocol/server";

import type { GristService } from "../src/grist/service.js";
import { registerSchemaTools } from "../src/mcp/schemaTools.js";

test("MCP schema surface exposes the expected bounded tools and destructive hints", () => {
  const registrations: Array<{
    name: string;
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      openWorldHint?: boolean;
    };
  }> = [];

  const server = {
    registerTool: (name: string, options: any) => {
      registrations.push({ name, annotations: options.annotations });
    }
  } as unknown as McpServer;

  registerSchemaTools(server, {} as GristService, 100);

  assert.deepEqual(
    registrations.map((entry) => entry.name),
    [
      "list_columns",
      "create_tables",
      "update_tables",
      "delete_table",
      "create_columns",
      "update_columns",
      "rename_column",
      "delete_columns"
    ]
  );

  const byName = new Map(registrations.map((entry) => [entry.name, entry]));
  assert.equal(byName.get("list_columns")?.annotations?.readOnlyHint, true);
  assert.equal(byName.get("delete_table")?.annotations?.destructiveHint, true);
  assert.equal(byName.get("delete_columns")?.annotations?.destructiveHint, true);
  assert.equal(byName.get("create_tables")?.annotations?.destructiveHint, false);
  assert.ok(registrations.every((entry) => entry.annotations?.openWorldHint === false));
});
