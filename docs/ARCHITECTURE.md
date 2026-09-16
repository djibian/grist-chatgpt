# Architecture

## Objective

`grist-chatgpt` is a controlled compatibility bridge between conversational AI clients and **Grist Community**, with the DINUM / La Suite numérique Grist Community instance as the first production target.

It keeps authentication, authorization, guardrails and Grist credentials server-side while exposing named bounded operations. It is not intended to reproduce the whole Grist API or become a generic model-driven remote-control proxy.

The long-term product contract is MCP-first. GPT Actions/OpenAPI remain a useful development and compatibility surface during the prototype phase.

See [Plugin-ready audit — Grist Community / DINUM](PLUGIN-READY-AUDIT.md) for the product-readiness assessment and [User-aware Grist contexts](USER-CONTEXT.md) for the C3 context-isolation boundary.

## Current architecture

```text
ChatGPT GPT Actions                 MCP client
        |                               |
        +---------------+---------------+
                        |
                        v
                transport adapters
                        |
                        v
              Principal / capabilities
                        |
                        v
                GristContextFactory
                  |               |
                  |               +--> GristClientFactory
                  |                       |
                  |                       v
                  |              GristCredentialProvider
                  |                       |
                  |                       v
                  |                   GristClient
                  |                       |
                  |               GristResourceDiscovery
                  |                       |
                  |                       v
                  +--------------> AccessPolicy
                                          |
                                          v
                                 AuthorizationService
                                          |
                                          v
                                AuthorizedGristService
                                   |              |
                                   |              +--> AuditLogger
                                   v
                                  GristService
                                   |              |
                                   v              v
                              REST calls     bounded /apply
                                            UserActions only
                                   +--------------+
                                          |
                                          v
                                   Grist Community
```

`DeploymentResourcePolicy` is shared because it contains only configured document/workspace ceilings. Every `GristContextFactory.create(principal)` call creates a fresh credential-derived client, discovery cache, access policy and service graph for that principal.

The current development deployment still uses static bridge bearer principals and one configured `GRIST_API_KEY` through `StaticApiKeyCredentialProvider`. Those are prototype substitutions, not the final multi-user credential model.

## Product architecture target

The selected production model for Grist Community DINUM is:

```text
                 ChatGPT / Codex
                        |
                     OAuth 2.1
                        |
                        v
                grist-chatgpt MCP
                        |
              dynamic user Principal
               scopes + resource grants
                        |
                        v
                GristContextFactory
                        |
              +---------+---------+
              |                   |
              v                   v
      AuthorizationService   GristCredentialProvider
              |                   |
              v                   | per-user Grist API key
   AuthorizedGristService         v
              |              GristClient
              +---------+---------+
                        |
             REST + bounded actions
                        |
                        v
              Grist Community DINUM
```

This product specifically targets the Community-edition gap where the official Grist MCP/OAuth integration is not available. Where an official Grist MCP integration is available and sufficient, equivalent bridge functionality should not be duplicated without a clear additional product need.

## Responsibility boundaries

### Transport adapters

GPT Actions and MCP translate protocol-specific calls into the same service methods. No Grist authorization rule should depend on the transport implementation itself.

MCP is the intended primary public product contract. GPT Actions should remain an adapter rather than a source of core business rules.

### Principal

Each authenticated bridge client is represented as a `Principal` with:

- a stable internal ID;
- a transport;
- one or more resource grants;
- Grist-aligned capabilities.

The current single-user deployment creates two static principals from bearer tokens. The plugin-ready target replaces the production MCP static principal with an OAuth-authenticated dynamic principal.

### Capabilities

The initial vocabulary is:

```text
doc:read
doc:write
doc.schema:write
```

Semantics:

- `doc:read`: document discovery, tables/columns, semantic context, page/widget inspection and record reads;
- `doc:write`: record creation/update/deletion;
- `doc.schema:write`: table/column/document-UI structural mutations.

These capabilities are candidates for the OAuth scopes of the production plugin. They deliberately express bridge authority, not the raw power of a user's Grist API key.

