# Live POC handoff boundary

This file is the durable restart point for C4-P0 Logto / ProConnect / MCP interoperability work.

At every fresh execution, first resolve exact `main`, then read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, the main results ledger, the HTTP evidence document, and this file. Reconstruct mutable GitHub facts before any durable transition.

Never record ProConnect client secrets, OAuth tokens/codes/cookies, Logto/database/admin credentials, Grist API keys, raw Logto user IDs, raw provider subjects, or PKCE verifiers in GitHub, chat, logs, or evidence documents.

## Live environment

```text
Logto OSS    1.43.0
PostgreSQL   16.15-alpine
Public auth  https://auth-poc.loeildumaitre.fr
Admin auth   https://auth-poc-admin.loeildumaitre.fr
MCP resource https://grist-chatgpt.loeildumaitre.fr/mcp
```

C4-P0 remains non-production and blocking. Full production-oriented C4 must not start until all mandatory POC checks are PASS.

## Durable PASS evidence

### Identity and authorization server

- Logto/PostgreSQL works behind Caddy over public HTTPS.
- ProConnect integration through Logto generic OIDC succeeds.
- Repeated login with the same ProConnect identity maps to the same Logto user without duplicate account creation.
- Authorization Code + PKCE `S256` works with the dedicated public/native test client.
- RFC 8707 canonical `resource` is accepted on authorization and token exchange.
- Logto issues a JWT access token bound to the canonical MCP resource.
- `doc:read`, `doc:write`, and `doc.schema:write` are represented in the live token when requested and allowed.
- Standard JWT/JWKS verification, exact issuer, and expiry checks pass.
- `offline_access` plus explicit consent yields a refresh token in the local public-client flow.

### Provider-neutral bridge seam

A real Logto token has passed the integrated reusable bridge verifier/policy/principal/context path. The OAuth bearer never entered the Grist credential-provider boundary.

Negative reusable-seam evidence is also PASS:

- a validly signed wrong-resource token is rejected before Principal/context construction;
- a canonical-resource token without `doc:write` maps to a reduced Principal and a write is rejected before any Grist mutation; the fake Grist observed exactly zero mutation requests.

Detailed negative evidence is recorded in:

```text
docs/LOGTO-PROCONNECT-MCP-POC-NEGATIVE-EVIDENCE.md
```

### Actual HTTP `/mcp` positive path — PASS

PR #44 integrated an explicit provider-neutral OAuth mode on the actual Express/MCP route. PR #45 integrated the sanitized HTTP probe.

A fresh canonical Logto token proved:

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

### Actual HTTP `/mcp` wrong-resource path — PASS

A freshly issued, correctly signed Logto token for the deliberately different POC resource was presented to the bridge while `MCP_RESOURCE_URI` remained the canonical MCP resource.

Sanitized diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Wrong-resource bearer rejected on /mcp: PASS
Wrong-resource request reaches fake Grist: no
```

The token was therefore rejected by the real HTTP resource-server path before any Grist request.

Full sanitized HTTP evidence is recorded in:

```text
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
```

## Exact next step: final HTTP negative — missing `doc:write`

This is now the only required HTTP authorization negative remaining before the draft ChatGPT phase.

Obtain a fresh canonical-resource token carrying:

```text
doc:read
doc.schema:write
```

and deliberately **not** `doc:write`.

Keep the token only in local process/environment memory and run the integrated probe with:

```text
MCP_HTTP_PROBE_CASE=missing-write
```

The probe must exercise the actual `/mcp` endpoint and invoke `create_records` through MCP `tools/call` against the loopback fake Grist boundary.

Expected sanitized evidence:

```text
MCP OAuth server starts without static bearer: PASS
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
create_records rejected through MCP tools/call: PASS
Fake Grist mutation requests observed: 0
```

The exact output labels produced by the integrated probe are authoritative if they differ slightly from this summary. The critical invariant is that the reduced-scope token authenticates to the canonical resource, but the write operation is denied and the fake Grist observes zero mutation requests.

Do not add `doc:write`, broaden scopes, alter the canonical resource, or weaken authorization to make the test pass.

## After the final HTTP negative PASS

Update the durable results ledger and HTTP evidence document, then move C4-P0 to a non-production/draft ChatGPT MCP app and verify:

- exact ChatGPT callback/redirect model;
- pre-registered client behavior;
- PKCE/resource handling end to end;
- login through Logto -> ProConnect;
- bearer use on subsequent MCP calls;
- refresh/reconnect without avoidable reauthentication;
- logout/revocation behavior;
- no ProConnect credential, OAuth token, or Grist API key becomes model-visible.

## Remaining important UNKNOWNs

Mandatory/critical UNKNOWNs are now primarily:

- insufficient-scope write rejection on the actual HTTP `/mcp` route;
- draft ChatGPT callback/login/PKCE/resource/bearer/refresh/revocation behavior.

Operational/secondary UNKNOWNs include controlled reboot confirmation for nftables + Docker + Logto persistence and explicit upstream ProConnect logout/re-authentication lifecycle semantics.

The following are no longer UNKNOWN: Logto RFC 8707 behavior, canonical resource-token issuance, fixed-scope issuance, local refresh issuance, provider-neutral live JWT/JWKS verification, dynamic Principal/C3 context construction, wrong-resource and missing-write rejection at the reusable bridge seam, positive OAuth-enabled Express `/mcp` behavior, invalid-signature rejection on that route, static-bearer override prevention, OAuth-bearer exclusion from the Grist credential path, and wrong-resource rejection on the real HTTP `/mcp` path before any Grist request.
