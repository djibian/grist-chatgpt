# C4 OAuth / identity-provider decision

**Status:** DECIDED — human gate resolved on 2026-09-17.  
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
- **Provider neutrality:** bridge core code must validate standard OAuth/OIDC artifacts and must not depend on a proprietary Logto SDK or Logto-only token semantics.
- **Fallbacks:** Auth0 in an EU tenant is the preferred SaaS fallback; Curity Standard is the preferred commercial self-hosted fallback if institutional support/SLA requirements justify it.
- **Direct ProConnect:** ruled out for the currently assessed ProConnect configuration because RFC 8707 Resource Indicators are disabled. It may be reconsidered only if that capability changes and is revalidated.

This decision concerns only the MCP authentication boundary. It does **not** change the already selected **grist-chatgpt -> Grist** credential architecture: each production user continues to execute upstream Grist operations with that user's own Grist API key and Grist remains authoritative for upstream ACLs.

## Fixed authorization contract

The public bridge scopes remain unchanged:

- `doc:read`
- `doc:write`
- `doc.schema:write`

The effective authority remains:

```text
Grist permissions of the current user's API key
∩ deployment policy
∩ principal resource grants
∩ OAuth scope / operation capability
```

The MCP OAuth access token must never be forwarded to Grist.

## Provider-neutral bridge contract

C4 must be implemented around standards rather than Logto-specific runtime APIs.

The bridge should consume/configure at least:

- authorization-server issuer;
- protected-resource metadata (RFC 9728);
- authorization-server/OIDC discovery metadata;
- JWKS for signature validation, with introspection retained only as an explicitly selected alternative if needed;
- canonical MCP resource/audience identifier;
- token expiry;
- token scopes;
- standards-compatible `WWW-Authenticate` challenges.

For the initial POC the canonical MCP resource is:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

The production resource URI must remain deployment-configurable rather than hard-coded in bridge business logic.

## Token validation decision

The preferred resource-server validation model is **JWT + JWKS**, validating at minimum:

- signature;
- issuer;
- audience/resource;
- expiry/not-before where applicable;
- scopes required by the requested operation.

A token issued for another audience/resource must be rejected.

The validated token subject must map to a stable bridge principal. That principal then enters the already integrated C3 `GristContextFactory` isolation boundary.

## Client registration and session policy

For the first ChatGPT/Codex product path:

- pre-registration / ChatGPT user-defined OAuth client is acceptable and must be validated in the POC;
- CIMD compatibility is desirable for generic MCP clients and should remain possible, but it is not allowed to block the initial ChatGPT product path if pre-registration is sufficient;
- PKCE `S256` is mandatory;
- RFC 8707 `resource` handling and resource/audience binding are mandatory;
- refresh tokens / durable offline connectivity must be validated with ChatGPT; `offline_access` or the provider-equivalent mechanism should be used where appropriate;
- exact refresh-token lifetime/rotation policy remains an operational configuration choice, but the user experience must not require avoidable frequent reauthentication.

## Logto deployment decision

The reference POC uses **Logto OSS self-hosted** rather than Logto Cloud.

Production acceptance of Logto OSS is conditional on the POC and later C6 operational hardening. In particular:

- PostgreSQL-backed deployment;
- HTTPS;
- normal update/backup procedure;
- signing-key/secret handling outside Git;
- Logto administration console must not be left broadly exposed to the public Internet; protect it with infrastructure/network access controls appropriate to the deployment;
- no OAuth client secret, ProConnect secret, Logto signing secret, token or session secret may enter the repository, model-visible tool data or general logs.

If operational requirements later mandate vendor SLA/support, multi-admin controls or features not acceptable in Logto OSS, reassess **Curity Standard** before changing the bridge contract. If a managed service is preferred, reassess **Auth0 EU**. Such a change should only require issuer/provider configuration if provider neutrality is preserved.

## Why this decision was made

### ProConnect direct is not currently viable

The compatibility work integrated through PR #20 established that the assessed ProConnect federation implementation supports PKCE `S256` but explicitly configures:

```text
resourceIndicators: { enabled: false }
```

MCP `2026-07-28` requires RFC 8707 Resource Indicators. See:

- `docs/PROCONNECT-MCP-COMPAT.md`;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`.

### Why Logto OSS is the reference implementation

The provider study established that Logto currently offers the closest fit to the project's constraints:

- self-hostable open-source distribution under MPL-2.0;
- explicit MCP/AI authorization guidance using the OAuth `resource` parameter and audience-bound tokens;
- PKCE and refresh-token support;
- CIMD support for dynamic MCP-style clients while retaining normal pre-registered clients;
- generic OIDC connector suitable for federating authentication to ProConnect;
- no mandatory SaaS dependency at the institutional authentication boundary.

The decision intentionally avoids embedding Logto-specific behavior in the bridge so that a later standards-compatible authorization server can replace it.

## POC gate before full C4 implementation

Provider-specific full OAuth implementation is not yet considered proven. The next C4 tranche is the bounded POC documented in:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
```

The POC must demonstrate, with non-production configuration:

1. Logto can authenticate through ProConnect OIDC and preserve a stable user identity;
2. the authorization flow accepts PKCE `S256` and RFC 8707 `resource`;
3. the access token is cryptographically validated and audience-bound to the canonical MCP resource;
4. `doc:read`, `doc:write`, `doc.schema:write` can be represented and enforced;
5. an access token for another audience/resource is rejected;
6. refresh/offline connectivity behaves acceptably with a draft ChatGPT MCP app;
7. validated OAuth identity maps to the correct dynamic `Principal` and C3 Grist context;
8. no ProConnect or Logto token is ever forwarded to Grist;
9. static bearer mode, if retained, remains explicitly development/backward-compatibility only.

Passing the POC makes the core C4 OAuth integration eligible. Failing a mandatory MCP property reopens only the authorization-server product choice; it does not change the ProConnect identity-source decision unless evidence specifically requires that.

## Deferred human gates

This decision does **not** resolve C5 persistence/encryption choices for Grist API keys. Those remain separate human gates.

Production ProConnect registration/DataPass or any institutional contractual commitment also remains a separate explicit approval step; the POC should use integration/non-production facilities wherever possible.

## Sources / evidence to revalidate when implementation begins

- MCP authorization specification `2026-07-28`;
- current OpenAI MCP/ChatGPT OAuth requirements;
- current Logto MCP/AI authorization documentation;
- current Logto generic OIDC connector documentation;
- current Logto OSS licensing/deployment documentation;
- ProConnect integration/OIDC documentation;
- repository compatibility evidence in `docs/PROCONNECT-MCP-COMPAT*.md`.

Current provider behavior is time-sensitive: implementation work must re-check these sources rather than treating this decision document as a substitute for live protocol verification.