### Deployment resource policy

`DeploymentResourcePolicy` defines which configured documents and/or workspaces this bridge may expose at all. It contains no Grist client, credential-derived visibility or cache and is therefore safe to share between principals.

Within one principal context, `GristResourceDiscovery` learns only the resources visible through that context's Grist credential, and `AccessPolicy` intersects those discoveries with the deployment ceiling. Explicit configured document IDs retain the existing direct-target behavior, while the actual upstream Grist call still uses the current principal's credential and remains subject to Grist ACLs.

The authorization model is the intersection of:

1. deployment policy for the DINUM bridge;
2. resources/operations permitted by the current user's Grist API key;
3. principal resource grants;
4. the operation's required capability/scope.

Authorization must fail closed if any layer denies access.

### AuthorizationService

`AuthorizationService` intersects the context-bound `AccessPolicy`, principal grants and the operation capability.

Because each `AccessPolicy` belongs to one fresh principal context, authorization cannot reuse discovered Grist visibility from another principal. Grist itself remains the final authority on the upstream operation executed with the current context's credential.

### Operation registry

`src/operations/registry.ts` is authoritative for operation policy metadata:

- operation name;
- category;
- required capability;
- read-only flag;
- destructive flag;
- concise purpose.

`AuthorizedGristService` obtains capability requirements from this registry, and `grist_help` exposes the same metadata.

The plugin-ready direction is to extend this shared contract so that OAuth scope mapping and MCP annotations/descriptions cannot drift independently.

### AuthorizedGristService

This facade preserves Grist business behavior while adding:

- capability enforcement;
- resource authorization;
- principal identity;
- structured audit.

This remains the correct place for transport-neutral model authorization.

### GristCredentialProvider

C1 introduced the server-side credential boundary used for upstream Grist access.

Each authenticated production user must execute upstream Grist operations with **that user's own Grist API key**. The current abstraction is:

```text
Principal
   |
   v
GristCredentialProvider
   |
   v
credential belonging to this Grist user
   |
   v
GristClientFactory
   |
   v
GristClient / principal context
```

`StaticApiKeyCredentialProvider` preserves today's single-user `GRIST_API_KEY` development deployment. A future user-aware provider can resolve a different credential per authenticated principal without changing the Grist business layer.

Any user-aware provider must never return another principal's credential and must never expose the secret to the model.

### GristContextFactory and user isolation

C3 introduces `GristContextFactory` as the lifecycle boundary for credential-derived Grist state.

For every `create(principal)` call it constructs a fresh:

- credential-derived `GristClient`;
- `GristResourceDiscovery` and private discovery cache;
- `AccessPolicy` bound to the shared static deployment ceiling;
- `AuthorizationService`;
- `GristService` and `GristUiActionsAdapter`;
- `AuthorizedGristService` bound to the exact principal.

The factory deliberately retains no user context cache. Clients, discovered-resource sets, caches and authorization facts learned under one credential therefore cannot become visibility state for another principal. Explicit two-principal tests cover this boundary.

### GristService

`GristService` remains the transport-neutral business layer for validated data/schema behavior:

- read/write/schema guardrails;
- exact-target deletion;
- write batching;
- explicit partial-success errors;
- validation of identifiers and counts.

### Document UI layer

v0.6 adds bounded document UI support while preserving the no-escape-hatch invariant:

- normalized page/widget inspection;
- bounded page creation;
- bounded native widget creation;
- page rename;
- widget title update;
- conservative direct `select-by` linking;
- post-write normalized re-read verification.

Raw Grist metadata tables and arbitrary UserActions remain hidden from the model.

### GristClient and low-level actions

`GristClient` owns explicit REST calls.

Raw `/apply` remains inaccessible to models. It may be used internally only behind fixed named operations with known action shapes, such as `RenameColumn` or `RemoveTable`, and future bounded UI operations must preserve the same principle.

## MCP tool contract

The MCP surface is the normative public API direction of the product.

