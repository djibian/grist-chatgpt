# C4 OAuth / identity-provider decision package

**Status:** research and human-decision input only — this document does **not** select an identity provider or authorize provider-specific implementation.  
**Research baseline updated:** 2026-09-17  
**Project baseline:** C1, C2 and C3 integrated; C4 core implementation remains blocked by the human identity-provider decision.

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
8. No provider-specific production implementation starts until the selection is made explicitly by a human.

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

Current ChatGPT app flows support OAuth for remote MCP servers. OpenAI documents user-defined confidential OAuth clients for self-managed app integrations, with an exact callback URI generated by ChatGPT and a client ID/secret configured in the app setup.

Therefore **pre-registration is a viable client-registration category to investigate**, rather than assuming CIMD or DCR is mandatory for ChatGPT. Exact behavior for the final custom MCP app should still be validated in a real draft app before production commitment.

## ProConnect compatibility evidence now established

The bounded compatibility work integrated through PR #20 is recorded in:

- `docs/PROCONNECT-MCP-COMPAT.md`;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`;
- `src/compat/proconnectMcp.ts`;
- `tools/proconnect-mcp-probe.ts`.

The assessed public ProConnect federation implementation at commit `0ddb96fc538834409866dd6c8c7d1313cff44e6d` establishes two important facts for MCP `2026-07-28`:

- PKCE `S256` is configured and supported by public implementation evidence;
- the OIDC provider explicitly configures `resourceIndicators: { enabled: false }`.

Because MCP `2026-07-28` requires RFC 8707 Resource Indicators and requires the MCP client to send the target `resource` during authorization/token acquisition, **ProConnect in the assessed configuration cannot be used directly as the MCP-facing authorization server while remaining conformant with that mandatory flow**.

This is a technical compatibility finding, not a human provider selection. It does **not** decide whether ProConnect should remain the upstream identity source, and it does not choose the authorization server/product that would sit at the MCP boundary.

Direct ProConnect may be reconsidered only if a future deployment enables RFC 8707 Resource Indicators and the resulting access token is demonstrably bound to the canonical MCP resource. The repository probe exists for that revalidation.

## Architecture A — ProConnect directly as the MCP authorization server

**Current status: ruled out for the assessed ProConnect configuration.**

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

The blocker is not PKCE. The assessed ProConnect authorization server disables RFC 8707 Resource Indicators, while MCP `2026-07-28` requires them.

This architecture is therefore not an active candidate unless ProConnect changes that capability or reliable evidence demonstrates that the deployed environment differs materially from the assessed public configuration.

## Architecture B — dedicated MCP authorization server federated to ProConnect

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

This architecture remains behind the human gate because the project has not selected ProConnect as the required identity source, has not selected a dedicated authorization-server product, and has not decided who operates it.

## Architecture C — dedicated MCP authorization server with another identity source

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

This avoids depending on ProConnect as the identity source. The human decision must establish whether that is acceptable for the intended DINUM/education population and what operational/data-governance obligations the selected provider creates.

No provider is selected here.

## Architecture D — bridge-owned authorization server

The bridge could in principle implement or host its own authorization-server functions and authenticate users through an upstream identity source. This would put OAuth authorization-server security, token issuance, refresh lifecycle, client registration and consent/session behavior inside the bridge's operational responsibility.

The current MCP TypeScript SDK guidance favors a dedicated identity provider for new servers rather than its frozen legacy authorization-server helpers. Selecting an embedded/custom authorization server therefore remains an explicit human architecture decision, not an incidental extension of `src/server.ts`.

## Remaining compatibility work after the human architecture decision

Once an architecture/provider is selected, perform a bounded non-production compatibility probe covering:

1. **ChatGPT callback / registration**
   - create a draft custom MCP app;
   - record the exact callback URI;
   - verify the intended pre-registration/CIMD/DCR path.

2. **Authorization-server metadata**
   - issuer;
   - authorization and token endpoints;
   - `code_challenge_methods_supported` including `S256`;
   - supported scopes;
   - supported token-endpoint authentication methods;
   - refresh/offline-access capability;
   - RFC 9207 capability if advertised.

3. **Authorization request**
   - PKCE challenge accepted;
   - MCP `resource` parameter accepted;
   - requested bridge scopes accepted or an explicit mapping exists;
   - exact ChatGPT redirect URI accepted.

4. **Token response / validation**
   - access token expiry;
   - refresh token behavior and rotation;
   - issuer validation;
   - token is bound to the canonical MCP resource/audience;
   - effective scopes can be recovered and enforced;
   - another-resource token is rejected.

5. **Bridge behavior**
   - verified token maps to a dynamic `Principal`;
   - principal scopes reduce authority correctly;
   - `GristContextFactory` receives that exact principal;
   - MCP/OAuth token is never forwarded to Grist;
   - static bearer development mode remains an explicitly separate compatibility path if retained.

No production registration, DataPass submission or institutional commitment should be made merely to run this decision process without explicit human approval.

## Human decision questions

A human must answer at least these questions before `feat/oauth-mcp` becomes eligible:

1. **Identity source:** Must production users authenticate through ProConnect, or may another identity source be used?
2. **OAuth architecture:** Given that direct ProConnect is ruled out for the assessed configuration, should an MCP-specific authorization server federate to ProConnect, should another identity/authorization provider be used, or should another explicitly approved architecture be pursued?
3. **Authorization-server operator:** If a separate server is used, may it be managed externally, must it be self-hosted, or is either acceptable subject to later evaluation?
4. **Client population:** Is production interoperability required only for ChatGPT/Codex with a pre-registered OAuth client, or also for generic MCP clients that benefit from CIMD/DCR?
5. **Session UX:** What reauthentication/refresh behavior is acceptable for production users?
6. **Institutional ownership:** Who is authorized to register any production OAuth/ProConnect application and accept any DataPass or equivalent institutional obligations?

The human decision should select an **architecture and provider category/provider**, not alter the existing bridge scope vocabulary or Grist credential model unless a separate explicit decision authorizes that.

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

## Sources and evidence

### Repository evidence

- `docs/PROCONNECT-MCP-COMPAT.md`
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`
- `src/compat/proconnectMcp.ts`
- `tools/proconnect-mcp-probe.ts`

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
- Public federation implementation snapshot assessed by PR #20: `0ddb96fc538834409866dd6c8c7d1313cff44e6d`
