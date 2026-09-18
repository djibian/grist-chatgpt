import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign as signData,
  type JsonWebKey,
  type KeyObject
} from "node:crypto";
import test from "node:test";

import {
  JwksAccessTokenVerifierError,
  JwksOAuthAccessTokenVerifier,
  type OAuthJwksFetcher
} from "../src/auth/jwksAccessTokenVerifier.js";

const ISSUER = "https://auth.example.test/oidc";
const AUDIENCE = "https://grist-chatgpt.loeildumaitre.fr/mcp";
const JWKS_URI = "https://auth.example.test/oidc/jwks";

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function rsaFixture(): {
  privateKey: KeyObject;
  jwk: JsonWebKey & { kid: string; use: string; alg: string };
} {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  return {
    privateKey,
    jwk: {
      ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
      kid: "poc-key",
      use: "sig",
      alg: "RS256"
    }
  };
}

function jwt(
  privateKey: KeyObject,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "RS256", kid: "poc-key", typ: "JWT" }
): string {
  const encodedHeader = base64Json(header);
  const encodedPayload = base64Json(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signData("sha256", Buffer.from(signingInput, "ascii"), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

function jwksFetcher(jwk: JsonWebKey): OAuthJwksFetcher {
  return async () =>
    new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
}

function validPayload(): Record<string, unknown> {
  return {
    iss: ISSUER,
    sub: "user-123",
    aud: AUDIENCE,
    exp: 2_000_000_000,
    scope: "doc:read doc:write doc.schema:write"
  };
}

test("verifies an RS256 JWT against remote JWKS and returns bounded claims", async () => {
  const fixture = rsaFixture();
  const verifier = new JwksOAuthAccessTokenVerifier({
    jwksUri: JWKS_URI,
    fetcher: jwksFetcher(fixture.jwk)
  });

  const claims = await verifier.verify(jwt(fixture.privateKey, validPayload()));

  assert.deepEqual(claims, {
    issuer: ISSUER,
    subject: "user-123",
    audience: AUDIENCE,
    expiresAt: 2_000_000_000,
    scope: "doc:read doc:write doc.schema:write"
  });
});

test("rejects a payload changed after signing", async () => {
  const fixture = rsaFixture();
  const verifier = new JwksOAuthAccessTokenVerifier({
    jwksUri: JWKS_URI,
    fetcher: jwksFetcher(fixture.jwk)
  });
  const signed = jwt(fixture.privateKey, validPayload());
  const [header, _payload, signature] = signed.split(".");
  const tampered = `${header}.${base64Json({ ...validPayload(), sub: "attacker" })}.${signature}`;

  await assert.rejects(
    verifier.verify(tampered),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "invalid_signature"
  );
});

test("rejects an unknown signing key identifier", async () => {
  const fixture = rsaFixture();
  const verifier = new JwksOAuthAccessTokenVerifier({
    jwksUri: JWKS_URI,
    fetcher: jwksFetcher(fixture.jwk)
  });
  const token = jwt(fixture.privateKey, validPayload(), {
    alg: "RS256",
    kid: "other-key"
  });

  await assert.rejects(
    verifier.verify(token),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "signing_key_not_found"
  );
});

test("rejects unsupported or unsigned JWT algorithms before JWKS lookup", async () => {
  let fetchCalls = 0;
  const fetcher: OAuthJwksFetcher = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ keys: [] }), { status: 200 });
  };
  const verifier = new JwksOAuthAccessTokenVerifier({
    jwksUri: JWKS_URI,
    fetcher
  });
  const token = `${base64Json({ alg: "none" })}.${base64Json(validPayload())}.unsigned`;

  await assert.rejects(
    verifier.verify(token),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "unsupported_alg"
  );
  assert.equal(fetchCalls, 0);
});

test("rejects invalid required claim shapes after successful signature verification", async () => {
  const fixture = rsaFixture();
  const verifier = new JwksOAuthAccessTokenVerifier({
    jwksUri: JWKS_URI,
    fetcher: jwksFetcher(fixture.jwk)
  });
  const token = jwt(fixture.privateKey, {
    ...validPayload(),
    exp: "not-a-number"
  });

  await assert.rejects(
    verifier.verify(token),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "invalid_claims"
  );
});

test("requires an HTTPS JWKS URI without embedded credentials or fragment", () => {
  assert.throws(
    () => new JwksOAuthAccessTokenVerifier({ jwksUri: "http://auth.example.test/jwks" }),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "invalid_jwks_uri"
  );
  assert.throws(
    () =>
      new JwksOAuthAccessTokenVerifier({
        jwksUri: "https://user:secret@auth.example.test/jwks#fragment"
      }),
    (error: unknown) =>
      error instanceof JwksAccessTokenVerifierError &&
      error.code === "invalid_jwks_uri"
  );
});
