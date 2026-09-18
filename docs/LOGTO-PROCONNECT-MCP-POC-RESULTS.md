# Logto / ProConnect / MCP POC results

**POC baseline:** 2026-09-17  
**Architecture:** Logto OSS self-hosted as MCP-facing authorization server; ProConnect as upstream OIDC identity source; `grist-chatgpt` as provider-neutral OAuth resource server.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens, ID tokens, Grist API keys, database passwords, admin passwords, raw provider subjects, or other credentials in this file.

Status vocabulary:

- **PASS** — demonstrated with reproducible evidence;
- **FAIL** — demonstrated incompatible or incorrect for the tested state;
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

The generic Logto OIDC connector is created and enabled in Social sign-in. Visible POC settings are:

```text
Button label: ProConnect
IdP name: proconnect
Sync profile information: Only sync at sign-up
Store tokens for persistent API access: OFF
Require users to provide missing sign-up identifier: OFF
Automatically link accounts with the same identifier: OFF
Accept String-typed Boolean Claims: OFF
Trust Unverified Email: OFF
```

### Live federation attempts

The first real sign-in reached ProConnect, completed required re-authentication/MFA, returned to the exact Logto callback, and progressed through authorization-code exchange to ID-token processing. It then failed in Logto with:

```text
TypeError: Invalid URL
at parseUserInfoFromIdToken (.../connector-oidc/lib/index.js)
```

Inspection of Logto `v1.43.0` localized the failure to:

```text
createRemoteJWKSet(new URL(config.idTokenVerificationConfig.jwksUri))
```

The ProConnect Internet/integration discovery document was then read. Public verification metadata was configured in Logto using the exact discovery values:

```text
issuer   = https://fca.integ01.dev-agentconnect.fr/api/v2
jwks_uri = https://fca.integ01.dev-agentconnect.fr/api/v2/jwks
```

A repeated Live preview sign-in then completed successfully and Logto displayed its successful-login page with a Logto user identifier. The raw identifier is intentionally not recorded. ProConnect reused the already-authenticated upstream session, so no second credential/MFA prompt was required for this successful repeat; this does not weaken the successful OIDC round-trip evidence.

A second completed Logto Live preview authorization flow was then started with the same ProConnect identity. It completed successfully, displayed the **same Logto user identifier** as the first successful flow, and the Logto Admin Console showed that **no additional user account was created**. The raw identifier is intentionally not recorded.

This demonstrates both successful upstream ProConnect ID-token verification and stable mapping of the same ProConnect identity to the same Logto user across repeated completed login flows.

| Requirement | Status | Evidence |
| --- | --- | --- |
| ProConnect integration client registered | PASS | non-production application created with exact Logto callback URI |
| Logto generic OIDC connector created | PASS | connector saved with ProConnect integration values handled locally |
| ProConnect connector enabled in Logto sign-in experience | PASS | `ProConnect` visible in Social sign-in |
| Missing-identifier prompt disabled for POC | PASS | operator disabled the option |
| Automatic identifier-based account linking disabled | PASS | option remains disabled |
| Logto -> ProConnect authorization redirect | PASS | real browser flow reached ProConnect integration |
| ProConnect authentication and return to Logto callback | PASS | real authentication completed and exact callback was reached |
| Authorization-code exchange reaches ID-token processing | PASS | Logto entered ID-token processing after callback |
| ProConnect discovery issuer/JWKS configured for ID-token verification | PASS | exact public discovery `issuer` and `jwks_uri` configured in connector |
| ProConnect ID-token verification through remote JWKS/issuer | PASS | flow completed after JWKS/issuer correction and reached successful Logto sign-in |
| Complete Authorization Code login Logto -> ProConnect -> Logto | PASS | Logto Live preview reported successful sign-in and displayed a Logto user ID |
| Same ProConnect user maps to stable Logto identity across repeated successful login | PASS | second completed flow returned the same Logto user ID and created no additional Logto user |
| Explicit upstream logout/re-login semantics | UNKNOWN | repeated authorization flow is proven; explicit ProConnect logout/re-auth lifecycle has not yet been isolated |

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

