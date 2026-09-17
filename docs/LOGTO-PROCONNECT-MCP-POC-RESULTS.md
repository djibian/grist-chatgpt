# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Architecture:** Logto OSS self-hosted as MCP-facing authorization server; ProConnect as upstream OIDC identity source; `grist-chatgpt` as provider-neutral OAuth resource server.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens, ID tokens, or Grist API keys in this file.

Status vocabulary:

- **PASS** — demonstrated with reproducible evidence;
- **FAIL** — demonstrated incompatible or incorrect;
- **UNKNOWN** — not yet demonstrated; absence of evidence is not promoted to PASS.

## Repository verification baseline

The first complete repository-side harness passed CI run **#157** on exact head:

```text
c28aa33c9a87611f60c8fb79599349e2f4ba8e8c
```

That run passed `npm ci`, production dependency audit, TypeScript check, the full test suite, and build. Later documentation-only evidence updates must pass their own exact-head CI before integration.

## Reproducible environment

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact Logto version pinned | PASS | `infra/poc/logto/docker-compose.yml` pins `ghcr.io/logto-io/logto:1.43.0` |
| PostgreSQL version pinned | PASS | POC compose pins PostgreSQL `16.15-alpine` |
| PostgreSQL persistence | PASS | named `logto-postgres` volume in POC compose |
| Secrets excluded from committed configuration | PASS | committed `.env.example` contains placeholders only; `infra/poc/logto/.gitignore` excludes the real `.env` |
| Core/Admin/Postgres bound to loopback | PASS | POC compose publishes only `127.0.0.1` ports |
| Public HTTPS reverse proxy works | UNKNOWN | requires live deployment |
| Admin Console protected by infrastructure control | UNKNOWN | requires live deployment/network configuration |
| Logto process starts and survives restart with persistent state | UNKNOWN | requires live deployment |

## ProConnect identity federation

For OSS, the selected upstream path is Logto's generic **social OIDC connector**, not the commercial Enterprise SSO feature.

| Requirement | Status | Evidence |
| --- | --- | --- |
| ProConnect integration issuer/discovery accepted by Logto | UNKNOWN | requires registered integration client and live Logto instance |
| Authorization Code login Logto -> ProConnect -> Logto | UNKNOWN | requires live flow |
| Same ProConnect user maps to stable Logto subject across repeated login | UNKNOWN | requires two sanitized live login observations |
| Logout/re-login does not create unintended bridge identity | UNKNOWN | requires live flow |

## MCP-facing authorization-server behavior

Canonical POC resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Required scopes remain:

```text
doc:read
doc:write
doc.schema:write
```

| Requirement | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints/JWKS contract | UNKNOWN | `npm run probe:logto -- metadata --issuer ...` prepared and tested; live endpoint required |
| PKCE `S256` advertised | UNKNOWN | evaluator/probe tested; live discovery required |
| Authorization Code response/grant support | UNKNOWN | evaluator/probe tested; live discovery/flow required |
| RFC 8707 `resource` accepted on authorization request | UNKNOWN | requires live OAuth request |
| RFC 8707 `resource` accepted on token request | UNKNOWN | requires live OAuth exchange |
| Access token bound to canonical MCP audience/resource | UNKNOWN | requires cryptographically validated live token claims |
| Wrong-resource token rejected | UNKNOWN | requires live resource-server validation |
| Bridge scopes represented and recoverable | UNKNOWN | requires Logto resource/scope configuration + live token |
| Refresh/offline connectivity suitable for ChatGPT | UNKNOWN | requires live ChatGPT flow |
| CIMD/dynamic-app compatibility | UNKNOWN | interoperability bonus; not initial ChatGPT blocker |

## Provider-neutral bridge seam

| Requirement | Status | Evidence |
| --- | --- | --- |
| OAuth scope maps only to existing Grist capabilities | PASS | `test/oauth-principal.test.ts`, CI #157 |
| Unknown OAuth scopes cannot expand bridge authority | PASS | unknown scopes are filtered out by `GRIST_CAPABILITIES`; CI #157 |
| Stable opaque principal ID derives from verified issuer + subject | PASS | `oauthPrincipalId()` tests, CI #157 |
| Raw upstream subject need not enter normal audit principal ID | PASS | opaque SHA-256-derived principal ID test, CI #157 |
| Discovery evaluator fails on wrong issuer / insecure endpoint / missing S256 | PASS | `test/logto-mcp-compat.test.ts`, CI #157 |
| Omitted metadata remains UNKNOWN rather than invented as PASS | PASS | grant-type omission test, CI #157 |
| Cryptographic JWT signature/JWKS validation | UNKNOWN | deliberately not implemented with ad-hoc crypto; live C4-P0 must use a maintained JOSE implementation |
| Wrong issuer / expired token rejected cryptographically | UNKNOWN | requires JWT validation slice/live fixture |
| Dynamic OAuth principal enters `GristContextFactory` | UNKNOWN | principal mapping seam exists; request-path integration remains to prove |
| User A cannot reuse user B Grist context/cache | PASS | inherited from integrated C3 cross-user isolation tests; OAuth request-path coupling still requires a POC test |
| OAuth bearer is never forwarded to Grist | UNKNOWN | must be demonstrated when request-path OAuth integration exists |
| Static bearer cannot override OAuth principal in production OAuth mode | UNKNOWN | full request-path mode switch not implemented in this POC slice yet |

## ChatGPT draft-app evidence

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact ChatGPT callback URI registered | UNKNOWN | requires draft MCP app |
| Pre-registered OAuth client completes login | UNKNOWN | requires draft MCP app + Logto live instance |
| End-to-end PKCE succeeds | UNKNOWN | requires live flow |
| ChatGPT sends/uses canonical MCP resource | UNKNOWN | requires live flow |
| Subsequent MCP calls use the resulting bearer | UNKNOWN | requires live bridge OAuth request path |
| Refresh avoids unnecessary reauthentication | UNKNOWN | requires expiry/refresh observation |
| Logout/revocation behavior understood | UNKNOWN | requires live flow |

## Current conclusion

The repository-side POC harness passes the existing integration gate without weakening any authentication or authorization invariant. The selected architecture is **not yet declared compatible**: live Logto, ProConnect integration, resource/audience binding, cryptographic token validation, and ChatGPT interoperability remain mandatory UNKNOWNs.

Do not advance full C4 to production-oriented implementation until all mandatory exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.
