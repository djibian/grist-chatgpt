# ProConnect / MCP compatibility results

This file is the durable evidence ledger for `docs/PROCONNECT-MCP-COMPAT.md`.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens or ID tokens here.

## Environment

- ProConnect network: Internet
- ProConnect environment: integration
- Domain: `fca.integ01.dev-agentconnect.fr`
- MCP target resource: `https://grist-chatgpt.loeildumaitre.fr/mcp`
- Probe date: pending
- Probe branch: `research/proconnect-mcp-compat`

## Results

| Probe | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints | UNKNOWN | Pending `npm run probe:proconnect -- metadata` |
| Discovery PKCE S256 advertisement | UNKNOWN | Pending metadata probe |
| Baseline authorization request | UNKNOWN | Registered integration client required |
| PKCE authorization request | UNKNOWN | Registered integration client required |
| RFC 8707 `resource` authorization request | UNKNOWN | Registered integration client required |
| MCP-shaped authorization request | UNKNOWN | Registered integration client required |
| Token exchange with PKCE verifier | UNKNOWN | Successful authorization code required |
| Token exchange with `resource` | UNKNOWN | Successful authorization code required |
| MCP resource/audience binding | UNKNOWN | JWT claim or introspection evidence required |
| Bridge-scope representation | UNKNOWN | Provider/configuration evidence required |
| Refresh/re-authentication behavior | UNKNOWN | Live provider evidence required |
| RFC 9207 callback `iss` behavior | UNKNOWN | Live callback evidence required |

## Decision

No architecture decision is recorded yet.

The C4 human gate remains closed until this ledger contains sufficient evidence to decide between direct ProConnect and a dedicated MCP authorization server federated to ProConnect.
