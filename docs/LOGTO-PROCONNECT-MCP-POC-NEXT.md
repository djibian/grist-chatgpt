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

The following are no longer UNKNOWN:

- Logto/PostgreSQL public HTTPS deployment and protected admin surface;
- ProConnect integration through Logto generic OIDC;
- repeated ProConnect login maps to the same Logto identity;
- Authorization Code + PKCE `S256`;
- RFC 8707 canonical `resource` on authorization and token exchange;
- JWT access token bound to the canonical MCP resource;
- fixed scopes `doc:read`, `doc:write`, `doc.schema:write`;
- standard JWT/JWKS signature, issuer, audience/resource, expiry validation;
- local refresh-token issuance using `offline_access` plus consent;
- dynamic OAuth `Principal` and C3 `GristContextFactory` construction;
- wrong-resource rejection before Grist access;
- insufficient-scope write rejection before mutation;
- static bearer cannot override OAuth mode;
- OAuth bearer never becomes the upstream Grist credential;
- actual Express/MCP `/mcp` positive and negative OAuth paths;
- RFC 9728 protected-resource metadata;
- OAuth `WWW-Authenticate` resource metadata challenge;
- root tool `securitySchemes` plus compatibility mirror;
- runtime `_meta["mcp/www_authenticate"]` insufficient-scope challenge;
- public non-production bridge deployed at exact SHA `ec9ee27c602c103a3d18866867faceac41a455b0`;
- local and public `/healthz` HTTP 200 after OAuth deployment;
- Logto Dynamic app / CIMD enabled with only the three fixed MCP permissions;
- public authorization metadata advertises CIMD, PKCE `S256`, Authorization Code, refresh token and RFC 9207 issuer identification;
- `probe:chatgpt-oauth-readiness` returns final `ChatGPT OAuth readiness: PASS`.

Detailed sanitized evidence is in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md` and `docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md`.

## Exact next step: real ChatGPT MCP OAuth client

No further bridge or Logto compatibility change is justified before observing the real ChatGPT client.

Current official OpenAI documentation should be rechecked immediately before the live test because availability and UI are product-dependent. As checked on 2026-09-18:

- full custom MCP support with write/modify actions is documented for ChatGPT Business and Enterprise/Edu workspaces;
- Pro is documented as able to connect read/fetch MCPs in developer mode, not full write MCP;
- Plus is not documented as eligible for custom full MCP developer mode;
- on eligible workspaces, enable Developer mode, create a custom app/plugin, provide the public `/mcp` endpoint, choose OAuth, run Scan Tools, and complete the authorization prompt.

If the current account/workspace does not expose the required developer/custom-app UI, treat that as a **ChatGPT plan/workspace availability gate**, not as a Logto or bridge compatibility failure. Use an eligible Business/Enterprise/Edu workspace for the mandatory full MCP POC rather than weakening the server contract.

### Live connection target

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Selected client-registration path:

```text
CIMD
```

Treat the exact ChatGPT CIMD client metadata URL and callback URI shown/used during the live connection as observed facts. Do not guess or hard-code them into bridge core.

## Required ChatGPT live evidence

Record only sanitized PASS/FAIL/yes/no observations for:

```text
ChatGPT discovers protected MCP resource: PASS/FAIL
ChatGPT CIMD client identity accepted by Logto: PASS/FAIL
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

Expected safe value for `OAuth bearer reaches Grist credential boundary` is `no`.

Do not record callback authorization codes, access/refresh tokens, cookies, client secrets, raw identity values, or Grist credentials.

## Remaining important UNKNOWNs

Mandatory/critical UNKNOWNs are now exclusively live-client specific:

- availability of an eligible ChatGPT developer/custom-app workspace for the test;
- exact ChatGPT CIMD client metadata and callback observed for this connection;
- end-to-end ChatGPT PKCE/resource flow;
- login through Logto -> ProConnect initiated from ChatGPT;
- bearer use on subsequent MCP calls;
- refresh/reconnect behavior;
- logout/revocation behavior.

Operational/secondary UNKNOWNs include controlled reboot persistence for nftables + Docker + Logto and an explicitly isolated upstream ProConnect logout/re-authentication lifecycle.
