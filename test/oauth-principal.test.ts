import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilitiesFromOAuthScope,
  createOAuthMcpPrincipal,
  oauthPrincipalId,
  OAuthPrincipalError
} from "../src/auth/oauthPrincipal.js";

test("maps only known OAuth scopes into existing Grist capabilities", () => {
  assert.deepEqual(
    capabilitiesFromOAuthScope(
      "openid doc:read unknown:scope doc:write doc.schema:write"
    ),
    ["doc:read", "doc:write", "doc.schema:write"]
  );
  assert.deepEqual(capabilitiesFromOAuthScope("openid email"), []);
  assert.deepEqual(capabilitiesFromOAuthScope(undefined), []);
});

test("rejects malformed scope serialization", () => {
  assert.throws(
    () => capabilitiesFromOAuthScope("doc:read  doc:write"),
    (error: unknown) =>
      error instanceof OAuthPrincipalError && error.code === "invalid_scope"
  );
});

test("derives a stable opaque principal id from validated issuer and subject", () => {
  const id1 = oauthPrincipalId("https://auth.example.test", "proconnect-user-123");
  const id2 = oauthPrincipalId("https://auth.example.test", "proconnect-user-123");
  const otherIssuer = oauthPrincipalId(
    "https://other-auth.example.test",
    "proconnect-user-123"
  );
  const otherSubject = oauthPrincipalId(
    "https://auth.example.test",
    "proconnect-user-456"
  );

  assert.equal(id1, id2);
  assert.match(id1, /^oauth:[A-Za-z0-9_-]{43}$/);
  assert.notEqual(id1, otherIssuer);
  assert.notEqual(id1, otherSubject);
  assert.equal(id1.includes("proconnect-user-123"), false);
});

test("creates an MCP principal whose authority is reduced by OAuth scopes", () => {
  const principal = createOAuthMcpPrincipal(
    {
      issuer: "https://auth.example.test",
      subject: "user-123",
      scope: "openid doc:read doc:write"
    },
    {
      documentIds: ["doc-a"],
      workspaceIds: ["42"]
    }
  );

  assert.equal(principal.transport, "mcp");
  assert.match(principal.id, /^oauth:/);
  assert.deepEqual(principal.grants, [
    {
      documentIds: ["doc-a"],
      workspaceIds: ["42"],
      capabilities: ["doc:read", "doc:write"]
    }
  ]);
});

test("rejects empty validated issuer or subject", () => {
  assert.throws(
    () => oauthPrincipalId("", "user"),
    (error: unknown) =>
      error instanceof OAuthPrincipalError && error.code === "invalid_issuer"
  );
  assert.throws(
    () => oauthPrincipalId("https://auth.example.test", " "),
    (error: unknown) =>
      error instanceof OAuthPrincipalError && error.code === "invalid_subject"
  );
});
