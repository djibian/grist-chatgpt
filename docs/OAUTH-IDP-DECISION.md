# C4 OAuth / identity-provider decision package

**Status:** research and human-decision input only — this document does **not** select an authorization-server product or authorize provider-specific implementation.  
**Initial research date:** 2026-09-16  
**Compatibility update:** 2026-09-17  
**Project baseline:** C1, C2 and C3 integrated; direct ProConnect has been evaluated against MCP 2026-07-28 and is not viable as the MCP-facing authorization server in the current ProConnect configuration. C4 core implementation remains blocked by the human choice of the intermediary authorization-server architecture/provider.

## Decision to make

Choose the production identity-provider / authorization-server architecture for the MCP boundary:

```text
ChatGPT / Codex
      |
   OAuth 2.1
      |
      v
grist-chatgpt MCP
      |
 dynamic Principal
      |
      v
GristContextFactory
      |
 current user's own Grist API key
      |
      v
Grist Community DINUM
```

This decision concerns **ChatGPT/Codex -> grist-chatgpt** authentication only. It does not change the already selected **grist-chatgpt -> Grist** model: each production user must still execute upstream work with that user's own Grist API key, and Grist remains authoritative for upstream ACLs.

The preferred institutional identity source remains ProConnect unless a separate human decision changes that. The compatibility work recorded in `docs/PROCONNECT-MCP-COMPAT-RESULTS.md` establishes that ProConnect cannot currently serve **directly** as the MCP authorization server because its current OIDC provider disables RFC 8707 Resource Indicators.

The public bridge scope vocabulary remains unchanged:

- `doc:read`
- `doc:write`
- `doc.schema:write`

## Fixed project constraints

Whichever option is selected must preserve these invariants:

1. MCP remains the primary public contract.
2. The first production target is multi-user access to one configured Grist Community DINUM instance.
3. A bearer presented by an MCP client must identify a dynamic bridge `Principal`; it is not a Grist credential.
4. The bridge may reduce authority but must never elevate the user's Grist authority.
5. OAuth tokens, Grist API keys and session secrets must never become model-visible tool data, audit payloads or general logs.
6. User-derived Grist clients, discovery results and caches remain isolated through the C3 principal-context boundary.
7. No new public scopes are introduced as part of this decision.
8. No provider-specific production implementation starts until the remaining authorization-server choice is made explicitly by a human.
9. The selected MCP-facing authorization server must support RFC 8707 Resource Indicators and produce tokens demonstrably intended for the canonical MCP resource.

## Current MCP authorization baseline

The current MCP specification is `2026-07-28`; the TypeScript SDK v2 line implements that revision.

A protected MCP server is an OAuth resource server. For a conforming production design, the authorization system must support the following behavior.

### Protected-resource and authorization-server discovery

The MCP server must publish OAuth Protected Resource Metadata (RFC 9728) and point clients to its authorization server. The authorization server must expose either RFC 8414 Authorization Server Metadata or OpenID Connect Discovery metadata.

An unauthenticated/invalid request should produce a standards-compatible `WWW-Authenticate: Bearer` challenge including the protected-resource metadata location.

### Authorization code protection

MCP clients must use PKCE and, when technically capable, `S256`. Current MCP security guidance says clients must verify advertised PKCE support and refuse the flow when authorization-server metadata does not advertise `code_challenge_methods_supported`.

### Resource/audience binding

MCP clients must send the RFC 8707 `resource` parameter in both authorization and token requests. Tokens accepted by `grist-chatgpt` must be demonstrably intended for the MCP resource; tokens issued for other resources must be rejected.

The MCP access token must never be passed through to Grist. Grist uses the separate per-user credential resolved by `GristCredentialProvider`.

### Authorization-response issuer binding

The 2026-07-28 specification hardens authorization-server mix-up protection with RFC 9207. Authorization servers should emit `iss` in authorization responses and clients validate a present `iss` against the issuer recorded before the redirect.

### Client registration

The specification allows three registration paths:

1. OAuth Client ID Metadata Documents (CIMD) — preferred by the 2026-07-28 specification;
2. pre-registration;
3. Dynamic Client Registration (DCR) — deprecated but retained for compatibility.

A production choice does not have to support every registration mechanism if the intended clients can use a supported one, but the selected path must be explicit and reproducible.

### Refresh/offline access

OpenAI's current ChatGPT MCP-app guidance says OAuth/OIDC providers should issue refresh tokens for durable connectivity. For OIDC, OpenAI specifically points to `offline_access` (or a provider equivalent) being advertised in discovery metadata; otherwise users may have to reauthenticate after the initial authorization expires.

### MCP server implementation boundary

The current TypeScript MCP SDK v2 treats the MCP server as a resource server and recommends a dedicated identity/authorization provider for new servers. Legacy authorization-server helpers are frozen under the legacy package.

