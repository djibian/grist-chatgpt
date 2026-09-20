# Architecture

## Objective

`grist-chatgpt` is a controlled compatibility bridge between conversational AI clients and **Grist Community**, with the DINUM / La Suite numérique Grist Community instance as the first production target.

It keeps authentication, authorization, guardrails and Grist credentials server-side while exposing named bounded operations. It is not intended to reproduce the whole Grist API or become a generic model-driven remote-control proxy.

The long-term product contract is MCP-first. GPT Actions/OpenAPI remain a development and compatibility adapter.

See [Plugin-ready audit](PLUGIN-READY-AUDIT.md), [User-aware Grist contexts](USER-CONTEXT.md), [OAuth operating model](OAUTH-OPERATIONS.md) and the [authoritative roadmap](ROADMAP.md).

## Current architecture

```text
GPT Actions compatibility                 MCP client
        |                                     |
        +------------------+------------------+
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

`DeploymentResourcePolicy` contains only configured document/workspace ceilings and is safe to share. Every `GristContextFactory.create(principal)` call creates fresh credential-derived client, discovery/cache, access policy and service state for that principal.

The completed C4-P0 deployment authenticates MCP users through Logto OSS federated with ProConnect and constructs dynamic OAuth principals. Static MCP bearer remains an explicit development/backward-compatibility mode; GPT Actions remains a static-bearer compatibility adapter. All current paths still resolve the same configured `GRIST_API_KEY` through `StaticApiKeyCredentialProvider` in the personal/development deployment. That shared upstream Grist credential is the remaining prototype substitution, not the final multi-user model.

## Product architecture target

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

The product targets the Community-edition gap where the official Grist MCP/OAuth integration is unavailable or insufficient. Where an official integration is available and sufficient, equivalent bridge functionality should not be duplicated without a clear additional product need.

## Responsibility boundaries

### Transport adapters

GPT Actions and MCP translate protocol-specific calls into the same service methods. No Grist authorization rule depends on the transport itself. MCP is the primary product contract; GPT Actions is compatibility/development surface.

### Principal and capabilities

Each authenticated bridge client is represented as a `Principal` with stable internal identity, transport, resource grants and Grist-aligned capabilities.

MCP OAuth mode constructs dynamic principals from validated issuer/subject and scopes. Static MCP mode and GPT Actions use static principals only for development/compatibility.

Fixed public capability vocabulary:

```text
doc:read
doc:write
doc.schema:write
```

- `doc:read`: discovery, tables/columns, semantic context, page/widget inspection and record reads;
- `doc:write`: record creation/update/deletion;
- `doc.schema:write`: table/column/document-UI structural mutations.

### Deployment resource policy and authorization

`DeploymentResourcePolicy` defines the maximum documents/workspaces the bridge may expose. Within one principal context, `GristResourceDiscovery` learns only resources visible through that context's Grist credential, and `AccessPolicy` intersects those discoveries with the deployment ceiling.

Effective authority is the intersection of:

1. deployment resource policy;
2. permissions of the current user's Grist API key;
3. principal resource grants;
4. operation capability/OAuth scope.

Authorization fails closed if any layer denies access. Grist itself remains authoritative on the final upstream operation.

### Operation registry

`src/operations/registry.ts` is authoritative for operation policy metadata: name, category, capability, audit-aware read-only status, destructive status, open-world status, title, summary and description.

The same registry drives authorization/help/MCP metadata and submission annotation generation so those surfaces do not drift independently.

### AuthorizedGristService

This facade adds capability enforcement, resource authorization, principal identity, structured audit and public result projection around the transport-neutral Grist business layer.

Recent data-minimization work ensures model-facing discovery metadata and success-only mutation results do not forward arbitrary upstream/internal engine fields. Functional stable identifiers required for follow-up work remain available.

### GristCredentialProvider

C1 introduced the server-side credential boundary:

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

`StaticApiKeyCredentialProvider` preserves the current single-upstream-key development deployment. C5 will provide secure per-user credential onboarding/storage/retrieval/disconnect after the human persistence/encryption decisions are made.

### GristContextFactory and user isolation

Every `create(principal)` call constructs a fresh credential-derived `GristClient`, `GristResourceDiscovery` cache, `AccessPolicy`, `AuthorizationService`, `GristService`, UI adapter and `AuthorizedGristService` bound to that principal.

The factory deliberately retains no shared user context cache. Credential-derived clients, discoveries and authorization facts therefore cannot cross principal boundaries.

### GristService

`GristService` owns validated data/schema behavior including read/write/schema guardrails, exact-target deletion, write batching, partial-success errors, validation of identifiers/counts and semantic result projection.

Large record operations may use sequential non-atomic batches. Partial failure reports completed work and forbids blind replay of the complete operation.

### Document UI layer

The bounded UI layer now includes:

- normalized page/widget inspection;
- bounded normalized page-layout inspection through stable current widget IDs, with collapsed/unplaced IDs and explicit incompleteness instead of guessed state;
- empty page creation;
- supported native widget creation;
- page rename;
- widget title and description update, including explicit description clearing;
- native chart-type configuration for chart widgets;
- saved sort configuration using stable current column IDs and bounded sort flags;
- conservative direct same-table select-by linking;
- bounded Ref/RefList column select-by linking through advertised stable widget/column IDs;
- normalized saved-sort and select-by inspection;
- normalized existing custom-widget access/widget identity/column mappings, with bounded mutation limited to access and stable-ID column mappings while preserving untargeted options;
- normalized table/grid display options for gridlines, zebra stripes and row-number mode, with bounded mutation that preserves unrelated widget options;
- post-write normalized re-read verification for every current UI mutation.

Discovery/mutation enforce bounded layout/option/candidate/schema limits, reject unsupported, ambiguous or incomplete state before safety-sensitive writes, and never expose arbitrary metadata-table writes, custom-option payloads or arbitrary UserActions.

The remaining committed P1 slice is bounded page-layout mutation. It is not part of `main` until its review/integration gate passes; broader destructive UI surfaces remain outside the current integrated contract.

### Semantic document context

`DocumentContextService` builds compact structural context without reading user-table rows. Current context includes:

- tables/columns/formulas;
- local `$Column` diagnostics;
- bounded one-hop `$Ref.Field` / `$RefList.Field` diagnostics using already-loaded schema metadata;
- forward Ref/RefList relationships plus verified reverse relationships when exact bidirectional metadata is available;
- normalized page/widget context including page layout, sort, select-by, custom-widget settings and grid display state where exact resolution is possible;
- explicit incompleteness markers when raw metadata cannot be normalized safely.

No formula execution, Python interpreter, raw SQL or indiscriminate row loading is introduced.

### GristClient and low-level actions

`GristClient` owns explicit REST calls. Raw `/apply` is inaccessible to models. It may be used internally only behind fixed named bounded operations with known action shapes, such as `RenameColumn`, `RemoveTable` and specific UI actions.

Raw `/apply` engine response bodies are not propagated through the corresponding model-facing semantic operations.

## MCP tool contract

Each public MCP tool should have a stable user-intent contract covering:

- name/title/description;
- input schema;
- output schema where a stable normalized shape is ready;
- structured result form where applicable;
- required capability/OAuth scope;
- read-only/destructive/open-world annotations;
- typed error behavior.

The UI tool family already exposes stable structured successful results. Record/schema update/delete service results are now minimized semantic acknowledgements, while creation operations retain functional created identifiers; broader `outputSchema` coverage remains separate contract work.

## OAuth architecture

The C4 identity-provider gate is resolved:

- ProConnect is the upstream institutional identity source;
- Logto OSS self-hosted is the reference MCP-facing authorization server;
- `grist-chatgpt` remains a provider-neutral OAuth resource server using standard JWT/JWKS validation;
- direct ProConnect is ruled out for the assessed configuration because RFC 8707 Resource Indicators are disabled there;
- Auth0 EU and Curity Standard remain documented fallbacks.

C4-P0 has passed with real ChatGPT Developer Mode. C4 is now productionization/operating-evidence work, not provider selection.

## Secure Grist credential onboarding

The production C5 target is a separate bridge-owned flow:

```text
OAuth-authenticated user
        |
        v
