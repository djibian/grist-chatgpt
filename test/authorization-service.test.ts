import assert from "node:assert/strict";
import test from "node:test";

import { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AccessPolicy } from "../src/grist/accessPolicy.js";
import type {
  GristClient,
  GristOrgSummary,
  GristWorkspaceSummary
} from "../src/grist/client.js";

function fakeClient(): GristClient {
  const orgs: GristOrgSummary[] = [
    { id: 1, name: "Org", domain: "org", internalSecret: "secret-org" }
  ];
  const workspaces: GristWorkspaceSummary[] = [
    {
      id: 10,
      name: "Workspace A",
      access: "editors",
      internalSecret: "secret-workspace-a",
      docs: [
        {
          id: 100,
          urlId: "doc-a",
          name: "A",
          access: "owners",
          internalSecret: "secret-document-a"
        }
      ]
    },
    {
      id: 20,
      name: "Workspace B",
      access: "viewers",
      internalSecret: "secret-workspace-b",
      docs: [
        {
          id: 200,
          urlId: "doc-b",
          name: "B",
          access: "editors",
          internalSecret: "secret-document-b"
        }
      ]
    }
  ];
  return {
    listOrgs: async () => orgs,
    listWorkspaces: async () => workspaces,
    normalizeDocumentId: (value: string) => value
  } as unknown as GristClient;
}

test("combines deployment scope with per-principal resource capabilities", async () => {
  const deployment = new AccessPolicy(fakeClient(), {
    allowedDocumentIds: ["doc-b"],
    allowedWorkspaceIds: ["10"],
    cacheTtlMs: 0
  });
  const authorization = new AuthorizationService(deployment);
  const principal: Principal = {
    id: "agent",
    transport: "mcp",
    grants: [
      {
        documentIds: [],
        workspaceIds: ["10"],
        capabilities: ["doc:read", "doc:write"]
      },
      {
        documentIds: ["doc-b"],
        workspaceIds: [],
        capabilities: ["doc:read"]
      }
    ]
  };

  const readable = await authorization.listDocuments(principal, "doc:read");
  assert.deepEqual(
    readable.map(({ document }) => document.urlId),
    ["doc-a", "doc-b"]
  );
  assert.deepEqual(readable[0], {
    org: { id: 1, name: "Org", domain: "org" },
    workspace: { id: 10, name: "Workspace A", access: "editors" },
    document: { id: 100, urlId: "doc-a", name: "A", access: "owners" }
  });
  assert.doesNotMatch(JSON.stringify(readable), /secret-/);

  const writable = await authorization.listDocuments(principal, "doc:write");
  assert.deepEqual(
    writable.map(({ document }) => document.urlId),
    ["doc-a"]
  );

  assert.equal(
    await authorization.assertDocumentAllowed(principal, "doc-a", "doc:write"),
    "doc-a"
  );
  await assert.rejects(
    () => authorization.assertDocumentAllowed(principal, "doc-b", "doc:write"),
    /not allowed by this bridge/
  );
  await assert.rejects(
    () => authorization.assertDocumentAllowed(principal, "doc-a", "doc.schema:write"),
    /not allowed by this bridge/
  );
});