A bounded global **User** role named `grist-chatgpt-poc` has now been created with exactly those three already-approved MCP permissions and assigned only to the existing ProConnect-backed POC user. This prepares the test identity for resource-token issuance without broadening the public scope vocabulary or granting the role by default.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints/JWKS contract | PASS | public live discovery plus repository probe |
| PKCE `S256` advertised | PASS | live discovery/probe |
| Authorization Code response/grant support | PASS | live discovery/probe |
| Refresh-token grant advertised | PASS | live discovery |
| MCP API resource configured in Logto | PASS | canonical identifier present |
| Required bridge permissions configured | PASS | exactly `doc:read`, `doc:write`, `doc.schema:write` present |
| MCP API resource is not Default API | PASS | operator visually confirmed `Default API = OFF` |
| Bounded POC user role configured | PASS | `grist-chatgpt-poc` User role contains exactly the three MCP permissions and is assigned only to the ProConnect-backed POC user |
| RFC 8707 `resource` accepted on authorization request | UNKNOWN | requires live OAuth request for the canonical MCP resource |
| RFC 8707 `resource` accepted on token request | UNKNOWN | requires live OAuth exchange |
| Access token bound to canonical MCP audience/resource | UNKNOWN | requires live token validation |
| Bridge scopes represented in a live access token | UNKNOWN | requires live token issuance |
| Refresh/offline behavior suitable for ChatGPT | UNKNOWN | requires live ChatGPT flow |

## Provider-neutral bridge seam

Repository CI demonstrates bounded OAuth scope mapping, opaque principal derivation, issuer/audience/expiry policy checks after verification, malformed bearer rejection, verifier-before-context ordering, and Principal-only context construction. Cross-user Grist context/cache isolation is inherited from integrated C3 tests.

The ProConnect JWKS PASS above proves **upstream ProConnect ID-token verification inside Logto**. It is separate from the still-UNKNOWN requirement that `grist-chatgpt` validate actual Logto-issued access tokens using standard JWT/JWKS verification.

Still UNKNOWN live:

- standard cryptographic JWT/JWKS validation of actual Logto-issued access tokens by the bridge;
- actual Express `/mcp` constructing a fresh OAuth principal/context;
- wrong-resource and insufficient-scope rejection on the live MCP request path;
- proof that the OAuth bearer never becomes an upstream Grist credential;
- production OAuth mode preventing static-bearer override.

## ChatGPT draft-app evidence

All ChatGPT-specific live checks remain UNKNOWN: callback registration, OAuth login, end-to-end PKCE/resource behavior, bearer use, refresh and revocation behavior.

## Current conclusion

The live C4-P0 deployment now demonstrates a complete non-production **Logto -> ProConnect -> Logto Authorization Code federation login with stable identity mapping across repeated completed flows**. The initial JWKS configuration defect is resolved, and a second completed flow reuses the same Logto user without creating a duplicate account.

Phase 2 identity federation is therefore substantially proven. A bounded POC User role containing exactly the three fixed MCP permissions is also assigned to the existing ProConnect-backed test user. The next blocking proof on the critical path is Phase 3: create a dedicated non-production OAuth test client and exercise Logto as the MCP-facing authorization server with the canonical resource URI, explicit RFC 8707 `resource`, PKCE, the three fixed bridge scopes, and an access token demonstrably bound to that resource.

Mandatory UNKNOWNs still include RFC 8707 live handling, audience/resource-bound tokens, bridge-side JWT/JWKS validation of Logto access tokens, actual OAuth `/mcp` wiring, live scope enforcement, and ChatGPT interoperability/refresh.

Do not advance full C4 to production-oriented implementation until all mandatory exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.
