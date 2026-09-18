# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Latest live update:** 2026-09-18  
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
| Logto/PostgreSQL loopback exposure | PASS | services are reverse-proxied rather than published directly |
| Public Logto HTTPS | PASS | `https://auth-poc.loeildumaitre.fr` works through Caddy |
| Admin console infrastructure-restricted | PASS | dedicated admin host with infrastructure access control |
| Docker outbound HTTPS / HIBP path | PASS | forwarding repair validated with independent HTTPS targets and successful admin signup |
| Full reboot persistence | UNKNOWN | controlled reboot still not performed |

## ProConnect identity federation

The selected upstream path is Logto's generic social OIDC connector against the ProConnect integration environment.

Public verification metadata used by the connector:

```text
issuer   = https://fca.integ01.dev-agentconnect.fr/api/v2
jwks_uri = https://fca.integ01.dev-agentconnect.fr/api/v2/jwks
```

Sanitized live evidence:

- ProConnect integration client registered with the exact Logto callback;
- Logto social OIDC connector configured and enabled;
- complete Logto -> ProConnect -> Logto Authorization Code login completed;
- the same ProConnect identity completed a second login and mapped to the same Logto user without creating a duplicate account;
- no raw provider subject or Logto user identifier was recorded.

| Requirement | Status |
| --- | --- |
| ProConnect integration client | PASS |
| Logto generic OIDC connector | PASS |
| ProConnect authorization redirect and callback | PASS |
| ProConnect ID-token verification through configured issuer/JWKS | PASS |
| Complete Logto -> ProConnect -> Logto login | PASS |
| Stable identity across repeated successful login | PASS |
| Explicit upstream logout/re-login lifecycle | UNKNOWN |

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

The canonical Logto API resource exists with exactly those three permissions and `Default API = OFF`. A bounded POC user role grants exactly those permissions only to the ProConnect-backed POC user. A dedicated public/native test application was used for the local Authorization Code + PKCE proof.

### Authorization Code + PKCE + RFC 8707 proof

Sanitized diagnostics:

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

`offline_access` plus explicit consent yielded a refresh token in the local public-client flow without exposing it.

| Requirement | Status |
| --- | --- |
| Discovery issuer/endpoints/JWKS | PASS |
| PKCE `S256` | PASS |
| Authorization Code grant | PASS |
| Refresh-token grant advertised | PASS |
| RFC 8707 `resource` on authorization request | PASS |
| RFC 8707 `resource` on token request | PASS |
| Canonical MCP audience/resource binding | PASS |
| Fixed bridge scopes carried by token | PASS |
| Standard JWT/JWKS validation | PASS |
| Local refresh-token issuance | PASS |
| Durable ChatGPT refresh/reconnect | UNKNOWN |

## Provider-neutral bridge and HTTP `/mcp` validation

A real Logto-issued canonical-resource token has passed the integrated verifier, issuer/resource policy, scope mapping, dynamic `Principal`, and C3 context path. The bridge uses standard JWT/JWKS semantics and no proprietary Logto SDK in its core authorization path.

Positive reusable-seam diagnostics:

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

Negative reusable-seam diagnostics:

```text
Wrong-resource token JWT/JWKS verification: PASS
Token audience differs from canonical MCP resource: yes
Bridge wrong-resource rejection: PASS
Principal/context created after wrong-resource rejection: no

Insufficient-scope token JWT/JWKS verification: PASS
Canonical MCP resource audience accepted: PASS
Token/Principal missing doc:write: yes
Reduced-scope dynamic Principal created: PASS
doc:write operation rejected before mutation: PASS
Fake Grist mutation requests observed: 0
```

The actual Express/MCP route has also been exercised with real Logto tokens.

Positive HTTP diagnostics:

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