secure Connect Grist page
        |
        v
API key submitted directly to bridge
        |
        v
validate against configured Grist Community instance
        |
        v
associate verified Grist identity with principal
        |
        v
encrypted credential storage
```

The credential must never enter prompts, MCP/GPT inputs/outputs, audit events, general logs or error payloads. Persistence technology and encryption/key management remain human-gated.

## Audit and observability

Every operation routed through `AuthorizedGristService` emits a bounded JSON audit event containing operational metadata such as request ID, principal, transport, operation, capability, document ID, item count, status, duration and error type. Cell values and secrets are excluded.

C6 preparation also documents low-cardinality metrics vocabulary, release/rollback procedure and non-secret OAuth smoke checks. Per-principal rate limiting, operational alerting/export, key rotation and controlled production evidence remain later C6 work.

## Current personal/development deployment

```text
ChatGPT MCP client
   |
   | OAuth via Logto / ProConnect
   | (static bearer optional for development)
   v
personal VPS bridge
   |
   | StaticApiKeyCredentialProvider
   | one server-side Grist API key
   v
Grist Community DINUM
```

This is suitable for one trusted developer validating the product. OAuth identity and internal contexts are real/principal-aware; the shared upstream Grist credential still prevents treating this deployment as production multi-user isolation.

## Deliberate exclusions

The bridge excludes generic HTTP forwarding, raw SQL, arbitrary `/apply`/UserActions, unrestricted instance administration, user/ACL administration, model-visible credentials, bridge-managed recreation of Grist ACLs, and arbitrary routing across unrelated Grist instances.

## Near-term architecture roadmap

1. **C1 DONE:** credential abstraction and credential-aware client construction.
2. **C2 DONE:** MCP contract-v1 metadata/structured-result hardening.
3. **C3 DONE:** principal-isolated clients, discoveries, caches and service contexts.
4. **C4-P0 DONE; C4 ELIGIBLE:** productionize the proven Logto/ProConnect OAuth path with repeatable deployment/rotation/outage evidence.
5. **C5 BLOCKED by C4 + human persistence/encryption decisions:** secure per-user Grist credential lifecycle.
6. **C6 preparation integrated; finalization blocked by C4/C5:** rate limits, operational metrics/alerts, rotation and controlled release evidence.
7. **P1 ELIGIBLE:** only its committed bounded page-layout mutation slice remains; **P2 and P3 are DONE** and P4 waits for P1's integrated completion review.
8. S0 public-directory eligibility remains a separate human/institutional distribution gate.

## Architectural invariant

> Every capability exposed to a model must correspond to a named Grist operation with explicit server-side resource authorization, an explicit required capability and predictable bounded effects. In production, ChatGPT/Codex authenticates the user to the bridge; the bridge authenticates that same user to Grist Community with the user's own API key; Grist remains authoritative for upstream permissions; and the bridge may only reduce that authority.
