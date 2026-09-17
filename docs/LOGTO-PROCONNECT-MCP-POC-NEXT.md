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
- a real browser flow reaches ProConnect, completes required re-auth/MFA, and returns to the exact Logto callback;
- ProConnect public discovery `issuer` and `jwks_uri` are configured in Logto ID-token verification;
- Logto successfully verifies the ProConnect ID token via remote JWKS/issuer and completes a full Live preview sign-in;
- a second completed flow with the same ProConnect identity returns the same Logto user ID and creates no duplicate Logto user.

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

## Exact next live step: Phase 3 MCP resource / RFC 8707 proof

The next blocking proof is Logto acting as the MCP-facing authorization server for the canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

with exactly:

```text
doc:read
doc:write
doc.schema:write
```

Do **not** use Logto Live preview as evidence for this resource flow: the built-in demo app may request Logto-specific resources and does not prove issuance for the canonical MCP resource.

### Required preparation in Logto

1. Create one bounded **User** global role for the POC test identity, with exactly the already-approved MCP resource permissions:

```text
doc:read
doc:write
doc.schema:write
```

2. Assign that role only to the existing ProConnect-backed Logto test user. Logto global API-resource permissions are role-derived; requesting a scope does not by itself grant it.

3. Create a dedicated non-production OAuth/OIDC test application/client suitable for Authorization Code + PKCE `S256`. Prefer a client with a loopback/local callback so authorization codes and tokens remain local and are never pasted into chat/Git.

No new public scope is being introduced by this step; it only assigns the three scopes already fixed by the authoritative architecture for the test identity.

### Required live proof

Run a fresh Authorization Code + PKCE flow that explicitly includes:

```text
resource=https://grist-chatgpt.loeildumaitre.fr/mcp
scope=openid offline_access doc:read doc:write doc.schema:write
```

The proof must establish, without recording raw token material:

- Logto accepts the explicit RFC 8707 `resource` on the authorization request;
- the token exchange completes for that resource;
- the returned access token is a JWT for the canonical MCP resource rather than an opaque/default-resource token;
- validated token diagnostics show the canonical MCP resource in the token audience/resource binding;
- the three requested bridge scopes are present/recoverable as granted permissions;
- signature/issuer/expiry claims can be validated against Logto's standard JWKS/discovery metadata;
- refresh-token behavior can be observed later without exposing token values.

Use only sanitized diagnostics such as:

```text
Authorization request with explicit resource: PASS/FAIL
Token exchange: PASS/FAIL
JWT access token: yes/no
Issuer matches Logto: yes/no
Audience/resource matches canonical MCP resource: yes/no
Granted scopes include doc:read/doc:write/doc.schema:write: yes/no
Signature verifies against Logto JWKS: yes/no
Refresh token issued when requested: yes/no
```

Do not paste any authorization code, access token, refresh token, ID token, cookie or client secret.

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
