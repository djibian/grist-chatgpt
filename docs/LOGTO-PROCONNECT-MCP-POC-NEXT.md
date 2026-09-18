# Live POC handoff boundary

This file is the durable restart point for C4-P0 Logto / ProConnect / MCP interoperability work.

At every fresh execution, first resolve exact `main`, then read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, the main results ledger, and this file. Reconstruct mutable GitHub facts before any durable transition.

Never record ProConnect client secrets, OAuth tokens/codes/cookies, Logto/database/admin credentials, Grist API keys, raw Logto user IDs, raw provider subjects, or PKCE verifiers in GitHub, chat, logs, or evidence documents.

## Live environment

```text
Logto OSS    1.43.0
PostgreSQL   16.15-alpine
Public auth  https://auth-poc.loeildumaitre.fr
Admin auth   https://auth-poc-admin.loeildumaitre.fr
MCP resource https://grist-chatgpt.loeildumaitre.fr/mcp
```

The bridge deployment itself has not yet been converted to OAuth. Keep C4-P0 bounded; do not jump to full production C4.

## Durable PASS evidence

### Environment and identity

- Logto/PostgreSQL works behind Caddy over public HTTPS.
- Admin Console is infrastructure-restricted.
- Docker outbound HTTPS/HIBP works after the nftables forwarding repair.
- ProConnect integration application is configured with the exact Logto callback.
- Logto generic OIDC federation through ProConnect succeeds.
- Repeated successful login with the same ProConnect identity maps to the same Logto user without duplicate account creation.

### MCP-facing authorization server

Canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Fixed scopes:

```text
doc:read
doc:write
doc.schema:write
```

PASS evidence includes:

- PKCE `S256` and Authorization Code flow;
- explicit RFC 8707 `resource` accepted on authorization and token exchange;
- JWT access token bound to the canonical MCP resource;
- all three fixed scopes present when requested and allowed;
- standard signature verification against Logto JWKS with matching issuer and valid expiry;
- refresh token issuance for the local public-client flow with `offline_access` plus explicit consent.

### Provider-neutral bridge positive path

PR #40 integrated the standards-based remote-JWKS verifier and sanitized local bridge probe.

A freshly issued real Logto token proved:

```text
Bridge JWT/JWKS verification: PASS
Bridge issuer policy: PASS
Bridge resource audience policy: PASS
Bridge scope mapping: PASS
Dynamic Principal created: PASS
Principal-bound Grist context created: PASS
Grist credential provider invoked with Principal context: yes
Raw OAuth bearer reaches Grist credential provider: no
```

This is a real token through the reusable OAuth/C3 seams, not yet through the deployed Express `/mcp` route.

### Provider-neutral bridge negative path

PR #42 integrated the sanitized negative authorization probe. Live negative evidence is recorded in:

```text
docs/LOGTO-PROCONNECT-MCP-POC-NEGATIVE-EVIDENCE.md
```

#### Wrong resource / audience — PASS

A validly signed Logto token for a deliberately different resource produced:

```text
Wrong-resource token JWT/JWKS verification: PASS
Token audience differs from canonical MCP resource: yes
Bridge wrong-resource rejection: PASS
Principal/context created after wrong-resource rejection: no
```

#### Missing `doc:write` — PASS

A canonical-resource token requested only with `doc:read` and `doc.schema:write` produced:

```text
Insufficient-scope token JWT/JWKS verification: PASS
Canonical MCP resource audience accepted: PASS
Token/Principal missing doc:write: yes
Reduced-scope dynamic Principal created: PASS
doc:write operation rejected before mutation: PASS
Authorization path performed local discovery reads: yes
Fake Grist mutation requests observed: 0
```

The authorization layer therefore reduced authority correctly and denied the write before any mutation reached Grist.

## Exact next step: actual HTTP `/mcp` OAuth path

The next blocking C4-P0 slice is no longer Logto configuration or local token validation. It is the real Express/MCP request path.

Implement the smallest reversible POC server-edge OAuth mode. Requirements:

1. Keep the bridge provider-neutral. Edge configuration should use the existing conceptual contract:

```text
OAUTH_ISSUER
OAUTH_JWKS_URI
MCP_RESOURCE_URI
```

2. Add an explicit authentication mode rather than silently mixing static development bearer and OAuth behavior.
3. In OAuth mode, a request bearer must be verified cryptographically through the integrated JWKS verifier, then passed through the existing issuer/audience/expiry and scope mapping seams.
4. Construct a fresh dynamic `Principal` and principal-bound C3 context for each authenticated MCP request.
5. Do not forward the OAuth bearer to Grist or use it as a Grist credential.
6. Do not add Logto SDK coupling, broaden public scopes, or choose C5 credential persistence.
7. Preserve the static bearer only as an explicit development/backward-compatibility mode if still useful; OAuth mode must not permit it to override or replace the OAuth principal.

### Required live HTTP evidence

After the bounded implementation is integrated, exercise the actual `/mcp` route with sanitized diagnostics for:

```text
Valid Logto bearer reaches /mcp: PASS/FAIL
JWT/JWKS authentication on /mcp: PASS/FAIL
Dynamic Principal/context constructed on /mcp: PASS/FAIL
Wrong-resource bearer rejected on /mcp: PASS/FAIL
Expired/invalid bearer rejected on /mcp: PASS/FAIL
Insufficient-scope operation rejected on /mcp: PASS/FAIL
Static bearer can override OAuth principal in OAuth mode: yes/no
OAuth bearer reaches Grist credential provider: yes/no
```

Expected safe values for the last two lines are `no`.

Use a synthetic/fake Grist boundary where practical for negative evidence so authorization failures cannot mutate a real document.

## After `/mcp` OAuth proof

Only after the actual HTTP request path is PASS should the POC move to a non-production/draft ChatGPT MCP app and verify:

- exact ChatGPT callback/redirect model;
- pre-registered client behavior;
- PKCE/resource handling end to end;
- login through Logto -> ProConnect;
- bearer use on subsequent MCP calls;
- refresh/reconnect without avoidable reauthentication;
- logout/revocation behavior;
- no ProConnect credential or Grist API key becomes model-visible.

## Important remaining UNKNOWNs

C4-P0 remains ACTIVE. Remaining important UNKNOWNs include:

- actual OAuth-enabled Express `/mcp` positive path;
- wrong-resource, expired/invalid, and insufficient-scope behavior on that HTTP route;
- production/POC OAuth mode preventing static-bearer override;
- ChatGPT callback/login/PKCE/resource/bearer/refresh/revocation behavior;
- controlled reboot confirmation for nftables + Docker + Logto persistence;
- explicit upstream ProConnect logout/re-authentication lifecycle semantics.

The following are no longer UNKNOWN: Logto RFC 8707 behavior, resource-bound token issuance, fixed-scope issuance, local refresh issuance, provider-neutral live JWT/JWKS verification, dynamic Principal/C3 context construction, OAuth-bearer exclusion from the Grist credential-provider context, wrong-resource rejection at the reusable bridge seam, and missing-`doc:write` rejection before Grist mutation.

Full production-oriented C4 remains blocked until all mandatory POC exit criteria are PASS.
