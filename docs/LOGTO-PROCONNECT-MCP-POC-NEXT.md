# Live POC handoff boundary

This file is the durable handoff for continuing the live C4-P0 Logto / ProConnect / MCP interoperability POC from a fresh controller/chat.

Do not trust remembered GitHub state. At the start of a new execution, resolve exact `main`, read `AGENTS.md`, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` at that SHA, then reconstruct open PRs, exact heads, CI, reviews and dependencies before making a durable transition.

Do not paste ProConnect client secrets, OAuth tokens, authorization codes, cookies, Logto/database/admin credentials, Grist API keys, raw Logto user IDs, or raw provider subjects into GitHub, ChatGPT, issue comments, logs, evidence documents, or model-visible tool inputs.

## Current live checkpoint

Live deployment:

```text
Logto OSS    1.43.0
PostgreSQL   16.15-alpine
Public auth  https://auth-poc.loeildumaitre.fr
Admin auth   https://auth-poc-admin.loeildumaitre.fr
MCP resource https://grist-chatgpt.loeildumaitre.fr/mcp
```

The bridge deployment itself has deliberately not been changed merely to host the Logto POC. Do not update the deployed `/mcp` route until the bounded POC evidence requires that request-path proof.

Current durable PASS evidence includes:

- Logto/PostgreSQL runtime works behind Caddy;
- public HTTPS and OIDC discovery work;
- Admin Console is infrastructure-restricted;
- Docker outbound HTTPS and HIBP work after the nftables forwarding repair;
- first Logto admin account creation succeeds;
- PKCE `S256`, Authorization Code, HTTPS token/JWKS endpoints and refresh-token grant are advertised;
- canonical MCP API resource exists with exactly `doc:read`, `doc:write`, `doc.schema:write`;
- `Default API = OFF` is visually confirmed;
- ProConnect Internet/integration Fournisseur de Service application `Logto` exists with the exact Logto redirect URI;
- the Logto generic social OIDC connector is saved with ProConnect credentials handled locally;
- ProConnect is enabled in Logto Social sign-in;
- missing-identifier prompt, identifier auto-linking and persistent third-party token storage are OFF;
- ProConnect public discovery `issuer` and `jwks_uri` are configured in Logto ID-token verification;
- Logto successfully verifies the ProConnect ID token via remote JWKS/issuer and completes a full Live preview sign-in;
- a second completed flow with the same ProConnect identity returns the same Logto user ID and creates no duplicate Logto user;
- a bounded global **User** role `grist-chatgpt-poc` exists with exactly `doc:read`, `doc:write`, `doc.schema:write` and is assigned only to the existing ProConnect-backed POC user;
- dedicated third-party Native app `grist-chatgpt-poc-pkce` exists using Authorization Code with loopback redirect `http://127.0.0.1:8765/callback`;
- that third-party app is allowed exactly the same three MCP API permissions;
- a real local Authorization Code + PKCE `S256` flow accepts explicit `resource=https://grist-chatgpt.loeildumaitre.fr/mcp`;
- the resulting access token is a JWT bound to the canonical MCP resource;
- all three fixed bridge permissions are present/recoverable in the live token;
- the live token signature verifies against Logto JWKS, with matching issuer and valid expiry;
- `offline_access` plus explicit consent yields a refresh token without exposing its value;
- the integrated provider-neutral bridge verifier validates a freshly issued real Logto resource token against remote JWKS;
- issuer, canonical resource audience and all three fixed scopes pass the existing bridge policy/mapping seams;
- a dynamic opaque `oauth:*` MCP principal is created from the live token;
- the real C3 `GristContextFactory` creates a principal-bound context;
- the Grist credential provider receives only Principal context and does not receive the raw OAuth bearer.

The durable evidence ledger is `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Phase 2 identity result

The initial federation blocker was a missing/invalid `jwksUri` in the generic OIDC connector. It was corrected using exact ProConnect discovery metadata:

```text
issuer   = https://fca.integ01.dev-agentconnect.fr/api/v2
jwks_uri = https://fca.integ01.dev-agentconnect.fr/api/v2/jwks
```

After that correction, complete Logto -> ProConnect -> Logto sign-in succeeds. A second completed authorization flow with the same upstream identity returns the same Logto user identifier, and no additional Logto user account is created. Raw user/provider identifiers are intentionally not recorded.

Stable identity mapping across repeated completed login flows is therefore PASS.

Explicit upstream logout/re-authentication lifecycle behavior remains secondary evidence and may be tested later, but it is no longer the blocking next step.

## Phase 3 authorization-server result

Canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Fixed public scopes/permissions:

```text
doc:read
doc:write
doc.schema:write
```

Configured state:

1. MCP API resource exists in Logto with the exact canonical identifier.
2. Exactly the three fixed permissions above exist on that resource.
3. `Default API = OFF` is confirmed.
4. Global **User** role `grist-chatgpt-poc` contains exactly those three permissions.
5. That role is assigned only to the existing ProConnect-backed POC user and is not a default role.
6. Dedicated third-party **Native app** `grist-chatgpt-poc-pkce` uses Authorization Code.
7. Loopback redirect URI `http://127.0.0.1:8765/callback` is saved.
8. The third-party app permission boundary allows exactly the same three MCP API permissions.