This does not itself select a hosted or self-hosted provider; it is an architectural signal that embedding a new authorization server directly in the bridge would add a separate security responsibility rather than being the normal SDK path.

## ChatGPT client facts relevant to the decision

Current ChatGPT app flows support OAuth for remote MCP servers. OpenAI documents user-defined confidential OAuth clients for self-managed app integrations, with an exact callback URI generated by ChatGPT and a client ID/secret configured in the app setup. Current third-party MCP integration guides also expose the same `User-Defined OAuth Client` flow for custom MCP apps.

Therefore **pre-registration is a viable client-registration category to investigate**, rather than assuming CIMD or DCR is mandatory for ChatGPT. Exact behavior for the final custom MCP app should still be validated in a real draft app before production commitment.

## ProConnect compatibility result

ProConnect remains a strong candidate for the **institutional identity source**, but the compatibility tranche in `docs/PROCONNECT-MCP-COMPAT-RESULTS.md` establishes that it cannot currently be used directly as the MCP authorization server while remaining conformant with MCP 2026-07-28.

### Positive evidence

Current public ProConnect implementation evidence establishes that:

- it implements OpenID Connect Authorization Code Flow;
- it supports PKCE with `S256` (`pkce.methods: ["S256"]`);
- its repository contains end-to-end PKCE scenarios;
- its discovery DTO includes `code_challenge_methods_supported`;
- it exposes/implements token introspection for Resource Server use;
- service providers receive a pre-registered `client_id` and `client_secret`;
- redirect URIs are registered explicitly and must match exactly;
- it issues access tokens and refresh tokens;
- production use involves a ProConnect service-provider registration process / DataPass and production client credentials.

PKCE is therefore **not** the blocker identified by this evaluation.

### Blocking evidence

The current public ProConnect OIDC-provider configuration explicitly contains:

```text
resourceIndicators: { enabled: false }
```

MCP 2026-07-28 requires OAuth Resource Indicators (RFC 8707) so that the client requests an access token for the canonical MCP resource. A direct ProConnect authorization-server architecture therefore lacks the mandatory MCP resource-indicator/audience-binding mechanism in the current configuration.

This is stronger evidence than a documentation omission: the relevant feature is explicitly disabled in the implementation assessed on 2026-09-17.

A live integration probe remains useful only if:

- ProConnect later enables Resource Indicators;
- there is evidence that the deployed environment differs from the assessed public configuration;
- a later release must be revalidated end-to-end.

It is **not required merely to decide the current architecture**.

## Candidate architecture A — ProConnect directly as the MCP authorization server

```text
ChatGPT / Codex
      |
 OAuth client
      |
      v
 ProConnect
      |
 access token
      v
grist-chatgpt resource server
```

### Current status

**Not viable with the current ProConnect OIDC-provider configuration.**

Reason: RFC 8707 Resource Indicators are disabled, while MCP 2026-07-28 requires the client to use them to identify the target MCP resource.

This architecture may be reconsidered only if ProConnect enables Resource Indicators and the resulting tokens can be shown to be bound to the canonical `grist-chatgpt` MCP resource.

Its advantages remain relevant if that changes in the future:

- authentication UX directly based on the institutional identity service;
- no extra authorization-server product solely for the bridge;
- potentially simple pre-registered ChatGPT OAuth client integration.

Architecture A is therefore **closed for the current decision, but revalidatable on a future ProConnect change**.

## Candidate architecture B — dedicated MCP authorization server federated to ProConnect

```text
ChatGPT / Codex
      |
   OAuth 2.1
      |
      v
 dedicated MCP authorization server
      |
 OIDC login/federation
      v
  ProConnect

 dedicated MCP authorization server
      |
 bridge-scoped, audience-bound access token
      v
grist-chatgpt resource server
```

In this architecture ProConnect supplies user authentication/identity, while a separate authorization server owns the OAuth contract presented to MCP clients.

The dedicated authorization server would be responsible for MCP-facing behavior such as:

- protected-resource-compatible issuer/discovery metadata;
- PKCE support;
- RFC 8707 `resource` / audience binding;
- bridge scopes;
- access/refresh-token lifetimes and rotation;
- supported client-registration mechanism(s);
- token issuer/JWKS or introspection contract consumed by `grist-chatgpt`.

Questions for the human decision include which authorization-server implementation should be used, whether it may be managed externally or should be self-hosted, who operates it, and whether federating to ProConnect creates acceptable institutional obligations.

No specific authorization-server product is selected by this document.

## Candidate architecture C — dedicated MCP authorization server with another identity source

```text
ChatGPT / Codex
      |
   OAuth 2.1
      |
      v
 dedicated authorization/identity provider
      |
 bridge-scoped access token
      v
grist-chatgpt
```

