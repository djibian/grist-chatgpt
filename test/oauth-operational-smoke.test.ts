import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { runOAuthOperationalSmoke } from "../tools/oauth-operational-smoke.js";

const resourceUri = "https://bridge.example.org/mcp";
const metadataUrl = "https://bridge.example.org/.well-known/oauth-protected-resource";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) }
  });
}

test("operational smoke validates only non-secret public OAuth surfaces", async () => {
  const seen: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    seen.push(url);
    if (url === "https://bridge.example.org/healthz") {
      return response({ status: "ok", service: "grist-chatgpt", version: "0.5.0" });
    }
    if (url === metadataUrl) {
      return response({
        resource: resourceUri,
        authorization_servers: ["https://auth.example.org/oidc"],
        scopes_supported: ["doc:read", "doc:write", "doc.schema:write"]
      });
    }
    if (url === resourceUri) {
      return response({ error: "Unauthorized" }, {
        status: 401,
        headers: {
          "www-authenticate": `Bearer resource_metadata="${metadataUrl}"`
        }
      });
    }
    throw new Error("unexpected URL");
  };

  const checks = await runOAuthOperationalSmoke(resourceUri, fetchImpl);
  assert.ok(checks.every(check => check.passed), JSON.stringify(checks));
  assert.deepEqual(seen.sort(), [
    "https://bridge.example.org/healthz",
    metadataUrl,
    resourceUri
  ].sort());
});

test("operational smoke reports bounded failures without echoing remote data", async () => {
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.endsWith("/healthz")) return new Response("not-json", { status: 503 });
    if (url.includes("oauth-protected-resource")) {
      return response({
        resource: "https://wrong.example.org/mcp",
        authorization_servers: ["http://unsafe.example.org"],
        scopes_supported: ["doc:read", "unexpected-secret-sentinel"]
      });
    }
    return response({ error: "secret-sentinel" }, {
      status: 401,
      headers: { "www-authenticate": "Bearer" }
    });
  };

  const checks = await runOAuthOperationalSmoke(resourceUri, fetchImpl);
  assert.ok(checks.some(check => !check.passed));
  assert.doesNotMatch(JSON.stringify(checks), /secret|wrong\.example|unsafe\.example/i);
});

test("CLI rejects an invalid resource URI without echoing supplied input", () => {
  const secret = "https://secret-sentinel.example.org/not-mcp?token=secret-sentinel";
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "tools/oauth-operational-smoke.ts"],
    {
      env: { PATH: process.env.PATH, MCP_RESOURCE_URI: secret },
      encoding: "utf8"
    }
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "configuration_valid: FAIL\n");
  assert.doesNotMatch(run.stdout + run.stderr, /secret-sentinel/);
});
