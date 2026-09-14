import assert from "node:assert/strict";
import test from "node:test";

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
      name: "Allowed workspace",
      docs: [
        { id: 100, urlId: "doc-workspace", name: "Workspace document" },
        { id: 101, urlId: "other-in-workspace", name: "Other document" }
      ]
    },
    {
      id: 20,
      name: "Other workspace",
      docs: [
        { id: 200, urlId: "doc-explicit", name: "Explicit document" },
        { id: 201, urlId: "doc-denied", name: "Denied document" }
      ]
    }
  ];

  return {
    listOrgs: async () => orgs,
    listWorkspaces: async () => workspaces,
    normalizeDocumentId: (value: string) => value
  } as unknown as GristClient;
}

test("allows every document in an allowed workspace plus explicit documents", async () => {
  const policy = new AccessPolicy(fakeClient(), {
    allowedDocumentIds: ["doc-explicit"],
    allowedWorkspaceIds: ["10"],
    cacheTtlMs: 0
  });

  const allowed = await policy.listAllowedDocuments();
  assert.deepEqual(
    allowed.map(({ document }) => document.urlId),
    ["doc-workspace", "other-in-workspace", "doc-explicit"]
  );

  assert.equal(await policy.assertDocumentAllowed("doc-workspace"), "doc-workspace");
  assert.equal(await policy.assertDocumentAllowed("doc-explicit"), "doc-explicit");
  await assert.rejects(
    () => policy.assertDocumentAllowed("doc-denied"),
    /not allowed by this bridge/
  );
});

test("explicit document ID is accepted without discovery", async () => {
  let discoveryCalls = 0;
  const client = {
    listOrgs: async () => {
      discoveryCalls += 1;
      return [];
    },
    listWorkspaces: async () => [],
    normalizeDocumentId: (value: string) => value
  } as unknown as GristClient;

  const policy = new AccessPolicy(client, {
    allowedDocumentIds: ["direct-doc"],
    allowedWorkspaceIds: []
  });

  assert.equal(await policy.assertDocumentAllowed("direct-doc"), "direct-doc");
  assert.equal(discoveryCalls, 0);
});
