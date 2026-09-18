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

## Missing `doc:write` on HTTP path — PASS

A fresh canonical-resource token was requested with only:

```text
doc:read
doc.schema:write
```

and deliberately without `doc:write`.

The same token first re-demonstrated the reusable bridge-seam negative evidence:

```text
Authorization request without doc:write: PASS
Callback state matches: yes
Reduced-scope token exchange: PASS
Insufficient-scope token JWT/JWKS verification: PASS
Canonical MCP resource audience accepted: PASS
Token/Principal missing doc:write: yes
Reduced-scope dynamic Principal created: PASS
doc:write operation rejected before mutation: PASS
Authorization path performed local discovery reads: yes
Fake Grist mutation requests observed: 0
```

The token was then presented unchanged to the actual OAuth-enabled HTTP `/mcp` route. The probe invoked `create_records` through MCP `tools/call` against the loopback fake Grist boundary. Sanitized diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
doc:write tool rejected on /mcp: PASS
Fake Grist mutation requests observed: 0
OAuth bearer reaches fake Grist: no
```

Result: **PASS**.

This proves scope reduction is enforced on the real HTTP MCP request path: a valid canonical bearer can authenticate and construct its reduced dynamic principal, but an operation requiring `doc:write` is denied before any Grist mutation. The fake Grist observed exactly zero mutation requests, and it never observed the OAuth bearer.

## HTTP `/mcp` POC conclusion

The mandatory local/live HTTP resource-server behaviors are now proven:

- canonical resource bearer accepted;
- JWT/JWKS, issuer, audience/resource and expiry validation applied;
- dynamic request-bound Principal/C3 context constructed;
- missing bearer rejected;
- invalid-signature bearer rejected;
- static development bearer cannot override OAuth mode;
- wrong-resource bearer rejected before the Grist boundary;
- insufficient-scope write rejected before any Grist mutation;
- OAuth bearer never becomes or reaches the Grist credential boundary.

The next C4-P0 critical-path phase is **real ChatGPT MCP client interoperability**, including callback/client behavior, PKCE/resource handling, Logto -> ProConnect login, subsequent bearer use, refresh/reconnect and revocation/logout behavior.
