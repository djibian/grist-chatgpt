import assert from "node:assert/strict";
import test from "node:test";

import { AuditLogger } from "../src/audit/auditLogger.js";
import { createPrincipal } from "../src/auth/principal.js";
import { DeploymentResourcePolicy } from "../src/grist/accessPolicy.js";
import {
  GristClientFactory,
  type GristCredentialContext,
  type GristCredentialProvider
} from "../src/grist/credentials.js";
import { GristContextFactory } from "../src/grist/contextFactory.js";

interface ListedDocuments {
  documents: Array<{
    document: { id: string | number; urlId?: string | null };
  }>;
}

function principal(id: string) {
  return createPrincipal({
    id,
    transport: "mcp",
    documentIds: [],
    workspaceIds: ["10"],
    capabilities: ["doc:read"]
  });
}

test("user-aware Grist contexts isolate credential-derived discovery and caches", async () => {
  const credentials = new Map([
    ["user-a", "key-a"],
    ["user-b", "key-b"]
  ]);
  const observedPrincipalIds: string[] = [];
  const provider: GristCredentialProvider = {
    async getApiKey(context: GristCredentialContext) {
      observedPrincipalIds.push(context.principal.id);
      const apiKey = credentials.get(context.principal.id);
      if (!apiKey) throw new Error("missing test credential");
      return apiKey;
    }
  };

  const fetchCounts = new Map<string, number>();
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  globalThis.fetch = async (input, init) => {
    const authorization = new Headers(init?.headers).get("Authorization");
    assert.ok(authorization);
    fetchCounts.set(authorization, (fetchCounts.get(authorization) ?? 0) + 1);

    const url = String(input);
    if (url.endsWith("/api/orgs")) {
      return new Response(JSON.stringify([{ id: 1, name: "Org" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.endsWith("/api/orgs/1/workspaces")) {
      const isA = authorization === "Bearer key-a";
      return new Response(
        JSON.stringify([
          {
            id: 10,
            name: "Deployment workspace",
            docs: [
              isA
                ? { id: 101, urlId: "doc-a", name: "A only" }
                : { id: 202, urlId: "doc-b", name: "B only" }
            ]
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("not found", { status: 404 });
  };
  console.log = () => undefined;

  try {
    const clientFactory = new GristClientFactory(
      "https://grist.example.org",
      provider
    );
    const deploymentPolicy = new DeploymentResourcePolicy({
      allowedDocumentIds: [],
      allowedWorkspaceIds: ["10"]
    });
    const contextFactory = new GristContextFactory(
      clientFactory,
      deploymentPolicy,
      new AuditLogger(),
      {
        maxReadRecords: 200,
        maxWriteRecords: 50,
        writeBatchRecords: 25,
        maxSchemaItems: 50,
        discoveryCacheTtlMs: 60_000
      }
    );

    const contextA = await contextFactory.create(principal("user-a"));
    const contextB = await contextFactory.create(principal("user-b"));

    const firstA = (await contextA.listDocuments()) as ListedDocuments;
    const firstB = (await contextB.listDocuments()) as ListedDocuments;
    const secondA = (await contextA.listDocuments()) as ListedDocuments;
    const secondB = (await contextB.listDocuments()) as ListedDocuments;

    assert.deepEqual(
      firstA.documents.map(({ document }) => document.urlId),
      ["doc-a"]
    );
    assert.deepEqual(
      firstB.documents.map(({ document }) => document.urlId),
      ["doc-b"]
    );
    assert.deepEqual(secondA, firstA);
    assert.deepEqual(secondB, firstB);

    assert.deepEqual(observedPrincipalIds, ["user-a", "user-b"]);
    assert.equal(fetchCounts.get("Bearer key-a"), 2);
    assert.equal(fetchCounts.get("Bearer key-b"), 2);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
  }
});
