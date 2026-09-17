import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateProConnectDiscovery,
  sanitizeTokenResponse
} from "../src/compat/proconnectMcp.js";

function status(report: ReturnType<typeof evaluateProConnectDiscovery>, id: string) {
  return report.checks.find((check) => check.id === id)?.status;
}

test("discovery evaluator distinguishes proven metadata from live-flow unknowns", () => {
  const report = evaluateProConnectDiscovery({
    issuer: "https://id.example.test",
    authorization_endpoint: "https://id.example.test/authorize",
    token_endpoint: "https://id.example.test/token",
    introspection_endpoint: "https://id.example.test/introspect",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [
      "openid",
      "offline_access",
      "doc:read",
      "doc:write",
      "doc.schema:write"
    ]
  });

  assert.equal(status(report, "issuer"), "PASS");
  assert.equal(status(report, "authorization_endpoint"), "PASS");
  assert.equal(status(report, "token_endpoint"), "PASS");
  assert.equal(status(report, "authorization_code"), "PASS");
  assert.equal(status(report, "pkce_s256"), "PASS");
  assert.equal(status(report, "rfc9207_iss"), "PASS");
  assert.equal(status(report, "introspection"), "PASS");
  assert.equal(status(report, "bridge_scopes"), "PASS");
  assert.equal(status(report, "refresh"), "PASS");

  assert.equal(status(report, "rfc8707_authorize_resource"), "UNKNOWN");
  assert.equal(status(report, "rfc8707_token_resource"), "UNKNOWN");
  assert.equal(status(report, "resource_audience_binding"), "UNKNOWN");
});

test("missing PKCE metadata remains unknown rather than inventing incompatibility", () => {
  const report = evaluateProConnectDiscovery({
    issuer: "https://id.example.test",
    authorization_endpoint: "https://id.example.test/authorize",
    token_endpoint: "https://id.example.test/token",
    response_types_supported: ["code"]
  });

  assert.equal(status(report, "pkce_s256"), "UNKNOWN");
  assert.equal(status(report, "bridge_scopes"), "UNKNOWN");
  assert.equal(status(report, "refresh"), "UNKNOWN");
});

test("advertised PKCE methods without S256 are an explicit failure", () => {
  const report = evaluateProConnectDiscovery({
    issuer: "https://id.example.test",
    authorization_endpoint: "https://id.example.test/authorize",
    token_endpoint: "https://id.example.test/token",
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["plain"]
  });

  assert.equal(status(report, "pkce_s256"), "FAIL");
});

test("token sanitizer never returns raw OAuth tokens", () => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://issuer.example",
      aud: "https://bridge.example/mcp",
      scope: "doc:read doc:write",
      exp: 1234567890,
      sub: "must-not-be-returned"
    })
  ).toString("base64url");
  const accessToken = `${header}.${payload}.signature`;

  const sanitized = sanitizeTokenResponse(200, {
    access_token: accessToken,
    refresh_token: "refresh-secret",
    id_token: "id-secret",
    token_type: "Bearer",
    expires_in: 3600
  });

  assert.equal(sanitized.hasAccessToken, true);
  assert.equal(sanitized.hasRefreshToken, true);
  assert.equal(sanitized.hasIdToken, true);
  assert.deepEqual(sanitized.accessTokenClaims, {
    iss: "https://issuer.example",
    aud: "https://bridge.example/mcp",
    scope: "doc:read doc:write",
    exp: 1234567890
  });

  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes(accessToken), false);
  assert.equal(serialized.includes("refresh-secret"), false);
  assert.equal(serialized.includes("id-secret"), false);
  assert.equal(serialized.includes("must-not-be-returned"), false);
});