Each product tool should define a stable contract including:

- name;
- user-intent-oriented title and description;
- input schema;
- output schema where useful;
- structured result form;
- required capability/OAuth scope;
- read-only/destructive/open-world annotations;
- typed error behavior.

Descriptions should explain what the user can accomplish and relevant constraints, not internal `UserAction` mechanics.

## Secure Grist credential onboarding

The user's Grist API key must never be a model-visible input.

The target onboarding path is a separate bridge-owned web flow:

```text
OAuth-authenticated plugin user
        |
        v
secure "Connect Grist" page
        |
        v
user submits API key directly to bridge
        |
        v
bridge validates it against configured Grist Community DINUM
        |
        v
verified Grist identity associated with principal
        |
        v
encrypted credential storage
```

The credential must never enter prompts, MCP inputs/outputs, audit events, general logs or error payloads.

A product-level disconnect operation must delete the stored bridge credential association; Grist-level API-key revocation/regeneration remains independently available to the user.

Persistence technology and encryption/key-management architecture remain human-gated decisions under the roadmap.

## Semantic document context

`DocumentContextService` provides a compact structural representation intended for reasoning before complex modifications.

It reports tables, columns, formulas, `Ref`/`RefList` relationships and, in v0.6, normalized page/widget context without reading user-table rows.

This separation remains useful for both privacy and tool selection.

## Audit model

Every operation routed through `AuthorizedGristService` emits one structured JSON event containing operational metadata such as request ID, principal, transport, operation, capability, document ID, item count, status, duration and error type.

Cell values, bearer tokens and Grist API keys must never be intentionally logged by the audit layer.

The institutional deployment may route the same event shape to centralized audit infrastructure.

## Current personal/development deployment

The validated prototype remains intentionally simple:

```text
ChatGPT / MCP client
   |
   | static bridge bearer
   v
personal VPS bridge
   |
   | StaticApiKeyCredentialProvider
   | one server-side Grist API key
   v
Grist Community DINUM
```

This is appropriate for one trusted developer validating the bridge. Its internal contexts are now principal-isolated, but the shared static credential is still only a development/backward-compatible identity substitute and must not be confused with the final multi-user production identity model.

## Institutional/product target

The initial production target is **multi-user for one configured DINUM Grist Community instance**, not a general multi-tenant router for arbitrary Grist installations.

This keeps one stable MCP service boundary while allowing each authenticated user to operate through their own Grist identity and ACLs.

## Deliberate exclusions

The bridge continues to exclude:

- generic HTTP forwarding;
- raw SQL;
- arbitrary `/apply` / UserActions;
- unrestricted instance administration;
- user/ACL administration;
- model-visible Grist API keys;
- bridge-managed recreation of Grist ACLs;
- arbitrary multi-tenant routing across unrelated Grist instances.

## Near-term architecture roadmap

Identity/security work remains ahead of additional Grist feature breadth:

1. **DONE:** credential abstraction and credential-aware client construction (C1);
2. **DONE:** MCP contract-v1 metadata/structured-result hardening (C2);
3. **DONE:** principal-isolated Grist clients, discovery caches and service contexts (C3);
4. **BLOCKED by human gate:** select the OAuth/identity-provider approach, then implement OAuth 2.1 MCP authentication and dynamic principals (C4);
5. **BLOCKED by C4 and human persistence/encryption decisions:** secure per-user Grist credential onboarding/storage/disconnect (C5);
6. production observability, rate limits and release controls;
7. synthetic reviewer fixture and plugin submission package.

Layout mutation, page/widget deletion and further UI breadth remain lower priority than identity/security readiness.

## Architectural invariant

> Every capability exposed to a model must correspond to a named Grist operation with explicit server-side resource authorization, an explicit required capability and predictable bounded effects. In production, ChatGPT/Codex authenticates the user to the bridge; the bridge authenticates that same user to Grist Community with the user's own API key; Grist remains authoritative for upstream permissions; and the bridge may only reduce that authority.
