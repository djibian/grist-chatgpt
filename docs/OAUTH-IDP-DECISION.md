# C4 OAuth / identity-provider decision

**Status:** DECIDED — human gate resolved on 2026-09-17; C4-P0 interoperability gate subsequently PASSED.  
**Decision owner:** project owner.  
**Protocol baseline:** MCP `2026-07-28`.

## Decision

The production target for **ChatGPT/Codex -> grist-chatgpt** authentication is **Architecture B**:

```text
ChatGPT / Codex
      |
   OAuth 2.1 / MCP
      |
      v
 Logto OSS (self-hosted)
      |
 OIDC federation/login
      v
  ProConnect

 Logto
      |
 audience-bound access token
      v
 grist-chatgpt resource server
      |
 dynamic Principal
      |
 GristContextFactory
      |
 current user's own Grist API key
      v
 Grist Community DINUM
```

The decision fixes the following product architecture:

- **Identity source:** ProConnect remains the institutional upstream identity source.
- **MCP-facing authorization server:** Logto OSS, self-hosted, is the reference implementation for C4.
- **Bridge role:** `grist-chatgpt` remains an OAuth resource server; it does not become an authorization server.
- **Provider neutrality:** bridge core validates standards-based OAuth/OIDC artifacts and must not depend on proprietary Logto runtime semantics.
- **Fallbacks:** Auth0 in an EU tenant is the preferred SaaS fallback; Curity Standard is the preferred commercial self-hosted fallback if institutional support/SLA requirements justify it.
- **Direct ProConnect:** ruled out for the assessed configuration because RFC 8707 Resource Indicators are disabled. Reconsider only if that capability changes and is revalidated.

This decision concerns the MCP authentication boundary only. It does **not** change the selected `grist-chatgpt -> Grist` credential architecture: each production user executes upstream Grist operations with that user's own Grist API key and Grist remains authoritative for upstream ACLs.

## Fixed authorization contract

The public bridge scopes remain exactly:

- `doc:read`
- `doc:write`
- `doc.schema:write`

Effective authority remains:

```text
Grist permissions of the current user's API key
∩ deployment policy
∩ principal resource grants
∩ OAuth scope / operation capability
```

The MCP OAuth access token must never be forwarded to Grist.

## Provider-neutral bridge contract

C4 is implemented around standards rather than Logto-specific runtime APIs. The bridge consumes/configures:

- authorization-server issuer;
- RFC 9728 protected-resource metadata;
- authorization-server/OIDC discovery metadata;
- JWKS for signature validation;
- canonical MCP resource/audience identifier;
- token expiry/not-before where applicable;
- token scopes;
- standards-compatible `WWW-Authenticate` challenges.

The POC canonical MCP resource is:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

The resource URI remains deployment-configurable rather than hard-coded in business logic.

## Token validation decision

The preferred resource-server model is **JWT + JWKS**, validating at minimum:

- signature;
- issuer;
- audience/resource;
- expiry/not-before where applicable;
- scopes required by the requested operation.

A token for another audience/resource is rejected. Validated issuer/subject map to a stable bridge principal, which then enters the C3 `GristContextFactory` isolation boundary.

## Client registration and session policy

The validated ChatGPT path supports the MCP/OAuth requirements exercised during C4-P0, including:

- PKCE `S256`;
- RFC 8707 resource handling/resource binding;
- Logto Dynamic app / CIMD compatibility with ChatGPT client metadata;
- the minimum OIDC permissions needed for ChatGPT (`openid`/`email` path);
- refresh-based continued connectivity while the authorization grant remains valid;
- failure to silently renew after the grant is removed and the already-issued access token expires.

Static MCP bearer, if retained, remains explicitly development/backward compatibility only.

## Logto deployment decision

The reference implementation uses **Logto OSS self-hosted**, backed by PostgreSQL and exposed through HTTPS.

Production acceptance still requires normal C4/C6 operating discipline, including:

- repeatable deployment/rollback;
- backup/update procedure;
- signing-key/secret handling outside Git;
- protected administration access;
- key-rotation and issuer/JWKS outage/recovery evidence;
- no OAuth client secret, ProConnect secret, Logto signing secret, token or session secret in model-visible data, source control or general logs.

If future operational requirements mandate vendor SLA/support, multi-admin controls or capabilities not acceptable in Logto OSS, reassess Curity Standard; if a managed service is preferred, reassess Auth0 EU. A provider change should not alter the bridge core contract if provider neutrality is preserved.

## Why this decision was made

### Direct ProConnect is not viable for the assessed configuration

Compatibility work established that the assessed ProConnect implementation supports PKCE `S256` but configures:

```text
resourceIndicators: { enabled: false }
```

MCP `2026-07-28` requires RFC 8707 Resource Indicators. See:

- `docs/PROCONNECT-MCP-COMPAT.md`;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`.

### Why Logto OSS is the reference implementation

The provider study selected Logto because it matched the project's constraints: self-hostable open-source distribution, MCP/resource-indicator support, PKCE/refresh, CIMD compatibility, generic OIDC federation to ProConnect and no mandatory SaaS dependency at the institutional authentication boundary.

The bridge intentionally avoids Logto-specific core behavior so another standards-compatible authorization server can replace it later if needed.

## C4-P0 interoperability gate — PASSED

The former POC gate is no longer future work. Durable evidence demonstrates the required non-production interoperability path, including:

1. ProConnect-backed Logto authentication with stable user mapping;
2. PKCE `S256` and RFC 8707 resource binding;
3. JWT/JWKS issuer/audience/expiry validation;
4. enforcement of `doc:read`, `doc:write`, `doc.schema:write`;
5. wrong-resource rejection before principal/context use;
6. dynamic principal and principal-bound Grist context construction;
7. no Logto/ProConnect bearer forwarded to the Grist credential provider;
8. RFC 9728 protected-resource metadata/challenge behavior;
9. real ChatGPT Developer Mode connection through Logto -> ProConnect -> Logto;
10. real MCP reads plus bounded additive write and destructive delete with targeted re-read verification;
11. persistence across a fresh ChatGPT conversation while the grant remains valid;
12. grant-removal behavior: an already-issued access token remains usable until expiry, but ChatGPT cannot silently renew afterward and requires reconnection.

Evidence is maintained in:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
docs/LOGTO-PROCONNECT-MCP-POC-NEGATIVE-EVIDENCE.md
docs/CHATGPT-OAUTH-READINESS.md
```

## Current C4 boundary

C4 is now **ELIGIBLE productionization work**, not a provider-selection gate. Remaining work is operational evidence around the proven design, including exercising the intended release/rollback path and documenting issuer/JWKS key-rotation plus outage/recovery behavior.

## Deferred human gates

This decision does **not** resolve C5 persistence/encryption choices for per-user Grist API keys. Those remain separate human gates.

Production ProConnect registration/DataPass or any institutional contractual commitment also remains a separate explicit approval step.

## Sources/evidence to revalidate for future changes

Provider and protocol behavior is time-sensitive. Re-check current MCP authorization requirements, OpenAI MCP/OAuth requirements, Logto documentation, ProConnect documentation and repository evidence before changing this decision or production configuration.
