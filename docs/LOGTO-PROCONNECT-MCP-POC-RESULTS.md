# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Architecture:** Logto OSS self-hosted as MCP-facing authorization server; ProConnect as upstream OIDC identity source; `grist-chatgpt` as provider-neutral OAuth resource server.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens, ID tokens, Grist API keys, database passwords, admin passwords, or other credentials in this file.

Status vocabulary:

- **PASS** — demonstrated with reproducible evidence;
- **FAIL** — demonstrated incompatible or incorrect;
- **UNKNOWN** — not yet demonstrated; absence of evidence is not promoted to PASS.

## Repository verification baseline

Three exact code-bearing heads passed the full integration gate:

```text
CI #157  c28aa33c9a87611f60c8fb79599349e2f4ba8e8c
CI #160  f77edf8235d992d4757defee4d2d276ca8a0da89
CI #163  76092750207f823cf41d8bcff63edcd7e2067e0b
```

These runs passed `npm ci`, production dependency audit, TypeScript check, the full test suite, and build. CI #160 covers provider-neutral issuer/audience/expiry enforcement; CI #163 additionally covers the OAuth bearer -> verifier -> Principal -> context-factory boundary. Later evidence-only updates must pass their own exact-head CI before integration.

The live deployment evidence below was gathered against repository `main` baseline:

```text
5839203da1cd8b4efcbe37f9b19303da50120fab
```

## Reproducible environment

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact Logto version pinned | PASS | `infra/poc/logto/docker-compose.yml` pins `ghcr.io/logto-io/logto:1.43.0` |
| PostgreSQL version pinned | PASS | POC compose pins PostgreSQL `16.15-alpine` |
| PostgreSQL persistence | PASS | named `logto-postgres` volume in POC compose |
| Secrets excluded from committed configuration | PASS | committed `.env.example` contains placeholders only; `infra/poc/logto/.gitignore` excludes the real `.env` |
| Core/Admin/Postgres bound to loopback | PASS | POC compose publishes only `127.0.0.1` ports |
| Public HTTPS reverse proxy works | PASS | `https://auth-poc.loeildumaitre.fr` served through Caddy with a successfully obtained public certificate; HTTP redirects to HTTPS and HTTPS requests reach Logto |
| Admin Console protected by infrastructure control | PASS | admin endpoint is fronted by a dedicated Caddy host with an IP allowlist; authorized client reached the Logto Admin Console while non-allowlisted requests are configured to receive `403` |
| Logto starts against persistent PostgreSQL | PASS | Logto seeded the database, then started normally; PostgreSQL reported healthy and Logto remained running with restart count `0` during observation |
| Logto process survives an actual service/host restart with persistent state | UNKNOWN | no deliberate restart/reboot persistence test has been completed yet |
| First Logto admin account can be created | PASS | initial signup succeeded after Docker outbound connectivity was repaired; no credential values were recorded |
| POC sizing on current host is viable | PASS | stabilized observation on the 2-vCPU / ~3.7 GiB RAM host showed about 217 MiB for Logto and 37 MiB for PostgreSQL with about 2.9 GiB system memory available |

## Live network / firewall evidence

The first admin signup initially failed with a Logto `500`. Sanitized Logto diagnostics showed:

```text
PasswordPolicyChecker.hasBeenPwned()
fetch failed
ETIMEDOUT
POST /api/experience/profile 500
```

The failure was not specific to Have I Been Pwned. The host could reach `example.com`, GitHub and `api.pwnedpasswords.com`, while the Logto container timed out to all three. Docker DNS resolution worked.

Root cause: the host `inet filter` base `forward` chain had `policy drop` with no Docker forwarding exception. Docker's own `DOCKER-FORWARD` chain accepted packets, but the later base-chain drop prevented them from reaching NAT `POSTROUTING`; the Docker MASQUERADE counter stayed at zero.

A minimal live rule set was added for the active Docker bridge: outbound traffic from the bridge is accepted, and only `established,related` return traffic is accepted toward the bridge. After that change:

