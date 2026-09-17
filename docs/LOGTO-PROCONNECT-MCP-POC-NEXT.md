# Live POC handoff boundary

This file is the durable handoff for continuing the live C4-P0 Logto / ProConnect / MCP interoperability POC from a fresh controller/chat.

Do not trust remembered GitHub state. At the start of a new execution, resolve exact `main`, read `AGENTS.md`, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` at that SHA, then reconstruct open PRs, exact heads, CI, reviews and dependencies before making a durable transition.

Do not paste ProConnect client secrets, OAuth tokens, authorization codes, cookies, Logto/database/admin credentials, or Grist API keys into GitHub, ChatGPT, issue comments, logs, evidence documents, or model-visible tool inputs.

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
- the Logto generic social OIDC connector is saved successfully with ProConnect credentials handled locally;
- ProConnect is enabled in Logto Social sign-in;
- `Require users to provide missing sign-up identifier = OFF`;
- `Automatically link accounts with the same identifier = OFF`;
- persistent third-party token storage remains OFF.

The durable evidence ledger is `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Docker / nftables operational constraint

Persistent `/etc/nftables.conf` contains generic Docker bridge forwarding exceptions and passed syntax validation. The file begins with `flush ruleset`.

Do **not** manually restart/reload nftables while Docker is running merely to test persistence, because that would erase Docker-created chains until Docker recreates them. Systemd boot ordering is compatible with nftables loading first and Docker recreating its chains later. A controlled reboot remains UNKNOWN and is not the current blocker.

## Exact next live step: first ProConnect login

The ProConnect connector is now configured and visible in Logto's sign-in experience. The next step is to execute one complete login flow through the public Logto endpoint.

Use a fresh/private browser session if useful to avoid reusing the Logto Admin Console session.

Start at a Logto sign-in experience that shows the **ProConnect** social button, then:

1. click **ProConnect**;
2. confirm the browser is redirected to the ProConnect integration environment;
3. authenticate with the intended test/integration identity;
4. allow the browser to return to Logto;
5. confirm that Logto completes account creation/sign-in without asking for an extra identifier;
6. do not paste the returned URL if it contains authorization codes, state values, tokens or other transient credentials.

For the first flow, only report sanitized observations:

```text
Reached ProConnect: yes/no
Authentication at ProConnect: success/failure
Returned to Logto: yes/no
Logto sign-in/account creation: success/failure
Unexpected extra identifier prompt: yes/no
Sanitized error text, if any
```

If the flow succeeds, inspect the resulting Logto user only enough to establish that a social identity for IdP `proconnect` exists; do not record raw provider subject values in GitHub unless there is a demonstrated need. Then perform logout/re-login with the same ProConnect user and verify that Logto reuses the same user rather than creating a second account.

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
```

Do not broaden ProConnect identity scopes or the public MCP scope vocabulary without a demonstrated need and the applicable project gate.

## Mandatory evidence still UNKNOWN

C4-P0 remains ACTIVE. Important UNKNOWNs include:

- first complete Logto -> ProConnect -> Logto Authorization Code login;
- stable identity mapping across two logins;
- logout/re-login behavior;
- RFC 8707 `resource` accepted on authorization request;
- RFC 8707 `resource` accepted on token request;
- live access token bound to the canonical MCP resource;
- standard JWT/JWKS validation on actual Logto keys;
- actual OAuth `/mcp` request path constructing a fresh dynamic Principal/context;
- wrong-resource rejection on the live MCP path;
- insufficient-scope rejection on the live MCP path;
- proof that OAuth bearer never becomes the upstream Grist credential;
- ChatGPT callback/login/PKCE/resource/bearer/refresh/revocation behavior;
- controlled reboot confirmation for nftables + Docker + Logto persistence.

Full C4 implementation remains blocked until all mandatory POC exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.

## Recommended fresh-chat restart instruction

> Resolve the exact SHA of `main`; read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md` and `docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md` from that exact project state; reconstruct mutable GitHub facts; then resume C4-P0 from the exact next live step in `NEXT.md`. Treat the evidence ledger as PASS/FAIL/UNKNOWN only, reveal no secrets, and do not begin full C4 until the mandatory POC gate passes.
