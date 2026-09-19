# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Latest live update:** 2026-09-19  
**Architecture:** Logto OSS self-hosted as MCP-facing authorization server; ProConnect as upstream OIDC identity source; `grist-chatgpt` as provider-neutral OAuth resource server.

Never record client secrets, authorization codes, cookies, access tokens, refresh tokens, ID tokens, Grist API keys, database/admin passwords, PKCE verifiers, raw Logto user IDs, raw provider subjects, or other credentials in this file.

Status vocabulary:

- **PASS** — demonstrated with reproducible sanitized evidence;
- **FAIL** — demonstrated incompatible or incorrect for the tested state;
- **UNKNOWN** — not yet demonstrated; absence of evidence is never promoted to PASS.

## Reproducible environment

| Requirement | Status | Evidence |
| --- | --- | --- |
| Logto version pinned | PASS | `infra/poc/logto/docker-compose.yml` pins Logto OSS `1.43.0` |
| PostgreSQL version pinned | PASS | POC compose pins `16.15-alpine` |
| PostgreSQL persistence | PASS | named persistent volume |
| Secrets excluded from Git | PASS | live environment files remain outside the repository |
| Public Logto HTTPS | PASS | `https://auth-poc.loeildumaitre.fr` |
| Admin console infrastructure-restricted | PASS | dedicated admin host with infrastructure access control |
| Full reboot persistence | UNKNOWN | controlled reboot still not performed; not a C4-P0 exit blocker |

## ProConnect federation

Selected upstream issuer:

```text
https://fca.integ01.dev-agentconnect.fr/api/v2
```

Sanitized evidence:

- ProConnect integration client registered with the Logto callback;
- Logto generic OIDC connector configured and enabled;
- complete Logto -> ProConnect -> Logto Authorization Code login completed;
- repeated login of the same ProConnect identity maps to the same Logto user;
- no raw provider subject or Logto user identifier recorded.

| Requirement | Status |
| --- | --- |
| ProConnect integration client | PASS |
| Logto generic OIDC connector | PASS |
| ProConnect authorization redirect and callback | PASS |
| Complete Logto -> ProConnect -> Logto login | PASS |
| Stable identity across repeated successful login | PASS |
| Explicit upstream ProConnect logout/re-login lifecycle | UNKNOWN; secondary |

## MCP-facing authorization-server behavior

Canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Fixed public scopes:

```text
doc:read
doc:write
doc.schema:write
```

PASS evidence:

- Authorization Code + PKCE `S256`;
- RFC 8707 `resource` on authorization and token exchange;
- JWT access token bound to the canonical MCP resource;
- fixed bridge scopes carried by the token;
- standard JWT/JWKS signature, issuer, audience/resource and expiry validation;
- refresh-token grant advertised;
- local refresh-token issuance demonstrated with `offline_access` plus consent;
- CIMD support advertised by Logto Dynamic app;
- ChatGPT client metadata accepted by Logto;
- ChatGPT-required OIDC `openid` / `email` path works after granting those Dynamic app user permissions;
- Logto can fetch ChatGPT client metadata and public JWKS over HTTPS.

The Dynamic app remains limited to the intended MCP permissions plus the minimum OIDC profile permissions required for the ChatGPT identity flow.

## Provider-neutral bridge and `/mcp`

Reusable seam and real HTTP evidence are PASS for:

- JWT/JWKS verification;
- issuer policy;
- canonical resource/audience binding;
- scope-to-capability mapping;
- dynamic `Principal` creation;
- principal-bound Grist context creation;
- wrong-resource rejection before Grist access;
- insufficient-`doc:write` rejection before mutation;
- OAuth mode cannot be overridden by a static MCP bearer;
- OAuth bearer is never passed to the Grist credential provider;
- RFC 9728 protected-resource metadata;
- unauthenticated `/mcp` HTTP 401 with `WWW-Authenticate` resource metadata challenge;
- root tool `securitySchemes` and runtime insufficient-scope challenges.

Cross-user Grist context/cache isolation remains covered by integrated C3 tests.

## Public non-production deployment used for the live ChatGPT proof

The live ChatGPT test used bridge runtime SHA:

```text
94434b4f56d239517079b2e57a8632e5ac07a838
```

Observed deployment checks before the live client test:

```text
grist-chatgpt.service: active
Listener: 127.0.0.1:3000 only
Local /healthz: HTTP 200
Public /healthz: HTTP 200
Protected-resource metadata: canonical resource + Logto issuer + three fixed scopes
Unauthenticated /mcp: HTTP 401 with resource_metadata challenge
```

The later roadmap-only merge did not alter the deployed runtime used for this POC evidence.

## Real ChatGPT Developer Mode evidence

Observed ChatGPT connection facts:

```text
MCP URL: https://grist-chatgpt.loeildumaitre.fr/mcp
Authentication: OAuth
Client registration: CIMD
Observed ChatGPT client metadata URL: https://chatgpt.com/oauth/client.json
Observed callback: https://chatgpt.com/connector_platform_oauth_redirect
```