```text
https://example.com                         HTTP 200
https://github.com                          HTTP 200
https://api.pwnedpasswords.com/range/...   HTTP 200
```

The Docker `172.18.0.0/16` MASQUERADE counter became non-zero, proving the full container -> forwarding -> NAT -> Internet path.

Persistent `/etc/nftables.conf` preparation now uses generic Docker bridge matching rather than the ephemeral bridge name:

```nft
chain forward {
    type filter hook forward priority 0;
    policy drop;

    iifname "docker0" accept
    iifname "br-*" accept

    oifname "docker0" ct state established,related accept
    oifname "br-*" ct state established,related accept
}
```

The persistent ruleset passed `nft -c -f /etc/nftables.conf`. Systemd ordering was inspected: `nftables.service` is enabled for `sysinit.target`, runs before `network-pre.target`, and Docker starts later under `multi-user.target`. The current boot predated nftables activation, so a real reboot remains necessary before claiming reboot persistence.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Docker container outbound HTTPS | PASS | Logto container returned HTTP 200 from multiple independent HTTPS targets after the forwarding fix |
| HIBP breach check connectivity | PASS | `api.pwnedpasswords.com` returned HTTP 200 from inside the Logto container; admin signup then succeeded without disabling the check |
| Persistent nftables configuration parses | PASS | `nft -c -f /etc/nftables.conf` completed without error |
| Boot ordering is compatible with Docker rule creation | PASS | `nftables.service` is ordered before `network-pre.target`; Docker starts later, so Docker can recreate its chains after the nftables `flush ruleset` at boot |
| Full reboot preserves working nftables + Docker + Logto state | UNKNOWN | requires a controlled reboot and post-boot verification |

The Logto `--dapc` / `--disable-admin-pwned-password-check` escape hatch was deliberately **not** used because the underlying Docker egress problem would also have prevented future ProConnect OIDC traffic.

## ProConnect identity federation

For OSS, the selected upstream path is Logto's generic **social OIDC connector**, not the commercial Enterprise SSO feature.

| Requirement | Status | Evidence |
| --- | --- | --- |
| ProConnect integration issuer/discovery accepted by Logto | UNKNOWN | requires registered integration client and live Logto connector configuration |
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

Live discovery returned:

```text
issuer: https://auth-poc.loeildumaitre.fr/oidc
authorization_endpoint: https://auth-poc.loeildumaitre.fr/oidc/auth
token_endpoint: https://auth-poc.loeildumaitre.fr/oidc/token
jwks_uri: https://auth-poc.loeildumaitre.fr/oidc/jwks
code_challenge_methods_supported: ['S256']
```

The repository probe was then executed against the public endpoint:

```bash
npm run probe:logto -- metadata \
  --issuer "https://auth-poc.loeildumaitre.fr/oidc"
```

It returned PASS for exact issuer matching, HTTPS authorization endpoint, HTTPS token endpoint, HTTPS JWKS endpoint, PKCE `S256`, Authorization Code response support and Authorization Code grant support.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints/JWKS contract | PASS | public live discovery plus repository `metadata` probe |
| PKCE `S256` advertised | PASS | live discovery and repository probe both report `S256` |
| Authorization Code response/grant support | PASS | live discovery/probe advertise `code` response and `authorization_code` grant |
| Refresh-token grant advertised | PASS | live discovery advertises `refresh_token`; actual refresh behavior remains a later live-flow check |
| RFC 8707 `resource` accepted on authorization request | UNKNOWN | requires live OAuth request |
| RFC 8707 `resource` accepted on token request | UNKNOWN | requires live OAuth exchange |
| Access token bound to canonical MCP audience/resource | UNKNOWN | requires cryptographically validated live token claims |
| Wrong-resource token rejected on live MCP request path | UNKNOWN | claims-level policy is tested, but live JWT validation/request-path rejection is still required |
| Bridge scopes represented and recoverable | UNKNOWN | Logto API resource/scopes still need to be created and exercised in a live token |
| Refresh/offline connectivity suitable for ChatGPT | UNKNOWN | support is advertised, but actual refresh behavior requires live ChatGPT flow |
| CIMD/dynamic-app compatibility | UNKNOWN | interoperability bonus; not initial ChatGPT blocker |

