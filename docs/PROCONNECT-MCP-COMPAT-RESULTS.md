# ProConnect / MCP compatibility results

This file is the durable evidence ledger for `docs/PROCONNECT-MCP-COMPAT.md`.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens or ID tokens here.

## Environment

- ProConnect network: Internet
- ProConnect environment: integration
- Domain: `fca.integ01.dev-agentconnect.fr`
- MCP target resource: `https://grist-chatgpt.loeildumaitre.fr/mcp`
- Probe date: 2026-09-17
- Probe branch: `research/proconnect-mcp-compat`

## Public-source evidence

The current public `proconnect-gouv/federation` source materially reduces uncertainty around PKCE:

- the OIDC provider configuration sets `pkce.methods` to `["S256"]`;
- the repository contains end-to-end PKCE scenarios;
- the discovery DTO requires `code_challenge_methods_supported` as an array;
- the provider also exposes an introspection endpoint in its discovery DTO.

This is strong implementation evidence but does not replace a live check of the exact Internet integration environment. The live discovery result therefore remains to be recorded before declaring MCP PKCE compatibility final.

No equivalent public-source evidence was found establishing RFC 8707 `resource` handling or MCP-resource audience binding. Those remain the principal compatibility questions.

## Results

| Probe | Status | Evidence |
| --- | --- | --- |
| Discovery issuer/endpoints | UNKNOWN | Pending live `npm run probe:proconnect -- metadata` |
| Discovery PKCE S256 advertisement | UNKNOWN | Public source configures PKCE `S256` and expects `code_challenge_methods_supported`; live integration discovery still pending |
| PKCE implementation support | PASS | Current `proconnect-gouv/federation` source configures `pkce.methods: ["S256"]` and contains E2E PKCE scenarios |
| Introspection implementation surface | PASS | Current discovery DTO includes `introspection_endpoint`; ProConnect docs describe Resource Server introspection |
| Baseline authorization request | UNKNOWN | Registered integration client required |
| PKCE authorization request | UNKNOWN | Registered integration client required for exact environment confirmation |
| RFC 8707 `resource` authorization request | UNKNOWN | Registered integration client required; no confirming public-source evidence found |
| MCP-shaped authorization request | UNKNOWN | Registered integration client required |
| Token exchange with PKCE verifier | UNKNOWN | Successful authorization code required |
| Token exchange with `resource` | UNKNOWN | Successful authorization code required |
| MCP resource/audience binding | UNKNOWN | JWT claim or introspection evidence required |
| Bridge-scope representation | UNKNOWN | Provider/configuration evidence required |
| Refresh/re-authentication behavior | UNKNOWN | Live provider evidence required |
| RFC 9207 callback `iss` behavior | UNKNOWN | Discovery DTO includes `authorization_response_iss_parameter_supported`; exact integration value/callback behavior pending |

## Decision

No architecture decision is recorded yet.

Current evidence makes PKCE less likely to be a blocker. The decisive remaining questions are RFC 8707 `resource` acceptance at `/authorize` and `/token`, resulting audience/resource binding, and safe representation of the existing bridge scopes.

The C4 human gate remains closed until this ledger contains sufficient evidence to decide between direct ProConnect and a dedicated MCP authorization server federated to ProConnect.
