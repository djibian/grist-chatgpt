import assert from "node:assert/strict";
import test from "node:test";

import { createPrincipal } from "../src/auth/principal.js";
import {
  GristClientFactory,
  StaticApiKeyCredentialProvider,
  type GristCredentialContext,
  type GristCredentialProvider
} from "../src/grist/credentials.js";

const principal = createPrincipal({
  id: "test-principal",
  transport: "mcp",
  documentIds: ["doc-1"],
  workspaceIds: [],
  capabilities: ["doc:read"]
});

test("StaticApiKeyCredentialProvider preserves the configured key through GristClientFactory", async () => {
  const originalFetch = globalThis.fetch;
  let observedAuthorization: string | null = null;

  globalThis.fetch = async (_input, init) => {
    observedAuthorization = new Headers(init?.headers).get("Authorization");
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const factory = new GristClientFactory(
      "https://grist.example.org",
      new StaticApiKeyCredentialProvider("static-test-key")
    );
    const client = await factory.createClient({ principal });

    await client.listOrgs();

    assert.equal(observedAuthorization, "Bearer static-test-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GristClientFactory forwards the current principal to the credential provider", async () => {
  let observedPrincipalId: string | undefined;
  const provider: GristCredentialProvider = {
    async getApiKey(context: GristCredentialContext) {
      observedPrincipalId = context.principal.id;
      return "principal-specific-test-key";
    }
  };
  const factory = new GristClientFactory("https://grist.example.org", provider);

  await factory.createClient({ principal });

  assert.equal(observedPrincipalId, "test-principal");
});

test("credential providers cannot produce an empty API key", async () => {
  assert.throws(
    () => new StaticApiKeyCredentialProvider("   "),
    /must not be empty/
  );

  const provider: GristCredentialProvider = {
    async getApiKey() {
      return "";
    }
  };
  const factory = new GristClientFactory("https://grist.example.org", provider);

  await assert.rejects(
    factory.createClient({ principal }),
    /returned an empty API key/
  );
});
