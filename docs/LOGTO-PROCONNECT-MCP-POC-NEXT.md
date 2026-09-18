# Live POC handoff boundary

This file is the durable restart point for C4-P0 Logto / ProConnect / MCP interoperability work.

At every fresh execution, first resolve exact `main`, then read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`, `docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md`, and this file. Reconstruct mutable GitHub facts before any durable transition.

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

A real Logto token has passed the integrated reusable bridge verifier/policy/principal/context path. Negative reusable-seam evidence is also PASS:

- wrong-resource token rejected before Principal/context construction;
- canonical-resource token without `doc:write` maps to a reduced Principal and a write is rejected before any mutation;
- OAuth bearer never enters the Grist credential-provider boundary.

### Actual HTTP `/mcp` path

The real OAuth-enabled Express/MCP request path now has complete positive and negative live evidence.

Positive canonical token:

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

Wrong resource:

```text
MCP OAuth server starts without static bearer: PASS
Wrong-resource bearer rejected on /mcp: PASS
Wrong-resource request reaches fake Grist: no
```

Missing `doc:write`:

```text
MCP OAuth server starts without static bearer: PASS
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
doc:write tool rejected on /mcp: PASS
Fake Grist mutation requests observed: 0
OAuth bearer reaches fake Grist: no
```

Detailed sanitized evidence is in:

```text
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
```

The HTTP resource-server phase is therefore complete.

## Exact next step: real ChatGPT MCP interoperability

The next blocking C4-P0 phase is to connect a **non-production/draft ChatGPT MCP app** to the public POC endpoint and observe the real client behavior rather than infer it from documentation.

Before changing deployment or Logto client configuration, verify the current official OpenAI/ChatGPT MCP OAuth requirements, especially:

- how the MCP server advertises protected-resource / authorization-server metadata;
- whether ChatGPT uses a pre-registered OAuth client, dynamic client registration, or another current client-registration model;
- the exact redirect/callback URI model that must be allowed in Logto;
- required PKCE and RFC 8707 `resource` behavior;
- required scopes and whether `offline_access` is requested;
- refresh/reconnect expectations.

Then prepare only the smallest standards-compatible metadata/deployment slice required for the draft ChatGPT test. Do not add provider-specific Logto behavior to bridge core and do not weaken resource/scope enforcement.

### Required ChatGPT live evidence

Record only sanitized PASS/FAIL/yes/no observations for:

```text
ChatGPT discovers protected MCP resource: PASS/FAIL
ChatGPT reaches Logto authorization: PASS/FAIL
Logto -> ProConnect login completes: PASS/FAIL
ChatGPT callback/code exchange completes: PASS/FAIL
Access token is bound to canonical MCP resource: PASS/FAIL
ChatGPT bearer reaches /mcp: PASS/FAIL
Dynamic Principal/context constructed for ChatGPT request: PASS/FAIL
OAuth bearer reaches Grist credential boundary: yes/no
Reconnect/refresh avoids unnecessary full reauthentication: PASS/FAIL
Logout/revocation stops subsequent MCP access: PASS/FAIL
```

Expected safe value for OAuth bearer reaching the Grist credential boundary is `no`.

Do not record callback authorization codes, access/refresh tokens, cookies, client secrets, raw identity values, or Grist credentials.

## Remaining important UNKNOWNs

Mandatory/critical UNKNOWNs are now primarily ChatGPT-specific:

- exact current ChatGPT callback/client-registration model;
- protected-resource metadata interoperability;
- end-to-end ChatGPT PKCE/resource behavior;
- login through Logto -> ProConnect from ChatGPT;
- bearer use on subsequent MCP calls;
- refresh/reconnect behavior;
- logout/revocation behavior.

Operational/secondary UNKNOWNs include controlled reboot confirmation for nftables + Docker + Logto persistence and explicit upstream ProConnect logout/re-authentication lifecycle semantics.

The following are no longer UNKNOWN: Logto RFC 8707 behavior, canonical resource-token issuance, fixed-scope issuance, local refresh issuance, live JWT/JWKS verification, dynamic Principal/C3 construction, wrong-resource and missing-write rejection at the reusable bridge seam, positive OAuth-enabled Express `/mcp` behavior, invalid-signature rejection on that route, static-bearer override prevention, OAuth-bearer exclusion from the Grist credential path, wrong-resource rejection on the HTTP path, and insufficient-scope write rejection with zero Grist mutations on the HTTP path.
