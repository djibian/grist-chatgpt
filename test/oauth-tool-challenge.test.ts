import assert from "node:assert/strict";
import test from "node:test";

import type { McpHttpHandler } from "@modelcontextprotocol/server";

import { createPrincipal } from "../src/auth/principal.js";
import { installOAuthToolAuthChallenges } from "../src/mcp/oauthToolChallenge.js";

const METADATA_URL =
  "https://grist-chatgpt.loeildumaitre.fr/.well-known/oauth-protected-resource";

function fakeHandler(body: unknown): McpHttpHandler {
  return {
    fetch: async () =>
      Response.json(body, {
        status: 200,
        headers: { "content-length": "999", "x-preserved": "yes" }
      }),
    close: async () => {},
    notify: {} as McpHttpHandler["notify"],
    bus: {} as McpHttpHandler["bus"]
  };
}

function toolCall(name: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: {
        documentId: "doc-1",
        tableId: "Table1",
        records: []
      }
    }
  };
}

test("adds mcp/www_authenticate when the OAuth principal lacks the tool capability", async () => {
  const principal = createPrincipal({
    id: "oauth:test",
    transport: "mcp",
    documentIds: ["doc-1"],
    capabilities: ["doc:read"]
  });
  const handler = installOAuthToolAuthChallenges(
    fakeHandler({
      jsonrpc: "2.0",
      id: 1,
      result: {
        isError: true,
        content: [{ type: "text", text: "write denied" }],
        _meta: { existing: "keep-me" }
      }
    }),
    { principal, resourceMetadataUrl: METADATA_URL }
  );

  const response = await handler.fetch(new Request("https://example.test/mcp"), {
    parsedBody: toolCall("create_records")
  });
  const body = (await response.json()) as {
    result: { _meta: Record<string, unknown> };
  };

  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("x-preserved"), "yes");
  assert.equal(body.result._meta.existing, "keep-me");
  assert.deepEqual(body.result._meta["mcp/www_authenticate"], [
    `Bearer resource_metadata="${METADATA_URL}", error="insufficient_scope", error_description="Additional authorization is required for scope doc:write.", scope="doc:write"`
  ]);
});

test("does not request OAuth step-up when the principal already has the capability", async () => {
  const principal = createPrincipal({
    id: "oauth:test",
    transport: "mcp",
    documentIds: ["doc-1"],
    capabilities: ["doc:read", "doc:write"]
  });
  const originalBody = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      isError: true,
      content: [{ type: "text", text: "document denied" }]
    }
  };
  const handler = installOAuthToolAuthChallenges(fakeHandler(originalBody), {
    principal,
    resourceMetadataUrl: METADATA_URL
  });

  const response = await handler.fetch(new Request("https://example.test/mcp"), {
    parsedBody: toolCall("create_records")
  });
  assert.deepEqual(await response.json(), originalBody);
});

test("does not attach a challenge to a successful response even if a capability is absent", async () => {
  const principal = createPrincipal({
    id: "oauth:test",
    transport: "mcp",
    documentIds: ["doc-1"],
    capabilities: ["doc:read"]
  });
  const originalBody = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: "success" }]
    }
  };
  const handler = installOAuthToolAuthChallenges(fakeHandler(originalBody), {
    principal,
    resourceMetadataUrl: METADATA_URL
  });

  const response = await handler.fetch(new Request("https://example.test/mcp"), {
    parsedBody: toolCall("create_records")
  });
  assert.deepEqual(await response.json(), originalBody);
});
