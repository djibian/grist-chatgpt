import assert from "node:assert/strict";
import test from "node:test";

import {
  createOAuthMcpRequestContext,
  OAuthRequestAuthenticationError,
  type OAuthAccessTokenVerifier
} from "../src/auth/oauthRequestContext.js";
import type { Principal } from "../src/auth/principal.js";

const POLICY = {
  issuer: "https://auth.example.test/oidc",
  audience: "https://grist-chatgpt.loeildumaitre.fr/mcp"
} as const;

function validVerifier(observedTokens: string[]): OAuthAccessTokenVerifier {
  return {
    async verify(accessToken) {
      observedTokens.push(accessToken);
      return {
        issuer: POLICY.issuer,
        subject: "logto-user-123",
        audience: POLICY.audience,
        expiresAt: 2_000,
        scope: "doc:read"
      };
    }
  };
}

test("passes the raw bearer only to the verifier and a bounded principal to the context factory", async () => {
  const rawToken = "header.payload.signature";
  const observedTokens: string[] = [];
  const observedPrincipals: Principal[] = [];

  const result = await createOAuthMcpRequestContext({
    authorizationHeader: `Bearer ${rawToken}`,
    verifier: validVerifier(observedTokens),
    policy: POLICY,
    grant: { documentIds: ["doc-a"], workspaceIds: [] },
    contextFactory: {
      async create(principal) {
        observedPrincipals.push(principal);
        return { marker: "context-created" };
      }
    },
    nowSeconds: 1_000
  });

  assert.deepEqual(observedTokens, [rawToken]);
  assert.equal(observedPrincipals.length, 1);
  assert.equal(observedPrincipals[0], result.principal);
  assert.equal(JSON.stringify(result.principal).includes(rawToken), false);
  assert.deepEqual(result.principal.grants[0]?.capabilities, ["doc:read"]);
  assert.deepEqual(result.context, { marker: "context-created" });
});

test("rejects missing or malformed bearer headers before verification", async () => {
  let verifierCalls = 0;
  const verifier: OAuthAccessTokenVerifier = {
    async verify() {
      verifierCalls += 1;
      throw new Error("should not run");
    }
  };

  const base = {
    verifier,
    policy: POLICY,
    grant: { documentIds: ["doc-a"], workspaceIds: [] },
    contextFactory: { async create(_principal: Principal) { return {}; } },
    nowSeconds: 1_000
  };

  await assert.rejects(
    createOAuthMcpRequestContext({ ...base, authorizationHeader: undefined }),
    (error: unknown) =>
      error instanceof OAuthRequestAuthenticationError &&
      error.code === "missing_bearer"
  );
  await assert.rejects(
    createOAuthMcpRequestContext({ ...base, authorizationHeader: "Basic abc" }),
    (error: unknown) =>
      error instanceof OAuthRequestAuthenticationError &&
      error.code === "malformed_bearer"
  );
  await assert.rejects(
    createOAuthMcpRequestContext({ ...base, authorizationHeader: "Bearer a b" }),
    (error: unknown) =>
      error instanceof OAuthRequestAuthenticationError &&
      error.code === "malformed_bearer"
  );

  assert.equal(verifierCalls, 0);
});

test("does not create a Grist context when token verification fails", async () => {
  let contextCalls = 0;
  const verifierError = new Error("signature verification failed");

  await assert.rejects(
    createOAuthMcpRequestContext({
      authorizationHeader: "Bearer opaque-token",
      verifier: {
        async verify() {
          throw verifierError;
        }
      },
      policy: POLICY,
      grant: { documentIds: ["doc-a"], workspaceIds: [] },
      contextFactory: {
        async create(_principal: Principal) {
          contextCalls += 1;
          return {};
        }
      },
      nowSeconds: 1_000
    }),
    verifierError
  );

  assert.equal(contextCalls, 0);
});
