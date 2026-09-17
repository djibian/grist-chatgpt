# Live POC handoff boundary

This file is the durable handoff for continuing the live C4-P0 Logto / ProConnect / MCP interoperability POC from a fresh controller/chat.

Do not trust remembered GitHub state. At the start of a new execution, resolve exact `main`, read `AGENTS.md`, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` at that SHA, then reconstruct open PRs, exact heads, CI, reviews and dependencies before making a durable transition.

Do not paste ProConnect client secrets, OAuth tokens, authorization codes, cookies, Logto/database/admin credentials, or Grist API keys into GitHub, ChatGPT, issue comments, logs, evidence documents, or model-visible tool inputs.

## Current live checkpoint

Repository-side C4-P0 harness is integrated. The live non-production POC has progressed beyond the original repository-only boundary.

Live deployment currently uses:

```text
Logto OSS    1.43.0
PostgreSQL   16.15-alpine
Public auth  https://auth-poc.loeildumaitre.fr
Admin auth   https://auth-poc-admin.loeildumaitre.fr
MCP resource https://grist-chatgpt.loeildumaitre.fr/mcp
```

The Logto and PostgreSQL containers remain bound to loopback behind Caddy. The admin hostname is protected by infrastructure IP allowlisting rather than exposed broadly.

The bridge deployment itself has deliberately not been changed merely to host the Logto POC. Do not update the production/development bridge route until a later OAuth `/mcp` proof actually requires it.

## Demonstrated live evidence

The durable evidence ledger is:

```text
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
```

Current live PASS evidence includes:

- Logto starts successfully against healthy persistent PostgreSQL;
- the current small POC host has ample observed memory headroom;
- public HTTPS for the Logto issuer works through Caddy with a public certificate;
- the Admin Console is infrastructure-restricted and reachable by the authorized operator;
- first Logto admin account creation succeeds;
- Docker outbound HTTPS works from inside the Logto container;
- the HIBP password breach check works and was not disabled;
- public OIDC discovery is coherent and uses the public HTTPS issuer/endpoints;
- live discovery advertises PKCE `S256`;
- live discovery advertises Authorization Code and refresh-token grant support;
- the repository `probe:logto` metadata probe passes exact issuer, HTTPS auth/token/JWKS endpoints, PKCE `S256`, Authorization Code response and Authorization Code grant checks;
- the canonical MCP API resource `https://grist-chatgpt.loeildumaitre.fr/mcp` exists in Logto;
- exactly the three fixed bridge permissions `doc:read`, `doc:write`, and `doc.schema:write` are present on that resource;
- the MCP resource's `Default API` setting is visually confirmed **OFF**, so the POC does not rely on an implicit default audience;
- a non-production ProConnect **Internet / integration** Fournisseur de Service application named `Logto` exists and its redirect URI is the exact callback URI displayed by the Logto OIDC connector.

Do not infer untested live properties from those metadata/configuration PASS results. RFC 8707 acceptance, live token audience binding, cryptographic JWT/JWKS verification, scope recovery/enforcement in live tokens and ChatGPT refresh behavior remain separate evidence.

## Docker / nftables incident and durable state

Initial admin signup failed with a Logto `500` because the Logto container could resolve DNS but could not establish outbound HTTPS connections. Sanitized logs reached `PasswordPolicyChecker.hasBeenPwned()` and failed with `ETIMEDOUT`.

Root cause was the host `inet filter` `forward` base chain using `policy drop` with no Docker exception. Docker's own forwarding rules accepted the packet, but the additional base-chain drop prevented it from reaching NAT MASQUERADE.

Live forwarding was repaired with the minimum bridge rules, after which multiple HTTPS targets including HIBP returned HTTP 200 from inside Logto and the Docker MASQUERADE counter became non-zero.

Persistent `/etc/nftables.conf` has been prepared with generic Docker bridge matching:

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

That file passed `nft -c -f /etc/nftables.conf`.

