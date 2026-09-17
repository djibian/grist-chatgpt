# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Architecture:** Logto OSS self-hosted as MCP-facing authorization server; ProConnect as upstream OIDC identity source; `grist-chatgpt` as provider-neutral OAuth resource server.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens, ID tokens, Grist API keys, database passwords, admin passwords, or other credentials in this file.

Status vocabulary:

- **PASS** — demonstrated with reproducible evidence;
- **FAIL** — demonstrated incompatible or incorrect;
- **UNKNOWN** — not yet demonstrated; absence of evidence is not promoted to PASS.

## Repository verification baseline

Repository-side OAuth/provider-neutral seams are covered by CI on the integrated C4-P0 harness. Evidence-only updates must pass their own exact-head CI before integration.

Initial live deployment evidence started from repository baseline:

```text
5839203da1cd8b4efcbe37f9b19303da50120fab
```

## Reproducible environment

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact Logto version pinned | PASS | `infra/poc/logto/docker-compose.yml` pins `ghcr.io/logto-io/logto:1.43.0` |
| PostgreSQL version pinned | PASS | POC compose pins PostgreSQL `16.15-alpine` |
| PostgreSQL persistence | PASS | named `logto-postgres` volume in POC compose |
| Secrets excluded from committed configuration | PASS | real `.env` excluded; committed example contains placeholders only |
| Core/Admin/Postgres bound to loopback | PASS | services publish only loopback ports |
| Public HTTPS reverse proxy works | PASS | `https://auth-poc.loeildumaitre.fr` served through Caddy with a public certificate |
| Admin Console protected by infrastructure control | PASS | dedicated admin host with IP allowlist |
| Logto starts against persistent PostgreSQL | PASS | PostgreSQL healthy; Logto stable during observation |
| First Logto admin account can be created | PASS | signup completed after Docker outbound connectivity repair |
| POC sizing on current host is viable | PASS | observed headroom on the current 2-vCPU / ~3.7 GiB RAM host |
| Full reboot preserves working nftables + Docker + Logto state | UNKNOWN | controlled reboot not yet performed |

## Live network / firewall evidence

Initial admin signup failed because the Logto container could resolve DNS but could not establish outbound HTTPS connections. Sanitized diagnostics included:

```text
PasswordPolicyChecker.hasBeenPwned()
fetch failed
ETIMEDOUT
```

Root cause was the host `inet filter` `forward` base chain with `policy drop` and no Docker forwarding exception. After adding the minimum bridge forwarding rules, HTTPS requests from the Logto container to independent public targets, including HIBP, returned HTTP 200 and the Docker MASQUERADE counter became non-zero.

Persistent `/etc/nftables.conf` was prepared with generic Docker bridge matching and passed `nft -c -f /etc/nftables.conf`. Systemd ordering is compatible with boot: nftables runs before `network-pre.target`; Docker starts later and can recreate its own chains after the nftables `flush ruleset`.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Docker container outbound HTTPS | PASS | multiple public HTTPS targets returned HTTP 200 from inside Logto |
| HIBP breach check connectivity | PASS | HIBP returned HTTP 200 and admin signup succeeded without disabling the check |
| Persistent nftables configuration parses | PASS | `nft -c -f /etc/nftables.conf` completed without error |
| Boot ordering compatible with Docker rule creation | PASS | systemd ordering inspected |
| Full reboot persistence | UNKNOWN | requires a controlled reboot |

## ProConnect identity federation

For OSS, the selected upstream path is Logto's generic **social OIDC connector**, not Enterprise SSO.

A non-production **Internet / integration** ProConnect Fournisseur de Service application named `Logto` has been created in the Espace Partenaires. Its registered redirect URI is the exact callback URI displayed by the Logto OIDC connector. No client ID, secret, token, code, cookie, or credential value is recorded here.

The generic Logto OIDC connector has now been created successfully with the ProConnect integration values entered locally. The visible social sign-in configuration is:

```text
Button label: ProConnect
IdP name: proconnect
Sync profile information: Only sync at sign-up
Store tokens for persistent API access: OFF
Require users to provide missing sign-up identifier: OFF
Automatically link accounts with the same identifier: OFF
```