## Provider-neutral bridge seam

| Requirement | Status | Evidence |
| --- | --- | --- |
| OAuth scope maps only to existing Grist capabilities | PASS | `test/oauth-principal.test.ts`, CI #157/#160/#163 |
| Unknown OAuth scopes cannot expand bridge authority | PASS | unknown scopes are filtered out by `GRIST_CAPABILITIES`; CI #157/#160/#163 |
| Stable opaque principal ID derives from verified issuer + subject | PASS | `oauthPrincipalId()` tests, CI #157/#160/#163 |
| Raw upstream subject need not enter normal audit principal ID | PASS | opaque SHA-256-derived principal ID test, CI #157/#160/#163 |
| Discovery evaluator fails on wrong issuer / insecure endpoint / missing S256 | PASS | `test/logto-mcp-compat.test.ts`, CI #157/#160/#163 |
| Omitted metadata remains UNKNOWN rather than invented as PASS | PASS | grant-type omission test, CI #157/#160/#163 |
| Wrong issuer rejected after cryptographic verification | PASS | `test/oauth-access-token.test.ts`, CI #160/#163 |
| Wrong MCP audience/resource rejected after cryptographic verification | PASS | `test/oauth-access-token.test.ts`, CI #160/#163 |
| Expired/invalid expiry rejected after cryptographic verification | PASS | `test/oauth-access-token.test.ts`, CI #160/#163 |
| Principal is created only after issuer/audience/expiry checks pass | PASS | `createPrincipalFromVerifiedAccessToken()`, CI #160/#163 |
| Missing/malformed bearer rejected before verifier invocation | PASS | `test/oauth-request-context.test.ts`, CI #163 |
| Raw bearer is passed only to verifier, not to Principal/context factory | PASS | `test/oauth-request-context.test.ts`, CI #163 |
| Failed token verification prevents context creation | PASS | `test/oauth-request-context.test.ts`, CI #163 |
| Provider-neutral context boundary receives only the bounded Principal | PASS | `createOAuthMcpRequestContext()`, CI #163 |
| Cryptographic JWT signature/JWKS validation | UNKNOWN | deliberately not implemented with ad-hoc crypto; live C4-P0 must use a maintained JOSE implementation |
| Actual Express `/mcp` path constructs a fresh OAuth principal/context | UNKNOWN | current production route still uses static development bearer; live POC wiring remains to prove |
| User A cannot reuse user B Grist context/cache | PASS | inherited from integrated C3 cross-user isolation tests; OAuth request-path coupling still requires a live/integration test |
| OAuth bearer is never used as an upstream Grist credential | UNKNOWN | boundary design prevents token propagation to context factory, but actual OAuth `/mcp` wiring must still demonstrate this end to end |
| Static bearer cannot override OAuth principal in production OAuth mode | UNKNOWN | production OAuth mode is not implemented in this POC slice yet |

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

The live C4-P0 deployment has now demonstrated the non-production Logto/PostgreSQL runtime, public HTTPS, protected admin access, working outbound container connectivity, successful first-admin creation, live OIDC discovery, PKCE `S256`, and Authorization Code metadata behavior. The repository-side provider-neutral seams remain demonstrated by CI.

The architecture is **not yet declared compatible**. Mandatory UNKNOWNs remain for ProConnect federation, RFC 8707 live request/token handling, audience/resource-bound live tokens, cryptographic JWT/JWKS validation, actual `/mcp` OAuth wiring, scope enforcement on live requests, and ChatGPT interoperability/refresh.

Do not advance full C4 to production-oriented implementation until all mandatory exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.
