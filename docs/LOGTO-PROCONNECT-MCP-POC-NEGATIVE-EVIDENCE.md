# Logto / ProConnect / MCP POC — negative authorization evidence

**Date:** 2026-09-18  
**Scope:** C4-P0 Phase 4 provider-neutral bridge validation.

This document records sanitized live evidence only. It does not contain authorization codes, access tokens, refresh tokens, ID tokens, PKCE verifiers, cookies, raw Logto/ProConnect identifiers, Grist API keys, or other credentials.

## Wrong resource / audience — PASS

A temporary non-production Logto API resource was used to obtain a correctly signed access token whose audience differed from the canonical MCP resource. The bridge policy remained configured for:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Sanitized live diagnostics:

```text
Authorization request with wrong resource: PASS
Callback state matches: yes
Token exchange for wrong resource: PASS

Wrong-resource token JWT/JWKS verification: PASS
Token audience differs from canonical MCP resource: yes
Bridge wrong-resource rejection: PASS
Principal/context created after wrong-resource rejection: no
```

Result: **PASS**.

The access token was validly signed by the configured Logto authorization server, but the bridge rejected it for `wrong_audience` before dynamic Principal or Grist context construction.

## Missing `doc:write` — PASS

A fresh token was requested for the canonical MCP resource with a strict subset of the fixed public scopes:

```text
doc:read
doc.schema:write
```

`doc:write` was intentionally omitted. The integrated negative probe exercised the real OAuth Principal mapping, the real C3 `GristContextFactory`, and the real bounded `create_records` authorization path. Grist traffic was redirected only to a loopback fake server that counted mutation requests.

Sanitized live diagnostics:

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

Result: **PASS**.

The reduced token mapped to a reduced dynamic Principal, and the `doc:write` operation was denied before any mutation reached Grist. The observed mutation count was exactly zero.

## Phase 4 local seam conclusion

The provider-neutral bridge seam now has live positive and negative evidence for:

- standard JWT/JWKS verification of an actual Logto-issued token;
- configured issuer enforcement;
- canonical MCP resource/audience enforcement;
- fixed OAuth scope-to-capability mapping;
- dynamic opaque Principal construction;
- principal-bound C3 Grist context construction;
- raw OAuth bearer exclusion from the Grist credential-provider boundary;
- rejection of a validly signed wrong-resource token before context construction;
- rejection of an insufficient-scope write before any Grist mutation.

This evidence is deliberately narrower than the deployed Express `/mcp` path. The deployed route has not yet been switched from the current development/static authentication path to OAuth.

## Next blocking proof

The next bounded C4-P0 step is the actual HTTP `/mcp` authentication path. It must:

1. add an explicit provider-neutral OAuth POC mode using `OAUTH_ISSUER`, `OAUTH_JWKS_URI`, and `MCP_RESOURCE_URI` at the server edge;
2. prevent the static development bearer from silently overriding an OAuth principal;
3. construct a fresh Principal and principal-bound C3 context per authenticated MCP request;
4. accept a valid freshly issued Logto bearer through the real `/mcp` route;
5. reject wrong-resource, expired/invalid, and insufficient-scope requests with standards-compatible authentication/authorization behavior;
6. prove on that route that the OAuth bearer never becomes a Grist credential.

Only after the HTTP-path proof should C4-P0 move to the draft ChatGPT MCP app callback/login/resource/refresh/revocation checks.
