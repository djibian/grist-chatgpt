import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLogtoDiscovery } from "../src/compat/logtoMcp.js";

const ISSUER = "https://auth.example.test/oidc";

function validMetadata(): Record<string, unknown> {
  return {
    issuer: ISSUER,
    authorization_endpoint: "https://auth.example.test/oidc/auth",
    token_endpoint: "https://auth.example.test/oidc/token",
    jwks_uri: "https://auth.example.test/oidc/jwks",
    code_challenge_methods_supported: ["S256"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["openid", "offline_access"]
  };
}

test("accepts the mandatory discovery properties needed before a live MCP flow", () => {
  const report = evaluateLogtoDiscovery(ISSUER, validMetadata());
  assert.equal(report.checks.some((check) => check.status === "FAIL"), false);
  assert.equal(
    report.checks.find((check) => check.id === "pkce_s256")?.status,
    "PASS"
  );
  assert.deepEqual(report.advertisedScopes, ["openid", "offline_access"]);
});

test("fails closed when issuer, HTTPS endpoints, or S256 metadata are wrong", () => {
  const metadata = validMetadata();
  metadata.issuer = "https://other.example.test/oidc";
  metadata.token_endpoint = "http://auth.example.test/oidc/token";
  metadata.code_challenge_methods_supported = ["plain"];

  const report = evaluateLogtoDiscovery(ISSUER, metadata);
  const failures = new Set(
    report.checks
      .filter((check) => check.status === "FAIL")
      .map((check) => check.id)
  );

  assert.equal(failures.has("issuer"), true);
  assert.equal(failures.has("token_endpoint"), true);
  assert.equal(failures.has("pkce_s256"), true);
});

test("keeps an omitted grant_types_supported value unknown rather than inventing evidence", () => {
  const metadata = validMetadata();
  delete metadata.grant_types_supported;

  const report = evaluateLogtoDiscovery(ISSUER, metadata);
  assert.equal(
    report.checks.find((check) => check.id === "authorization_code_grant")?.status,
    "UNKNOWN"
  );
});
