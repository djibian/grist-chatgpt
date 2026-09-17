import assert from "node:assert/strict";
import test from "node:test";

import {
  createPrincipalFromVerifiedAccessToken,
  OAuthAccessTokenError,
  validateVerifiedAccessTokenClaims
} from "../src/auth/oauthAccessToken.js";

const POLICY = {
  issuer: "https://auth.example.test/oidc",
  audience: "https://grist-chatgpt.loeildumaitre.fr/mcp"
} as const;

const VALID = {
  issuer: POLICY.issuer,
  subject: "logto-user-123",
  audience: POLICY.audience,
  expiresAt: 2_000,
  scope: "openid doc:read doc:write"
} as const;

function rejectsWith(
  code: OAuthAccessTokenError["code"],
  fn: () => unknown
): void {
  assert.throws(
    fn,
    (error: unknown) => error instanceof OAuthAccessTokenError && error.code === code
  );
}

test("accepts the configured MCP resource in string or array audience claims", () => {
  assert.equal(
    validateVerifiedAccessTokenClaims(VALID, POLICY, 1_000).subject,
    "logto-user-123"
  );

  assert.equal(
    validateVerifiedAccessTokenClaims(
      { ...VALID, audience: ["other", POLICY.audience] },
      POLICY,
      1_000
    ).subject,
    "logto-user-123"
  );
});

test("rejects a correctly shaped token intended for another resource", () => {
  rejectsWith("wrong_audience", () =>
    validateVerifiedAccessTokenClaims(
      { ...VALID, audience: "https://other.example.test/api" },
      POLICY,
      1_000
    )
  );
});

test("rejects a token from another issuer", () => {
  rejectsWith("wrong_issuer", () =>
    validateVerifiedAccessTokenClaims(
      { ...VALID, issuer: "https://other.example.test/oidc" },
      POLICY,
      1_000
    )
  );
});

test("rejects expired or invalid expiry claims", () => {
  rejectsWith("expired_token", () =>
    validateVerifiedAccessTokenClaims({ ...VALID, expiresAt: 1_000 }, POLICY, 1_000)
  );
  rejectsWith("invalid_expiry", () =>
    validateVerifiedAccessTokenClaims(
      { ...VALID, expiresAt: Number.NaN },
      POLICY,
      1_000
    )
  );
});

test("creates a scoped dynamic principal only after resource-server claims pass", () => {
  const principal = createPrincipalFromVerifiedAccessToken(
    VALID,
    POLICY,
    { documentIds: ["doc-a"], workspaceIds: [] },
    1_000
  );

  assert.match(principal.id, /^oauth:/);
  assert.deepEqual(principal.grants[0]?.capabilities, ["doc:read", "doc:write"]);
});
