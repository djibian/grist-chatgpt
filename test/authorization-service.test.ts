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
  const orgs: GristOrgSummary[] = [{ id: 1, name: "Org" }];
  const workspaces: GristWorkspaceSummary[] = [
    {
      id: 10,
      name: "Workspace A",
      docs: [{ id: 100, urlId: "doc-a", name: "A" }]
    },
    {
      id: 20,
      name: "Workspace B",
      docs: [{ id: 200, urlId: "doc-b", name: "B" }]
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
