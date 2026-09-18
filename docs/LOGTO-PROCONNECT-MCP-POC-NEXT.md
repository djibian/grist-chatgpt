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

The bridge deployment itself has deliberately not been changed merely to host the Logto POC. Do not update the deployed `/mcp` route until a later OAuth request-path proof actually requires it.

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
- dedicated third-party Native app `grist-chatgpt-poc-pkce` exists using Authorization Code with loopback redirect `http://127.0.0.1:8765/callback`.

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

## Phase 3 preparation complete

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

Completed preparation:

1. MCP API resource created in Logto with the exact canonical identifier.
2. Exactly the three fixed permissions above exist on that resource.
3. `Default API = OFF` is confirmed.
4. Global **User** role `grist-chatgpt-poc` created with exactly those three permissions.
5. That role is assigned only to the existing ProConnect-backed POC user and is not a default role.
6. Dedicated third-party **Native app** `grist-chatgpt-poc-pkce` created with Authorization Code flow.
7. Loopback redirect URI `http://127.0.0.1:8765/callback` saved successfully.

The Native app is the dedicated public client for the live PKCE/RFC 8707 proof. Do not create a client secret for this test.

## Exact next live step: run the OAuth Authorization Code + PKCE resource flow

Use the dedicated `grist-chatgpt-poc-pkce` client from the user's local PC, with a listener bound only to `127.0.0.1:8765`. Generate a fresh high-entropy PKCE verifier, derive the `S256` challenge, and a fresh `state` locally for each run. Do not paste the resulting authorization URL, code, verifier, tokens, cookies or raw identifiers into chat/Git if they contain transient/security material.

The authorization request must explicitly include:

```text
resource=https://grist-chatgpt.loeildumaitre.fr/mcp
scope=openid offline_access doc:read doc:write doc.schema:write
code_challenge_method=S256
```

Then exchange the returned code locally at Logto's token endpoint using the same public client ID, exact loopback redirect URI, PKCE verifier, and the canonical `resource` value where supported/required by the token request.

The proof must establish, without recording raw token material:

- Logto accepts the explicit RFC 8707 `resource` on the authorization request;
- the callback reaches the local listener with matching `state`;
- the token exchange completes for that resource;
- the returned access token is a JWT for the canonical MCP resource rather than an opaque/default-resource token;
- validated token diagnostics show the canonical MCP resource in the token audience/resource binding;
- the three requested bridge scopes are present/recoverable as granted permissions;
- signature/issuer/expiry claims validate against Logto's standard JWKS/discovery metadata;
- whether a refresh token is issued when `offline_access` is requested.

Use only sanitized diagnostics such as:

```text
Authorization request with explicit resource: PASS/FAIL
Callback state matches: yes/no
Token exchange: PASS/FAIL
JWT access token: yes/no
Issuer matches Logto: yes/no
Audience/resource matches canonical MCP resource: yes/no
Granted scopes include doc:read/doc:write/doc.schema:write: yes/no
Signature verifies against Logto JWKS: yes/no
Refresh token issued when requested: yes/no
```

Do not paste any authorization code, access token, refresh token, ID token, cookie, client secret, PKCE verifier, raw Logto user ID or raw provider subject.

If Logto rejects `resource` or cannot issue a resource-bound token despite correct configuration, stop and diagnose before changing `Default API` or weakening the POC requirement.

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
- RFC 8707 `resource` accepted on authorization request;
- RFC 8707 `resource` accepted on token request;
- live access token bound to the canonical MCP resource;
- fixed bridge scopes present/recoverable in the live resource token;
- standard JWT/JWKS validation of actual Logto-issued access tokens by the bridge;
- actual OAuth `/mcp` request path constructing a fresh dynamic Principal/context;
- wrong-resource rejection on the live MCP path;
- insufficient-scope rejection on the live MCP path;
- proof that OAuth bearer never becomes the upstream Grist credential;
- ChatGPT callback/login/PKCE/resource/bearer/refresh/revocation behavior;
- controlled reboot confirmation for nftables + Docker + Logto persistence.

Full C4 implementation remains blocked until all mandatory POC exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.

## Recommended fresh-chat restart instruction

> Resolve the exact SHA of `main`; read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md` and `docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md` from that exact project state; reconstruct mutable GitHub facts; then resume C4-P0 from the exact next live step in `NEXT.md`. Treat the evidence ledger as PASS/FAIL/UNKNOWN only, reveal no secrets, and do not begin full C4 until the mandatory POC gate passes.
