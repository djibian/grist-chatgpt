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
- the repository `probe:logto` metadata probe passes exact issuer, HTTPS auth/token/JWKS endpoints, PKCE `S256`, Authorization Code response and Authorization Code grant checks.

Do not infer untested live properties from those metadata PASS results. RFC 8707 acceptance, live token audience binding, cryptographic JWT/JWKS verification, scope enforcement and ChatGPT refresh behavior remain separate evidence.

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

## Exact next product step

Before configuring ProConnect, create the MCP API resource in the Logto Admin Console.

Create this API resource:

```text
Name:       grist-chatgpt MCP
Identifier: https://grist-chatgpt.loeildumaitre.fr/mcp
```

Do **not** make it the default API for the POC. The live flow must demonstrate explicit RFC 8707 `resource` handling rather than hiding a missing resource request behind a default resource.

Create exactly these public permissions/scopes:

```text
doc:read
doc:write
doc.schema:write
```

Suggested descriptions:

```text
doc:read          Read Grist document data
doc:write         Create or modify Grist document data
doc.schema:write  Modify Grist document structure
```

Do not broaden or rename the public scope vocabulary without the human gate required by `AGENTS.md`.

After creating the resource/scopes, record only sanitized evidence in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Step after the MCP resource: ProConnect federation

For OSS, use Logto's generic **social OIDC connector**, not the commercial Enterprise SSO path.

Register/use a non-production ProConnect integration client outside Git. Copy the exact callback URI shown by the Logto connector into the ProConnect registration.

Configure Logto with locally handled secret values only:

- ProConnect integration issuer / discovery URL;
- client ID;
- client secret;
- Authorization Code flow;
- only identity scopes required for the POC.

The ProConnect client secret must remain outside Git and outside model-visible conversation content.

Required live identity evidence after configuration:

1. complete Logto -> ProConnect -> Logto login;
2. complete a second login for the same ProConnect user;
3. record only sanitized evidence proving stable Logto identity mapping;
4. test logout/re-login behavior without recording raw cookies/tokens.

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