This avoids depending on ProConnect as the identity source, but changes the institutional identity model. The human decision would need to establish whether that is acceptable for the DINUM/education deployment, what user population is intended, and what operational/data-governance obligations the selected provider creates.

No provider is selected here.

## Candidate architecture D — bridge-owned authorization server

The bridge could in principle implement or host its own authorization-server functions and authenticate users through an upstream identity source. This would put OAuth authorization-server security, token issuance, refresh lifecycle, client registration and consent/session behavior inside the bridge's operational responsibility.

The current MCP TypeScript SDK guidance favors a dedicated identity provider for new servers rather than its frozen legacy authorization-server helpers. Selecting an embedded/custom authorization server should therefore be an explicit human architecture decision, not an incidental extension of `src/server.ts`.

## Compatibility probe retained for revalidation

The repository now contains a bounded compatibility probe:

- `src/compat/proconnectMcp.ts`;
- `tools/proconnect-mcp-probe.ts`;
- `docs/PROCONNECT-MCP-COMPAT.md`;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`.

It can inspect discovery metadata and execute controlled authorization variants for:

1. baseline Authorization Code flow;
2. PKCE S256;
3. RFC 8707 `resource`;
4. MCP-shaped PKCE + `resource`.

Raw access tokens, refresh tokens and ID tokens are not written to probe output or committed files.

The live procedure should be used if direct ProConnect is reconsidered after a provider change. No production registration or DataPass commitment should be made merely to run such a revalidation without explicit human approval.

## Human decision questions

A human must now answer these questions before `feat/oauth-mcp` becomes eligible:

1. **Identity source:** should ProConnect remain the production identity source? The current product direction strongly favors yes, but this remains an explicit institutional choice.
2. **OAuth architecture:** given that direct ProConnect is currently incompatible with mandatory RFC 8707, should the project adopt a dedicated MCP authorization server federated to ProConnect (architecture B), another identity/authorization provider (C), or a bridge-owned authorization server (D)?
3. **Authorization-server product/operator:** if architecture B is selected, which product/service should implement the MCP-facing authorization server, and may it be managed externally, self-hosted, or either subject to evaluation?
4. **Client population:** is production interoperability required only for ChatGPT/Codex with a pre-registered OAuth client, or also for generic MCP clients that benefit from CIMD/DCR?
5. **Session UX:** what refresh/re-authentication policy is acceptable for the intended users?
6. **Institutional ownership:** who is authorized to register the production ProConnect/OAuth applications and accept any DataPass or equivalent institutional obligations?

The human decision should select an **architecture and authorization-server category/provider** without altering the existing bridge scope vocabulary or Grist credential model unless a separate explicit decision authorizes that.

## Decision record template

Fill this section only after the human gate is resolved:

```text
Decision date:
Decision owner:
Identity source:
OAuth authorization server / provider:
Architecture: federated dedicated AS / other
Client registration mechanism: CIMD / pre-registration / DCR compatibility
Expected ChatGPT callback model:
Token validation: JWT+JWKS / introspection / other
MCP resource/audience identifier:
Refresh/offline-access policy:
Bridge scopes: doc:read, doc:write, doc.schema:write (unchanged)
Static bearer development mode retained: yes/no
Institutional owner / required approvals:
Key reasons:
Known risks / follow-up checks:
```

Once this record is filled by an authorized human decision, update `docs/ROADMAP.md` durably before starting provider-specific C4 implementation.

## Sources reviewed

### MCP / SDK

- MCP specification 2026-07-28 — Authorization: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/index.mdx
- MCP specification 2026-07-28 — Security considerations: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx
- MCP 2026-07-28 release notes: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- TypeScript SDK v2 — server authorization guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/authorization.md

### OpenAI / ChatGPT

- Developer mode and MCP apps in ChatGPT: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- Example of ChatGPT user-defined confidential OAuth client configuration (GitLab Self-Managed template): https://help.openai.com/en/articles/20001487-setting-up-the-gitlab-self-managed-app-template-for-chatgpt-and-codex

### ProConnect

- Service-provider documentation: https://partenaires.proconnect.gouv.fr/docs/fournisseur-service
- OIDC implementation / authorization code flow: https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/implementation_technique
- Refresh-token behavior: https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/refresh-token
- Scope / claims documentation: https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/scope-claims
- ProConnect domain/environment values: https://partenaires.proconnect.gouv.fr/docs/ressources/valeur_ac_domain
- Public federation implementation assessed on 2026-09-17: `proconnect-gouv/federation` commit `0ddb96fc538834409866dd6c8c7d1313cff44e6d`
- Public OIDC provider configuration: `back/libs/oidc-provider/src/services/oidc-provider-config.service.ts`
- Public discovery DTO: `quality/cypress/support/api/dto/get-discovery.dto.ts`

### Repository compatibility evidence

- `docs/PROCONNECT-MCP-COMPAT.md`
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`
