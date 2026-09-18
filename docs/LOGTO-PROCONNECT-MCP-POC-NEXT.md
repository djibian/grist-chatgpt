# Live POC handoff boundary

This file is the durable restart point for C4-P0 Logto / ProConnect / MCP interoperability work.

At every fresh execution, first resolve exact `main`, then read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`, `docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md`, `docs/CHATGPT-OAUTH-READINESS.md`, and this file. Reconstruct mutable GitHub facts before any durable transition.

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

The real OAuth-enabled Express/MCP request path has complete positive and negative live evidence:

```text
MCP OAuth server starts without static bearer: PASS
Missing bearer rejected on /mcp: PASS
Static bearer can override OAuth principal in OAuth mode: no
Invalid-signature bearer rejected on /mcp: PASS
Valid Logto bearer reaches /mcp: PASS
Dynamic Principal/context constructed on /mcp: PASS
OAuth bearer reaches fake Grist: no
Synthetic Grist credential reaches fake Grist: yes
Wrong-resource bearer rejected on /mcp: PASS
Wrong-resource request reaches fake Grist: no
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
doc:write tool rejected on /mcp: PASS
Fake Grist mutation requests observed: 0
```

Detailed sanitized evidence is in `docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md`.

The HTTP resource-server phase is complete.

### ChatGPT-facing OAuth discovery/tool signaling

Repository-side prerequisites required by current OpenAI MCP OAuth guidance are now integrated:

- RFC 9728 protected-resource metadata;
- OAuth `WWW-Authenticate` resource-metadata challenges on `/mcp` 401 responses;
- root `securitySchemes` per MCP tool, with compatibility mirror in `_meta`;
- `_meta["mcp/www_authenticate"]` `insufficient_scope` challenges for actual missing-capability tool errors.

Current implementation baseline for these three signals:

```text
92224af0da8a454d1312be01ff52b56229ec49c6
```

`docs/CHATGPT-OAUTH-READINESS.md` records the current OpenAI and Logto interoperability requirements and the safe public readiness procedure.

## Exact next step: public ChatGPT readiness, then real ChatGPT MCP interoperability

The next blocking C4-P0 work is operational/live, not another OAuth architecture change.

### 1. Deploy the current integrated bridge

Deploy a `main` containing the ChatGPT-facing OAuth discovery/tool-signaling prerequisites to the public non-production endpoint:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Do not change the canonical MCP resource URI.

### 2. Enable Logto Dynamic app / CIMD

In the non-production Logto Admin Console, enable the tenant-level **Dynamic app (CIMD)** and grant it only:

```text
doc:read
doc:write
doc.schema:write
```

Do not make these scopes defaults and do not add unrelated permissions.

This is the selected live client-registration path because Logto 1.43.0 supports CIMD dynamic clients and current ChatGPT supports CIMD. The exact client metadata URL and callback observed in ChatGPT remain live evidence; do not guess them into bridge code.

### 3. Run the public readiness probe

From the repository:

```bash
MCP_RESOURCE_URI='https://grist-chatgpt.loeildumaitre.fr/mcp' \
  npm run probe:chatgpt-oauth-readiness
```

Expected before connecting ChatGPT: all mandatory readiness lines PASS. The RFC 9207 issuer-identification line is reported as yes/no because ChatGPT can use a callback-specific CIMD document when the stable form is unavailable.

If a fresh canonical-resource bearer already exists locally, the same probe may additionally check authenticated `tools/list` by passing it only through `OAUTH_ACCESS_TOKEN`; it never prints the token and performs no Grist write.

### 4. Connect the real ChatGPT draft/developer MCP app

Once public readiness is PASS, connect the non-production MCP endpoint through the current ChatGPT developer/plugin flow and observe the real client behavior.

Treat the callback URI and CIMD/client metadata shown by ChatGPT as authoritative observations. Do not pre-register or hard-code guessed callback values merely to make the flow pass.

## Required ChatGPT live evidence

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

Mandatory/critical UNKNOWNs are now ChatGPT-specific:

- live Logto Dynamic app/CIMD advertisement after operator enablement;
- exact ChatGPT callback/client metadata observed for this connection;
- end-to-end ChatGPT PKCE/resource behavior;
- login through Logto -> ProConnect from ChatGPT;
- bearer use on subsequent MCP calls;
- refresh/reconnect behavior;
- logout/revocation behavior.

Operational/secondary UNKNOWNs include controlled reboot confirmation for nftables + Docker + Logto persistence and explicit upstream ProConnect logout/re-authentication lifecycle semantics.

The following are no longer UNKNOWN: Logto RFC 8707 behavior, canonical resource-token issuance, fixed-scope issuance, local refresh issuance, live JWT/JWKS verification, dynamic Principal/C3 construction, wrong-resource and missing-write rejection at the reusable bridge seam, positive OAuth-enabled Express `/mcp` behavior, invalid-signature rejection on that route, static-bearer override prevention, OAuth-bearer exclusion from the Grist credential path, wrong-resource rejection on the HTTP path, insufficient-scope write rejection with zero Grist mutations, and the repository-side ChatGPT OAuth discovery/tool-signaling prerequisites.