A local public-client flow proved:

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

The refresh-token PASS was obtained with `offline_access` plus explicit consent (`prompt=consent`). This proves Logto can issue refresh tokens for the local public-client flow; it does **not** yet prove ChatGPT reconnect/refresh behavior.

No authorization code, access token, refresh token, ID token, cookie, client secret, PKCE verifier or raw identity value was recorded.

Phase 3 MCP-facing authorization-server behavior is therefore substantially proven independently of ChatGPT.

## Phase 4 positive bridge result

The provider-neutral bridge verifier/probe was integrated on `main` by PR #40. The implementation:

- uses standard JWT/JWKS verification with Node cryptography and no proprietary Logto SDK;
- accepts issuer/JWKS/resource as edge configuration;
- never logs or returns the raw bearer;
- passes only cryptographically verified claims into the existing OAuth policy/principal seams;
- constructs a dynamic opaque MCP `Principal`;
- creates a real principal-bound C3 `GristContextFactory` context;
- uses a synthetic Grist credential sentinel for the POC and performs no upstream Grist request.

A freshly issued real Logto token for the canonical MCP resource was passed locally to the integrated probe. Sanitized evidence:

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

The same run also repeated the full Phase 3 positive diagnostics. No bearer, authorization code, refresh token, PKCE verifier, raw subject or Grist credential was exposed.

This establishes the positive provider-neutral resource-server/C3 boundary with an actual Logto-issued token. It does **not** yet establish the deployed Express `/mcp` OAuth request path, because that route remains deliberately on the current static development bearer until the bounded POC evidence is complete.

## Exact next step: negative authorization evidence

The next blocking evidence is two negative tests, in this order:

1. **Wrong resource/audience** — obtain or construct a validly signed Logto token whose audience/resource is not the canonical MCP resource, then demonstrate that the bridge policy rejects it before Principal/context construction. Do not weaken or change the canonical resource configuration merely to make the test pass.
2. **Insufficient scope** — obtain a valid canonical-resource token carrying only a strict subset of the fixed public scopes, then demonstrate both that the reduced capabilities map correctly and that an operation requiring a missing capability is rejected by the existing authorization layer.

The negative probes must continue to keep all raw token/code/verifier material local. Record only stable diagnostic results and safe error codes. A successful negative test means the unsafe request is **rejected**, not that the token exchange itself necessarily fails.

Before changing Logto application permissions or user role assignments for the insufficient-scope test, prefer a reversible bounded test configuration that does not broaden any permission. Restore the POC client's three-permission state after the test if it is temporarily reduced.

After both negative proofs are durable PASS, the next mandatory phase is the actual OAuth-enabled `/mcp` request-path proof and then the draft ChatGPT MCP app flow/refresh behavior. Do not start full production C4 implementation merely because the local bridge seam passes.

## ProConnect connector configuration boundary

The connector uses the ProConnect Internet/integration environment. The ProConnect client ID/secret are handled only in the Logto Admin Console and are not recorded in Git or chat.

Initial identity scope request remains deliberately narrow:

```text
openid email given_name usual_name
```

Visible Logto connector/sign-in configuration:

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

ID-token verification uses exact public ProConnect discovery values for `jwksUri` and `issuer`. Do not broaden ProConnect identity scopes or the public MCP scope vocabulary without a demonstrated need and the applicable project gate.

## Docker / nftables operational constraint

Persistent `/etc/nftables.conf` contains generic Docker bridge forwarding exceptions and passed syntax validation. The file begins with `flush ruleset`.

Do **not** manually restart/reload nftables while Docker is running merely to test persistence, because that would erase Docker-created chains until Docker recreates them. Systemd boot ordering is compatible with nftables loading first and Docker recreating its chains later. A controlled reboot remains UNKNOWN and is not the current blocker.

## Mandatory evidence still UNKNOWN

C4-P0 remains ACTIVE. Important UNKNOWNs include:

- explicit upstream logout/re-authentication lifecycle semantics;
- wrong-resource rejection with a live validly signed token;
- insufficient-scope enforcement with a live canonical-resource token;
- actual OAuth `/mcp` request path constructing a fresh dynamic Principal/context;
- production OAuth mode preventing static-bearer override;
- ChatGPT callback/login/PKCE/resource/bearer/refresh/revocation behavior;
- controlled reboot confirmation for nftables + Docker + Logto persistence.

The following are no longer UNKNOWN: RFC 8707 authorization/token handling, canonical resource binding, fixed-scope issuance, standard JWT/JWKS validation of an actual Logto token by the integrated provider-neutral bridge verifier, dynamic Principal construction, principal-bound C3 context construction, and proof that the raw OAuth bearer does not cross into the Grist credential-provider context.

Full C4 implementation remains blocked until all mandatory POC exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.

## Recommended fresh-chat restart instruction

> Resolve the exact SHA of `main`; read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md` and `docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md` from that exact project state; reconstruct mutable GitHub facts; then resume C4-P0 from the exact next step in `NEXT.md`. Treat the evidence ledger as PASS/FAIL/UNKNOWN only, reveal no secrets, and do not begin full C4 until the mandatory POC gate passes.
