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
- Logto displays a successful-login page with a user identifier; the identifier value is intentionally not recorded.

The durable evidence ledger is `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Resolved federation blocker

The first live ProConnect login failed after callback with:

```text
TypeError: Invalid URL
at parseUserInfoFromIdToken (.../connector-oidc/lib/index.js)
```

Exact Logto `v1.43.0` source localized this to construction of the configured `jwksUri` URL. The ProConnect discovery values were then retrieved and the connector's ID-token verification configuration corrected with:

```text
issuer   = https://fca.integ01.dev-agentconnect.fr/api/v2
jwks_uri = https://fca.integ01.dev-agentconnect.fr/api/v2/jwks
```

After that correction, the same Live preview login completed successfully. ProConnect reused the active upstream session, so the successful repeat did not require another credential/MFA prompt. No token or identifier value was recorded.

## Exact next live step: prove stable identity mapping

The first complete federation login is now PASS. The next step is to prove that the **same ProConnect user maps back to the same Logto user** on a second completed login.

Do not paste the displayed Logto user ID into chat or GitHub. Compare it locally only.

Recommended sequence:

1. note the currently displayed Logto user ID privately, without copying it into chat/Git;
2. end/restart the Logto Live preview sign-in session so a new Logto authorization flow is started;
3. choose **ProConnect** again and complete the flow with the same ProConnect identity;
4. it is acceptable if ProConnect reuses its own authenticated session and does not prompt again for credentials/MFA;
5. after successful return, compare the new displayed Logto user ID with the first one locally;
6. also check the Logto Admin Console user list if useful to confirm that the repeat did not create an additional user account.

Only report sanitized evidence:

```text
Second ProConnect round trip: success/failure
Same Logto user ID as first successful login: yes/no
Additional Logto user account created unexpectedly: yes/no/unknown
Extra identifier prompt: yes/no
Sanitized error text, if any
```

If the same Logto user is reused, stable identity mapping can move to PASS. If a different Logto user is created, stop and diagnose identity linkage before proceeding to MCP resource/token tests.

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

- stable identity mapping across two successful ProConnect/Logto logins;
- logout/re-login behavior without unintended new identity;
- RFC 8707 `resource` accepted on authorization request;
- RFC 8707 `resource` accepted on token request;
- live access token bound to the canonical MCP resource;
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
