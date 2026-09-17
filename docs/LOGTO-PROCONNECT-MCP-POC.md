# Logto / ProConnect / MCP POC

**Status:** POC definition.  
**Depends on:** human C4 architecture decision recorded in `docs/OAUTH-IDP-DECISION.md`.  
**Purpose:** prove the selected OAuth architecture before full production-oriented C4 implementation.

## Architecture under test

```text
ChatGPT / Codex
      |
   OAuth 2.1 / MCP
      |
      v
 Logto OSS (self-hosted)
      |
 OIDC federation/login
      v
  ProConnect

 Logto
      |
 audience-bound access token
      v
 grist-chatgpt resource server
      |
 dynamic Principal
      |
 GristContextFactory
```

This POC is non-production. It must not create a production DataPass, production identity obligation or persistent user credential store unless separately approved.

## Fixed invariants

- MCP remains the public contract.
- ProConnect is the upstream institutional identity source.
- Logto owns the MCP-facing authorization-server behavior.
- `grist-chatgpt` remains a standards-based resource server and must not require a proprietary Logto SDK.
- Public scopes remain exactly `doc:read`, `doc:write`, `doc.schema:write`.
- OAuth/ProConnect tokens and secrets are never model-visible, committed, or written to general logs.
- OAuth tokens are never forwarded to Grist.
- Upstream Grist work continues to use the current user's own Grist API key through the C3 context boundary.

## Canonical POC resource

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

The implementation must make this configurable so the production resource URI can change without code changes.

## Phase 1 — reproducible Logto OSS environment

Prepare a bounded, documented non-production deployment using PostgreSQL and HTTPS.

Required evidence:

- exact Logto version/image pinned for the POC;
- PostgreSQL persistence;
- configuration and secrets split cleanly;
- no real secrets in Git;
- health/restart procedure;
- admin console access protected by infrastructure/network controls rather than exposed broadly to the Internet.

A local/demo Docker Compose may be used for early verification, but the POC result must clearly distinguish demo setup from production guidance.

## Phase 2 — ProConnect federation

Configure Logto's generic OIDC connector against the ProConnect integration environment.

Verify:

- issuer/discovery resolution;
- Authorization Code flow;
- exact registered callback URI;
- PKCE behavior where applicable on the Logto -> ProConnect leg;
- successful login through ProConnect;
- stable mapping of the same ProConnect user to the same Logto subject across repeated logins;
- logout/re-login does not create an unintended new bridge identity.

No ProConnect client secret may be committed or pasted into model-visible content.

## Phase 3 — MCP authorization-server behavior

Configure the MCP resource/API and scopes in Logto.

Required resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Required scopes:

```text
doc:read
doc:write
doc.schema:write
```

Verify from live metadata/flows:

- issuer and discovery metadata;
- Authorization Code flow;
- PKCE `S256`;
- RFC 8707 `resource` accepted as required by MCP;
- resulting access token is audience/resource-bound to the canonical MCP resource;
- scopes are present/recoverable in a form the resource server can enforce;
- refresh/offline-access behavior is available for durable client connectivity;
- resource-server validation can be implemented using standard JWT/JWKS semantics.

## Phase 4 — provider-neutral bridge validation seam

Implement only the smallest bridge-side slice needed for the POC.

The bridge configuration should be conceptually provider-neutral, for example:

```text
OAUTH_ISSUER
OAUTH_JWKS_URI or discovery-derived JWKS
MCP_RESOURCE_URI
```

Do not add a Logto SDK dependency merely to validate access tokens.

Validation must reject at least:

- invalid signature;
- wrong issuer;
- expired token;
- token for a different audience/resource;
- token missing the operation's required scope.

A valid token must produce a dynamic `Principal` whose scopes feed the existing `AuthorizationService` and whose identity enters the existing C3 `GristContextFactory` boundary.

## Phase 5 — ChatGPT draft app

Using a non-production/draft ChatGPT MCP app, verify the actual client behavior rather than relying only on documentation.

Required checks:

- exact callback/redirect model;
- pre-registered OAuth client works;
- PKCE works end to end;
- client sends/uses the MCP resource as expected;
- initial login completes through Logto -> ProConnect;
- subsequent MCP calls use the resulting bearer successfully;
- refresh reconnects without avoidable user reauthentication;
- logout/revocation behavior is understood;
- ChatGPT never sees ProConnect credentials or Grist API keys.

CIMD support should be checked as an interoperability bonus for generic MCP clients, but failure of CIMD alone does not block the initial ChatGPT path if pre-registration is fully conformant and usable.

## Negative tests

The POC is incomplete without negative evidence.

At minimum prove:

1. token with wrong audience/resource -> rejected;
2. token missing `doc:write` -> write operation rejected before Grist mutation;
3. expired/invalid token -> standards-compatible authentication failure;
4. user A OAuth principal cannot reuse user B Grist context/cache;
5. OAuth token is never used as an upstream Grist credential;
6. static bearer development mode cannot silently override an OAuth principal in production mode.

## Evidence format

Create a durable result document during the POC, for example:

```text
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
```

Record PASS / FAIL / UNKNOWN with sanitized evidence. Never record:

- client secrets;
- authorization codes;
- cookies;
- access tokens;
- refresh tokens;
- ID tokens;
- Grist API keys.

For token claims, record only validated non-secret diagnostics needed to prove issuer/audience/scope/expiry behavior.

## Exit criteria

The POC passes only if all mandatory properties below are demonstrated:

- ProConnect login through Logto works with a stable identity;
- Logto satisfies the MCP-facing PKCE and RFC 8707 resource flow;
- access tokens are verifiably bound to the MCP resource;
- bridge scopes are enforceable;
- wrong-resource tokens are rejected;
- refresh/durable ChatGPT connectivity is acceptable;
- provider-neutral resource-server validation works;
- OAuth identity maps safely into C3 principal isolation;
- no credential/token boundary is crossed incorrectly.

If a mandatory MCP property fails because of Logto, stop before broad C4 implementation and reopen the authorization-server product choice using the documented fallbacks (Auth0 EU / Curity Standard).

If the POC passes, the next tranche is the production-quality C4 OAuth integration plus its tests/documentation.