Wrong-resource HTTP diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Wrong-resource bearer rejected on /mcp: PASS
Wrong-resource request reaches fake Grist: no
```

Missing-`doc:write` HTTP diagnostics:

```text
MCP OAuth server starts without static bearer: PASS
Reduced-scope bearer authenticates on /mcp: PASS
Token missing doc:write: yes
doc:write tool rejected on /mcp: PASS
Fake Grist mutation requests observed: 0
OAuth bearer reaches fake Grist: no
```

Cross-user Grist context/cache isolation remains covered by integrated C3 tests.

## Public non-production deployment readiness

The current integrated bridge was deployed to the public POC endpoint at exact repository SHA:

```text
ec9ee27c602c103a3d18866867faceac41a455b0
```

Deployment evidence:

```text
grist-chatgpt.service: active
Listener: 127.0.0.1:3000 only
Local /healthz: HTTP 200
Public /healthz: HTTP 200
```

The public RFC 9728 document returns the exact canonical resource, Logto issuer, and the three fixed scopes. An unauthenticated MCP request returns HTTP 401 with a `WWW-Authenticate` challenge pointing to that protected-resource metadata.

Logto Dynamic app / CIMD was enabled with only the fixed MCP permissions. Public authorization-server discovery then reported:

```text
CIMD=yes
PKCE_S256=yes
AUTH_CODE=yes
REFRESH_TOKEN=yes
```

The integrated non-destructive readiness probe then produced:

```text
Protected-resource metadata reachable: PASS
Protected-resource resource matches canonical MCP URI: PASS
Authorization server advertised: PASS
Protected-resource metadata advertises fixed bridge scopes: PASS
Authorization metadata issuer matches protected-resource issuer: PASS
Logto CIMD/dynamic-client support advertised: PASS
Public-client token authentication method none advertised: PASS
PKCE S256 advertised: PASS
Authorization Code grant advertised: PASS
Refresh-token grant advertised: PASS
RFC 9207 authorization-response issuer identification advertised: yes
Unauthenticated /mcp challenge advertises resource metadata: PASS
Authenticated tools/list probe: SKIPPED (no OAUTH_ACCESS_TOKEN)
ChatGPT OAuth readiness: PASS
```

Repository-side ChatGPT OAuth signaling is therefore ready: RFC 9728 metadata, HTTP resource challenge, root tool `securitySchemes` plus compatibility mirror, and runtime `_meta["mcp/www_authenticate"]` insufficient-scope challenges are integrated.

## ChatGPT live-client evidence

The remaining mandatory evidence is the real ChatGPT client flow.

| Requirement | Status |
| --- | --- |
| ChatGPT discovers protected MCP resource | UNKNOWN |
| ChatGPT selects/uses CIMD client metadata successfully | UNKNOWN |
| ChatGPT reaches Logto authorization | UNKNOWN |
| Logto -> ProConnect login initiated from ChatGPT completes | UNKNOWN |
| ChatGPT callback/code exchange completes | UNKNOWN |
| ChatGPT access token is bound to canonical MCP resource | UNKNOWN |
| ChatGPT bearer reaches `/mcp` successfully | UNKNOWN |
| Dynamic Principal/context constructed for ChatGPT request | UNKNOWN |
| OAuth bearer remains outside Grist credential boundary | UNKNOWN for ChatGPT-specific request; reusable and HTTP seams already PASS |
| Reconnect/refresh avoids unnecessary full reauthentication | UNKNOWN |
| Logout/revocation stops subsequent MCP access | UNKNOWN |

## Current conclusion

All repository-side, Logto/ProConnect identity, resource-token, provider-neutral JWT/JWKS, positive/negative `/mcp`, public deployment, RFC 9728, scope-signaling, and CIMD readiness checks are PASS.

C4-P0 remains **ACTIVE**, not DONE. The only mandatory critical-path evidence still missing is the real ChatGPT MCP OAuth session, including callback/client behavior, bearer use, reconnect/refresh, and logout/revocation. Full production-oriented C4 remains blocked until that live-client evidence is PASS.

Operational/secondary UNKNOWNs remain the controlled reboot persistence check and an explicitly isolated upstream ProConnect logout/re-authentication lifecycle.