The ProConnect connector is present in Logto's **Social sign-in** experience. This proves that Logto accepted the connector configuration syntactically and stored it. It does **not** yet prove a successful upstream OIDC login.

| Requirement | Status | Evidence |
| --- | --- | --- |
| ProConnect integration client registered | PASS | operator created the non-production application and registered exact Logto callback URI |
| Logto generic OIDC connector created | PASS | connector saved successfully with ProConnect integration values entered locally |
| ProConnect connector enabled in Logto sign-in experience | PASS | `ProConnect` appears in Social sign-in configuration |
| Missing-identifier prompt disabled for POC | PASS | operator disabled `Require users to provide missing sign-up identifier` |
| Automatic identifier-based account linking disabled | PASS | operator left automatic linking disabled |
| ProConnect issuer/discovery accepted during a live login | UNKNOWN | requires first complete login flow |
| Authorization Code login Logto -> ProConnect -> Logto | UNKNOWN | requires live flow |
| Same ProConnect user maps to stable Logto identity across repeated login | UNKNOWN | requires two sanitized login observations |
| Logout/re-login does not create unintended bridge identity | UNKNOWN | requires live flow |

## MCP-facing authorization-server behavior

Canonical POC resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Required scopes:

```text
doc:read
doc:write
doc.schema:write
```

Live Logto discovery and the repository metadata probe have demonstrated exact issuer matching, HTTPS authorization/token/JWKS endpoints, PKCE `S256`, Authorization Code response/grant support, and advertised refresh-token grant support.

The Logto Admin Console contains the canonical MCP API resource with exactly the three required permissions, and the operator visually confirmed `Default API = OFF`.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints/JWKS contract | PASS | public live discovery plus repository probe |
| PKCE `S256` advertised | PASS | live discovery/probe |
| Authorization Code response/grant support | PASS | live discovery/probe |
| Refresh-token grant advertised | PASS | live discovery |
| MCP API resource configured in Logto | PASS | canonical identifier present |
| Required bridge permissions configured | PASS | exactly `doc:read`, `doc:write`, `doc.schema:write` present |
| MCP API resource is not Default API | PASS | operator visually confirmed `Default API = OFF` |
| RFC 8707 `resource` accepted on authorization request | UNKNOWN | requires live OAuth request |
| RFC 8707 `resource` accepted on token request | UNKNOWN | requires live OAuth exchange |
| Access token bound to canonical MCP audience/resource | UNKNOWN | requires live token validation |
| Bridge scopes represented in a live access token | UNKNOWN | requires live token issuance |
| Refresh/offline behavior suitable for ChatGPT | UNKNOWN | requires live ChatGPT flow |

## Provider-neutral bridge seam

Repository CI demonstrates bounded OAuth scope mapping, opaque principal derivation, issuer/audience/expiry policy checks after verification, malformed bearer rejection, verifier-before-context ordering, and Principal-only context construction. Cross-user Grist context/cache isolation is inherited from integrated C3 tests.

Still UNKNOWN live:

- standard cryptographic JWT/JWKS validation on actual Logto keys;
- actual Express `/mcp` constructing a fresh OAuth principal/context;
- wrong-resource and insufficient-scope rejection on the live MCP request path;
- proof that the OAuth bearer never becomes an upstream Grist credential;
- production OAuth mode preventing static-bearer override.

## ChatGPT draft-app evidence

All ChatGPT-specific live checks remain UNKNOWN: callback registration, OAuth login, end-to-end PKCE/resource behavior, bearer use, refresh and revocation behavior.

## Current conclusion

The live C4-P0 deployment has demonstrated the Logto/PostgreSQL runtime, HTTPS, protected admin access, Docker egress, first-admin creation, public discovery/PKCE metadata, the canonical non-default MCP resource with fixed permissions, the ProConnect integration client registration, and creation/activation of the Logto generic OIDC connector with conservative social-sign-in settings.

The architecture is **not yet declared compatible**. The next decisive evidence is the first complete Logto -> ProConnect -> Logto login, followed by a second login for stable identity mapping. Mandatory UNKNOWNs then remain for RFC 8707 live handling, audience/resource-bound tokens, JWT/JWKS validation, actual OAuth `/mcp` wiring, live scope enforcement, and ChatGPT interoperability/refresh.

Do not advance full C4 to production-oriented implementation until all mandatory exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.
