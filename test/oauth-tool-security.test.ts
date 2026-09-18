import assert from "node:assert/strict";
import test from "node:test";

import type { McpHttpHandler } from "@modelcontextprotocol/server";

import {
  addRootOAuthSecuritySchemesToToolList,
  installOAuthToolSecuritySchemes,
  oauthSecuritySchemesForTool
} from "../src/mcp/oauthToolSecurity.js";

function fakeHandler(response: Response): McpHttpHandler {
  return {
    fetch: async () => response,
    close: async () => {},
    notify: {} as McpHttpHandler["notify"],
    bus: {} as McpHttpHandler["bus"]
  };
}

test("derives OAuth scopes from the normative operation registry", () => {
  assert.deepEqual(oauthSecuritySchemesForTool("list_documents"), [
    { type: "oauth2", scopes: ["doc:read"] }
  ]);
  assert.deepEqual(oauthSecuritySchemesForTool("create_records"), [
    { type: "oauth2", scopes: ["doc:write"] }
  ]);
  assert.deepEqual(oauthSecuritySchemesForTool("create_tables"), [
    { type: "oauth2", scopes: ["doc.schema:write"] }
  ]);
  assert.deepEqual(oauthSecuritySchemesForTool("grist_help"), [
    { type: "oauth2", scopes: [] }
  ]);
  assert.equal(oauthSecuritySchemesForTool("unknown_tool"), undefined);
});

test("adds root and compatibility OAuth securitySchemes without disturbing tool metadata", () => {
  const input = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        {
          name: "list_documents",
          description: "List documents",
          annotations: { readOnlyHint: true },
          _meta: { custom: "keep-me" }
        },
        {
          name: "create_records",
          description: "Create records"
        },
        {
          name: "unknown_tool",
          description: "Leave unchanged"
        }
      ]
    }
  };

  const transformed = addRootOAuthSecuritySchemesToToolList(input);
  assert.equal(transformed.changed, true);

  const result = transformed.value as typeof input & {
    result: {
      tools: Array<Record<string, unknown>>;
    };
  };
  assert.deepEqual(result.result.tools[0]?.securitySchemes, [
    { type: "oauth2", scopes: ["doc:read"] }
  ]);
  assert.deepEqual(result.result.tools[0]?._meta, {
    custom: "keep-me",
    securitySchemes: [{ type: "oauth2", scopes: ["doc:read"] }]
  });
  assert.deepEqual(result.result.tools[0]?.annotations, { readOnlyHint: true });
  assert.deepEqual(result.result.tools[1]?.securitySchemes, [
    { type: "oauth2", scopes: ["doc:write"] }
  ]);
  assert.equal(result.result.tools[2]?.securitySchemes, undefined);
});

test("leaves non-tools/list-shaped JSON untouched", () => {
  const input = { jsonrpc: "2.0", id: 1, result: { content: [] } };
  const transformed = addRootOAuthSecuritySchemesToToolList(input);
  assert.equal(transformed.changed, false);
  assert.equal(transformed.value, input);
});

test("wire adapter transforms JSON tool lists and removes stale content-length", async () => {
  const handler = installOAuthToolSecuritySchemes(
    fakeHandler(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: [{ name: "create_tables", inputSchema: {} }] }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": "999",
            "x-preserved": "yes"
          }
        }
      )
    )
  );

  const response = await handler.fetch(new Request("https://example.test/mcp"));
  const body = (await response.json()) as {
    result: { tools: Array<Record<string, unknown>> };
  };

  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("x-preserved"), "yes");
  assert.deepEqual(body.result.tools[0]?.securitySchemes, [
    { type: "oauth2", scopes: ["doc.schema:write"] }
  ]);
  assert.deepEqual((body.result.tools[0]?._meta as Record<string, unknown>)?.securitySchemes, [
    { type: "oauth2", scopes: ["doc.schema:write"] }
  ]);
});

test("wire adapter leaves non-JSON responses byte-for-byte available", async () => {
  const original = new Response("event: message\ndata: untouched\n\n", {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
  const handler = installOAuthToolSecuritySchemes(fakeHandler(original));
  const response = await handler.fetch(new Request("https://example.test/mcp"));

  assert.equal(response, original);
  assert.equal(await response.text(), "event: message\ndata: untouched\n\n");
});
