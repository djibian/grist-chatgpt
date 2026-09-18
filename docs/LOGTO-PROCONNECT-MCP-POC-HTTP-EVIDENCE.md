# Logto / ProConnect / MCP POC — HTTP `/mcp` evidence

**Date:** 2026-09-18  
**Scope:** C4-P0 actual Express/MCP OAuth request path.

This document records sanitized live non-production evidence only. It contains no authorization code, access token, refresh token, ID token, PKCE verifier, cookie, raw Logto/ProConnect identity value, Grist API key, or other credential.

## Integrated HTTP OAuth POC path

PR #44 integrated an explicit provider-neutral MCP authentication mode at the server edge. In `oauth` mode:

- `OAUTH_ISSUER`, `OAUTH_JWKS_URI`, and `MCP_RESOURCE_URI` are required;
- `MCP_BEARER_TOKEN` is prohibited, so a static development bearer cannot silently override OAuth identity;
- every authenticated `/mcp` request is verified through the remote-JWKS verifier and issuer/audience/expiry policy;
- OAuth scopes map to the existing bounded bridge capabilities;
- a fresh opaque OAuth `Principal` and principal-bound C3 Grist context are created for the request;
- the MCP server is built with that request-bound context;
- the OAuth bearer is not used as a Grist credential.

PR #45 integrated a sanitized local HTTP probe. It starts the real bridge server in OAuth mode against a loopback fake Grist boundary and sends real MCP requests through `/mcp`.

## Positive HTTP path — PASS

A fresh Logto Authorization Code + PKCE `S256` flow was completed with the canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

The resulting resource token was passed only in process memory to the integrated HTTP probe. Sanitized diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Missing bearer rejected on /mcp: PASS
Static bearer can override OAuth principal in OAuth mode: no
Invalid-signature bearer rejected on /mcp: PASS
Valid Logto bearer reaches /mcp: PASS
Dynamic Principal/context constructed on /mcp: PASS
OAuth bearer reaches fake Grist: no
Synthetic Grist credential reaches fake Grist: yes
```

The same run re-demonstrated the authorization-server evidence:

```text
Authorization request with explicit resource: PASS
Callback state matches: yes
Token exchange: PASS
JWT access token: yes
Issuer matches Logto: yes
Audience/resource matches canonical MCP resource: yes
Granted scopes include doc:read/doc:write/doc.schema:write: yes
Signature verifies against Logto JWKS: yes
Expiry valid: yes
Refresh token issued when requested: yes
```

Result: **PASS**.

This proves the actual HTTP `/mcp` route accepts a freshly issued canonical Logto bearer after standards-based JWT/JWKS verification, creates the dynamic OAuth principal and principal-bound C3 context on the real request path, rejects missing and cryptographically invalid bearers, prevents static-bearer override in OAuth mode, and keeps the OAuth bearer separate from the upstream Grist credential boundary.

The fake Grist observed only the synthetic Grist credential sentinel. It did not observe the OAuth bearer.

## Wrong resource / audience on HTTP path — PASS

A fresh, correctly signed Logto token was issued for the deliberately different POC resource rather than the canonical MCP resource. The same token first re-demonstrated the reusable bridge-seam negative evidence:

```text
Authorization request with wrong resource: PASS
Callback state matches: yes
Token exchange for wrong resource: PASS
Wrong-resource token JWT/JWKS verification: PASS
Token audience differs from canonical MCP resource: yes
Bridge wrong-resource rejection: PASS
Principal/context created after wrong-resource rejection: no
```

The token was then presented unchanged to the actual HTTP `/mcp` route while the bridge remained configured for the canonical MCP resource. Sanitized diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Wrong-resource bearer rejected on /mcp: PASS
Wrong-resource request reaches fake Grist: no
```

Result: **PASS**.

This proves the actual HTTP resource-server path rejects a cryptographically valid Logto token whose audience/resource does not match the canonical MCP resource. Rejection occurs before any request reaches the Grist boundary.

No deployment/resource policy was weakened for the test: the canonical `MCP_RESOURCE_URI` remained unchanged, and the deliberately different token resource remained different.

## Remaining HTTP negative proof

Exactly one required HTTP authorization negative remains:

- `missing-write`: a canonical-resource token without `doc:write` must authenticate successfully, but an MCP `tools/call` for `create_records` must be denied before any fake Grist mutation.

Expected safe evidence includes:

```text
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
create_records rejected through MCP tools/call: PASS
Fake Grist mutation requests observed: 0
```

Only after that HTTP negative check is PASS should the POC advance to the draft ChatGPT MCP app interoperability/refresh/revocation phase.