ChatGPT's OAuth-advanced UI successfully discovered:

- Logto authorization and token endpoints;
- canonical MCP `resource`;
- CIMD registration mode;
- OIDC configuration and UserInfo endpoint;
- fixed MCP scopes `doc:read`, `doc:write`, `doc.schema:write`.

### Initial scope incompatibility and correction

The first live authorization attempt failed before login with:

```text
invalid_scope
scope=email
```

A direct sanitized `/oidc/auth` diagnostic reproduced the failure. The cause was that Logto advertised OIDC `email` but the Dynamic app had not yet granted the corresponding user permission.

After enabling the minimum required Dynamic app user permissions (`email`, with `profile` also enabled for the advertised OIDC profile path), the same authorization request redirected to Logto sign-in instead of returning `invalid_scope`.

No bridge code, public scope, or resource policy was weakened to fix this.

### End-to-end ChatGPT authorization

| Requirement | Status | Evidence |
| --- | --- | --- |
| ChatGPT discovers protected MCP resource | PASS | plugin creation UI populated OAuth/resource metadata |
| ChatGPT selects/uses CIMD successfully | PASS | `https://chatgpt.com/oauth/client.json` accepted |
| ChatGPT reaches Logto authorization | PASS | live login flow started |
| Logto -> ProConnect -> Logto completes | PASS | user completed authentication |
| ChatGPT callback/code exchange completes | PASS | plugin becomes connected |
| ChatGPT bearer reaches `/mcp` successfully | PASS | real MCP tools execute |
| Dynamic Principal/context constructed for ChatGPT request | PASS | existing OAuth path required for successful tools |
| OAuth bearer remains outside Grist credential boundary | PASS | architecture/runtime seam already proved and unchanged |

### Real Grist operations through ChatGPT

Read-only functional proof:

- `list_documents` returned the actual visible Grist documents;
- `inspect_document` returned table/column/relationship/page/widget structure without reading user rows.

Bounded additive write proof:

- ChatGPT checked that a synthetic row was absent;
- `create_records` created exactly one row in `MCP_Test`;
- the row was re-read by ID and exact values matched;
- ChatGPT did not request an extra destructive confirmation for the additive create.

Bounded destructive proof:

- ChatGPT verified the exact target row and values first;
- `delete_records` triggered an explicit user authorization prompt;
- after approval, exactly that row was deleted;
- a targeted re-read confirmed the ID no longer existed;
- no other row was modified or deleted.

The user then selected ChatGPT's “always allow” option for this destructive operation class, so later absence of a repeated confirmation is not useful annotation evidence by itself.

## Session persistence and revocation lifecycle

### Persistence before revocation

After a page reload / fresh conversation, ChatGPT could call Grist Community again without a new ProConnect login.

Status:

```text
Reconnect/session persistence without unnecessary full reauthentication: PASS
```

This alone does not prove a refresh token was used because the original access token might still have been valid.

### ChatGPT-side disconnect

After disconnecting the plugin in ChatGPT, a new conversation no longer had the `Grist Community` connector available and correctly refused to invent document access.

Status:

```text
ChatGPT-side disconnect removes connector availability: PASS
```

### Logto grant removal + access-token expiry

The user then reconnected ChatGPT, verified access, removed the ChatGPT dynamic third-party grant in Logto, and left ChatGPT itself connected.

Configured API-resource access-token lifetime:

```text
3600 seconds
```

Immediately after grant removal, ChatGPT could still access the MCP. This is expected for a self-contained JWT that has not yet expired and is validated locally by the bridge.

After more than 3600 seconds, a new ChatGPT request no longer reached the connector. ChatGPT displayed a reconnect prompt stating that the Grist Community connection had expired and must be renewed.

Status:

```text
Removed Logto grant silently renews after access-token expiry: no
Post-expiry reconnect required: yes
Logout/revocation stops subsequent MCP access after issued-token expiry: PASS
```

This proves the relevant POC lifecycle semantics: revocation does not retroactively invalidate an already-issued locally validated JWT, but it prevents silent continuation once that token expires.

## C4-P0 conclusion

**C4-P0 is DONE.**

The mandatory interoperability path is now demonstrated end to end with the real ChatGPT client:

```text
ChatGPT Developer Mode
-> RFC 9728 protected MCP discovery
-> CIMD
-> Logto OAuth/OIDC
-> ProConnect
-> Logto callback/token issuance
-> ChatGPT bearer
-> /mcp
-> dynamic Principal/context
-> bounded Grist reads/writes
-> session persistence
-> disconnect/revocation lifecycle
```

The bridge still uses `StaticApiKeyCredentialProvider` for the upstream Grist credential in this personal pilot. Therefore this evidence validates ChatGPT <-> bridge OAuth, not production per-user Grist credential isolation. C5 remains mandatory before a second real user/reviewer is treated as isolated.

C4 may now start as productionization of the proven OAuth design. P1/P2/P3 product work may continue independently under the roadmap's parallelism rules.
