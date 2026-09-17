# ProConnect / MCP compatibility results

This file is the durable evidence ledger for `docs/PROCONNECT-MCP-COMPAT.md`.

Do not record client secrets, authorization codes, cookies, access tokens, refresh tokens or ID tokens here.

## Environment and evidence baseline

- ProConnect target: Internet integration / production architecture represented by the current public `proconnect-gouv/federation` implementation
- Integration domain: `fca.integ01.dev-agentconnect.fr`
- MCP target resource: `https://grist-chatgpt.loeildumaitre.fr/mcp`
- Assessment date: 2026-09-17
- ProConnect source snapshot assessed: `proconnect-gouv/federation` commit `0ddb96fc538834409866dd6c8c7d1313cff44e6d`
- MCP specification assessed: `2026-07-28`

## Established public-source evidence

### PKCE

The current public ProConnect federation source provides strong positive evidence for MCP PKCE requirements:

- the OIDC provider configuration sets `pkce.methods` to `["S256"]`;
- the repository contains end-to-end PKCE scenarios;
- the discovery DTO requires `code_challenge_methods_supported` as an array.

PKCE is therefore not the identified architectural blocker.

### Resource indicators / RFC 8707

The same production OIDC-provider configuration explicitly contains:

```text
resourceIndicators: { enabled: false }
```

The MCP `2026-07-28` authorization specification requires MCP clients to implement OAuth Resource Indicators (RFC 8707) and send the target `resource` when requesting authorization/tokens.

Current ProConnect documentation also describes a closed set of accepted service-provider authorization parameters and does not document `resource`; unsupported authorization parameters may produce `Y000400 Bad Request`.

Taken together, the current public implementation evidence is sufficient to conclude that **ProConnect, in its current configuration, cannot be used directly as the MCP authorization server while remaining conformant with MCP 2026-07-28**.

A live integration probe would still be useful only if there is reason to believe the deployed environment differs from the current public configuration or ProConnect enables Resource Indicators in a future release. It is no longer required merely to decide the current architecture.

### Resource Server / introspection

ProConnect documents a Resource Server mode using token introspection, and its discovery DTO includes an introspection endpoint. This remains useful for identity/resource-server patterns but does not compensate for the MCP client's mandatory RFC 8707 authorization flow when ProConnect itself acts as the MCP authorization server.

## Results

| Probe / requirement | Status | Evidence |
| --- | --- | --- |
| Authorization Code Flow | PASS | ProConnect documentation and implementation |
| PKCE S256 implementation | PASS | `pkce.methods: ["S256"]` plus E2E PKCE scenarios |
| Discovery supports PKCE metadata shape | PASS | discovery DTO requires `code_challenge_methods_supported` |
| Introspection surface | PASS | discovery DTO + documented Resource Server flow |
| RFC 8707 Resource Indicators in current ProConnect AS | FAIL | OIDC provider config explicitly sets `resourceIndicators: { enabled: false }` |
| Direct MCP 2026-07-28 authorization-server compatibility | FAIL | MCP requires RFC 8707 resource indicators; current ProConnect AS disables them |
| MCP resource/audience binding through direct ProConnect | FAIL / unavailable in current configuration | Resource Indicator feature disabled |
| Existing bridge scopes (`doc:read`, `doc:write`, `doc.schema:write`) | UNKNOWN for direct ProConnect | no need to resolve before architecture decision because RFC 8707 already blocks direct use |
| Refresh/re-authentication UX | not architecture-blocking at this stage | can be decided in the selected intermediary AS architecture |
| RFC 9207 callback `iss` behavior | not architecture-blocking at this stage | ProConnect discovery DTO exposes the relevant support field; can be revalidated if direct mode is reconsidered |

## Compatibility conclusion

**Architecture A — ProConnect directly as the MCP authorization server — is not viable with the current ProConnect OIDC-provider configuration.**

This does **not** reject ProConnect as the identity source. The evidence instead supports proceeding to evaluation of:

```text
Architecture B
ChatGPT / Codex
      |
   OAuth 2.1 / MCP
      v
Dedicated MCP authorization server
      |
  OIDC federation/login
      v
ProConnect
```

The dedicated authorization server must own the MCP-facing OAuth contract, including at least PKCE, RFC 8707 resource/audience binding, bridge scopes, token validation metadata and refresh/session behavior. ProConnect may remain the upstream institutional identity provider.

## Revalidation condition

Direct ProConnect may be reconsidered later if ProConnect changes its deployment so that RFC 8707 Resource Indicators are enabled and the resulting tokens are demonstrably bound to the MCP resource. At that point the repository probe can be used for a live A/B confirmation without redesigning the test procedure.