Important operational constraint: `/etc/nftables.conf` starts with `flush ruleset`. Do **not** manually reload/restart nftables while Docker is running merely to test persistence, because that would erase Docker-created chains until Docker recreates them.

Systemd ordering was inspected and is compatible with normal boot: `nftables.service` is enabled for `sysinit.target`, runs before `network-pre.target`, and Docker starts later under `multi-user.target`. The current boot began before nftables was installed/enabled, so an actual reboot persistence check is still UNKNOWN and should be done only as a deliberate controlled test.

## Exact next live step: configure Logto -> ProConnect OIDC

The MCP API resource and permissions are fully configured for the POC:

```text
Name:        grist-chatgpt MCP
Identifier:  https://grist-chatgpt.loeildumaitre.fr/mcp
Default API: OFF

Permissions:
doc:read
doc:write
doc.schema:write
```

The ProConnect test application is also registered:

```text
Environment: Internet / integration
Application: Logto
Redirect URI: exact Logto OIDC connector callback URI
```

No `client_id` or `client_secret` value is recorded in Git or in this handoff.

The exact next action is to finish the generic **social OIDC connector** in Logto using the ProConnect test application credentials locally.

ProConnect Internet/integration domain:

```text
fca.integ01.dev-agentconnect.fr
```

ProConnect discovery URL:

```text
https://fca.integ01.dev-agentconnect.fr/api/v2/.well-known/openid-configuration
```

Use the values exposed by that discovery document for issuer, authorization endpoint, token endpoint and JWKS URI rather than inventing endpoints manually.

Configure the Logto connector with:

- `clientId`: the ProConnect integration `client_id`;
- `clientSecret`: the ProConnect integration secret, entered directly in Logto and never pasted into chat/Git;
- Authorization Code flow;
- identity scopes for the initial POC: `openid email given_name usual_name`;
- token endpoint authentication method matching ProConnect discovery/documentation;
- ID-token verification using ProConnect issuer/JWKS from discovery.

Do not request additional ProConnect business/organizational scopes for the initial identity proof unless a demonstrated technical need appears.

After saving the connector, first prove only that Logto accepts the ProConnect configuration. Then run one complete Logto -> ProConnect -> Logto login, followed by a second login for the same ProConnect user to demonstrate stable identity mapping. Record no raw tokens, authorization codes, cookies or secrets.

Do not broaden or rename the public MCP scope vocabulary without the human gate required by `AGENTS.md`.

## Mandatory evidence still UNKNOWN

C4-P0 must remain ACTIVE until the POC contract's mandatory criteria pass. Important UNKNOWNs include:

- ProConnect issuer/discovery accepted by Logto;
- ProConnect Authorization Code login;
- stable identity across repeated login;
- RFC 8707 `resource` accepted on authorization request;
- RFC 8707 `resource` accepted on token request;
- live access token bound to the canonical MCP resource;
- standard cryptographic JWT/JWKS validation on actual Logto keys;
- actual OAuth `/mcp` request path constructing a fresh dynamic Principal/context;
- wrong-resource rejection on the live MCP path;
- insufficient-scope rejection on the live MCP path;
- proof that the OAuth bearer never becomes the upstream Grist credential;
- ChatGPT callback registration, login, PKCE/resource behavior, bearer use, refresh and revocation behavior;
- controlled reboot confirmation for nftables + Docker + Logto persistence.

Full C4 implementation remains blocked until all mandatory POC exit criteria in `docs/LOGTO-PROCONNECT-MCP-POC.md` are PASS.

## Recommended fresh-chat restart instruction

A new Controller can resume with:

> Resolve the exact SHA of `main`; read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md` and `docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md` from that exact project state; reconstruct mutable GitHub facts; then resume C4-P0 from the exact next live step in `NEXT.md`. Treat the evidence ledger as PASS/FAIL/UNKNOWN only, reveal no secrets, and do not begin full C4 until the mandatory POC gate passes.
