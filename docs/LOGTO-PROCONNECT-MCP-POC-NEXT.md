# Live POC handoff boundary

This file is the durable handoff for continuing the live C4-P0 Logto / ProConnect / MCP interoperability POC from a fresh controller/chat.

Do not trust remembered GitHub state. At the start of a new execution, resolve exact `main`, read `AGENTS.md`, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` at that SHA, then reconstruct open PRs, exact heads, CI, reviews and dependencies before making a durable transition.

Do not paste ProConnect client secrets, OAuth tokens, authorization codes, cookies, Logto/database/admin credentials, Grist API keys, or raw provider subjects into GitHub, ChatGPT, issue comments, logs, evidence documents, or model-visible tool inputs.

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
- a real browser flow reaches ProConnect, completes required re-auth/MFA, returns to the exact Logto callback, and progresses through authorization-code exchange to ID-token processing.

The durable evidence ledger is `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Current blocking diagnosis

The first live ProConnect login did **not** complete. After a successful return from ProConnect, Logto returned `Internal server error`.

Sanitized server evidence:

```text
POST /api/experience/verification/social/<connector>/verify
TypeError: Invalid URL
at parseUserInfoFromIdToken (.../connector-oidc/lib/index.js)
```

The exact Logto `v1.43.0` source shows that this point executes:

```text
createRemoteJWKSet(new URL(config.idTokenVerificationConfig.jwksUri))
```

Therefore the current blocker is an invalid or empty `idTokenVerificationConfig.jwksUri` in the generic OIDC connector. Do not change client ID, client secret, callback URI, MFA, public MCP scopes, or bridge code to work around this.

This is currently treated as a connector configuration defect, not as evidence that Logto and ProConnect are incompatible.

## Exact next live step: obtain and configure ProConnect ID-token verification metadata

From the VPS, retrieve only the non-secret discovery values needed for verification:

```bash
curl -fsS \
  https://fca.integ01.dev-agentconnect.fr/api/v2/.well-known/openid-configuration \
| python3 -c 'import json,sys; d=json.load(sys.stdin); print("issuer =", d.get("issuer")); print("jwks_uri =", d.get("jwks_uri")); print("id_token_signing_alg_values_supported =", d.get("id_token_signing_alg_values_supported"))'
```

These values are public metadata and safe to report. Do not report client credentials or token material.

Then edit the Logto **ProConnect** generic OIDC connector and complete the **ID token verification** configuration using the exact discovery values:

- `jwksUri`: exact `jwks_uri` from discovery;
- `issuer`: exact `issuer` from discovery;
- signing algorithm constraint only if the Logto UI requires it, using a value actually advertised by discovery;
- do not invent an audience value: Logto `v1.43.0` already supplies the connector `clientId` as the ID-token verification audience.

Save the connector and repeat the same first login flow. A successful repeat must reach Logto account/sign-in completion without an internal server error.

If the Logto Admin Console does not expose obvious fields matching `jwksUri` / `issuer`, inspect or report the exact visible **ID token verification** section before changing anything else.

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

## Docker / nftables operational constraint

Persistent `/etc/nftables.conf` contains generic Docker bridge forwarding exceptions and passed syntax validation. The file begins with `flush ruleset`.

Do **not** manually restart/reload nftables while Docker is running merely to test persistence, because that would erase Docker-created chains until Docker recreates them. Systemd boot ordering is compatible with nftables loading first and Docker recreating its chains later. A controlled reboot remains UNKNOWN and is not the current blocker.

## Mandatory evidence still UNKNOWN

C4-P0 remains ACTIVE. Important UNKNOWNs include:

- successful first complete Logto -> ProConnect -> Logto Authorization Code login after JWKS correction;
- stable identity mapping across two successful logins;
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
