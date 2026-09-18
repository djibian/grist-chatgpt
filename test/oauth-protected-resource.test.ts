import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBearerChallenge,
  buildInsufficientScopeToolChallenge,
  buildOAuthProtectedResourceMetadata,
  buildOAuthProtectedResourceMetadataUrl,
  OAUTH_PROTECTED_RESOURCE_METADATA_PATH
} from "../src/auth/oauthProtectedResource.js";

const RESOURCE = "https://grist-chatgpt.loeildumaitre.fr/mcp";
const ISSUER = "https://auth-poc.loeildumaitre.fr/oidc";
const METADATA_URL =
  "https://grist-chatgpt.loeildumaitre.fr/.well-known/oauth-protected-resource";

test("builds bounded RFC 9728 protected-resource metadata", () => {
  assert.equal(
    OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
    "/.well-known/oauth-protected-resource"
  );
  assert.deepEqual(
    buildOAuthProtectedResourceMetadata({
      resource: RESOURCE,
      authorizationServer: ISSUER,
      scopes: ["doc:read", "doc:write", "doc.schema:write"]
    }),
    {
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: ["doc:read", "doc:write", "doc.schema:write"]
    }
  );
});

test("builds the public protected-resource metadata URL", () => {
  assert.equal(
    buildOAuthProtectedResourceMetadataUrl(
      "https://grist-chatgpt.loeildumaitre.fr"
    ),
    METADATA_URL
  );
});

test("advertises resource metadata in OAuth bearer challenges", () => {
  assert.equal(
    buildBearerChallenge(METADATA_URL),
    `Bearer resource_metadata="${METADATA_URL}"`
  );
  assert.equal(
    buildBearerChallenge(METADATA_URL, "invalid_token"),
    `Bearer resource_metadata="${METADATA_URL}", error="invalid_token"`
  );
});

test("builds a tool-level insufficient-scope challenge with error description", () => {
  assert.equal(
    buildInsufficientScopeToolChallenge(METADATA_URL, "doc:write"),
    `Bearer resource_metadata="${METADATA_URL}", error="insufficient_scope", error_description="Additional authorization is required for scope doc:write.", scope="doc:write"`
  );
});

test("quotes challenge values without allowing syntax injection", () => {
  assert.equal(
    buildBearerChallenge('https://example.test/a"b\\c'),
    'Bearer resource_metadata="https://example.test/a\\"b\\\\c"'
  );
});
