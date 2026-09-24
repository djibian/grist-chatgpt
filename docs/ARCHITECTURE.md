# Architecture

## Objective

`grist-chatgpt` is an **agentic Grist application builder and lifecycle maintainer** for Grist Community, with the DINUM / La Suite numérique Grist Community instance as the first production target.

The current narrow MCP bridge is the execution substrate, not the whole product identity. It keeps authentication, authorization, guardrails and Grist credentials server-side while exposing named bounded operations. The target architecture adds a Builder that reasons over explicit application contracts and an Execution Engine that independently enforces authority, budgets, effect knowledge, concurrency, verification and recovery before connectors reach Grist.

The product is not intended to reproduce the whole Grist API or become a generic model-driven remote-control proxy. MCP is the primary product contract; GPT Actions/OpenAPI remain a development and compatibility adapter.

The product mission and invariants are authoritative in [Product Vision](PRODUCT_VISION.md). Current tranche eligibility is authoritative in [Roadmap](ROADMAP.md). J0/J1 execution semantics are specified in [Execution Engine J0/J1](EXECUTION-ENGINE-J0-J1.md).

## Current implemented substrate

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

The completed C4-P0 deployment authenticates MCP users through Logto OSS federated with ProConnect and constructs dynamic OAuth principals. Static MCP bearer remains an explicit development/backward-compatibility mode; GPT Actions remains a static-bearer compatibility adapter. All current paths still resolve the same configured `GRIST_API_KEY` through `StaticApiKeyCredentialProvider` in the personal/development deployment. That shared upstream Grist credential is a prototype substitution, not the final multi-user model.

## Target product architecture

```text
                     ChatGPT / Codex
                            |
                         OAuth 2.1
                            |
                            v
                    Agentic Builder
          intent + ApplicationContract + evidence
                            |
                            v
                    Execution Engine
       mandate / budgets / journal / effect knowledge
       concurrency / verification / recovery / audit
                            |
              +-------------+-------------+
              |                           |
              v                           v
       Grist connector              later bounded
   current authorized services      integrations
              |
              v
       Principal / capabilities
              |
              v
       GristContextFactory
          |             |
          v             v
 AuthorizationService  GristCredentialProvider
          |             | per-user Grist API key
          v             v
 AuthorizedGristService / GristClient
              |
       REST + bounded actions
              |
              v
       Grist Community DINUM
```

The layers have distinct authority:

- **Builder:** proposes and maintains an application from accepted intent and contracts. It does not grant itself permission and cannot weaken the execution contract.
- **Execution Engine:** authoritative effect-control boundary. It validates immutable plan/contract identity, authorization, cumulative budgets, expected state, concurrency mode, durable effect knowledge, verification and recovery before any effect is dispatched.
- **Connectors:** perform only declared bounded effects against Grist or a later explicitly supported integration. They do not decide business intent or expand authority.

J0 stabilizes the current mutation substrate before the Builder itself is implemented. J1 proves the first durable contractual transformation. J2 then applies those semantics to the stage-tracking reference application. Later J3-J6 generalize only capabilities proven under the roadmap.

The existing public narrow v1 MCP operations remain a compatibility/execution substrate. J0-J6 do not imply a generic super-tool, arbitrary `/apply`, arbitrary UserActions, generic HTTP or unrestricted administration.

## Application contract model

A managed application is defined by explicit versioned contract material rather than conversation memory. The target contract includes:

- `ApplicationModel`: logical objects, relationships and intended structure;
- `BehavioralContract`: critical externally observable properties and business semantics;
- `ImpactGraph`: dependencies that make a change relevant to other managed properties;
- `ManagedScope`: the exact parts of the application the Builder is allowed to manage.

Logical identity must remain stable across physical Grist identifiers. Human changes outside `ManagedScope` are preserved. Human changes inside managed scope are reconciled against accepted intent and observed current state rather than overwritten blindly.

Application/execution state is multidimensional: observed state, intended state, effect knowledge and verification evidence are not collapsed into one global success Boolean.

## Responsibility boundaries

### Transport adapters

GPT Actions and MCP translate protocol-specific calls into the same bounded service layer. No Grist authorization rule depends on the transport itself. MCP is the primary product contract; GPT Actions is compatibility/development surface.

### Principal and capabilities

Each authenticated client is represented as a `Principal` with stable internal identity, transport, resource grants and Grist-aligned capabilities.

MCP OAuth mode constructs dynamic principals from validated issuer/subject and scopes. Static MCP mode and GPT Actions use static principals only for development/compatibility.

Fixed current public capability vocabulary:

```text
doc:read
doc:write
doc.schema:write
```

- `doc:read`: discovery, tables/columns, semantic context, page/widget inspection and record reads;
- `doc:write`: record creation/update/deletion;
- `doc.schema:write`: table/column/document-UI structural mutations.

Changing the public scope vocabulary remains a separate human/product-security decision.

### Deployment resource policy and authorization

`DeploymentResourcePolicy` defines the maximum documents/workspaces the deployment may expose. Within one principal context, `GristResourceDiscovery` learns only resources visible through that context's Grist credential, and `AccessPolicy` intersects those discoveries with the deployment ceiling.

Effective current authority is the intersection of:

1. deployment resource policy;
2. permissions of the current user's Grist API key;
3. principal resource grants;
4. operation capability/OAuth scope.

The future Execution Engine adds accepted mandate/plan budgets and application managed scope as additional reducing constraints; it may never expand the upstream authority granted by these layers.

Authorization fails closed if any layer denies access. Grist remains authoritative on the final upstream operation.

### Operation registry

`src/operations/registry.ts` is authoritative for current operation policy metadata: name, category, capability, audit-aware read-only status, destructive status, open-world status, title, summary and description.

The same registry drives authorization/help/MCP metadata and submission annotation generation so those surfaces do not drift independently.

### AuthorizedGristService

This facade adds capability enforcement, resource authorization, principal identity, structured audit and public result projection around the transport-neutral Grist business layer.

Current data-minimization work ensures model-facing discovery metadata and success-only mutation results do not forward arbitrary upstream/internal engine fields. Functional stable identifiers required for follow-up work remain available.

J0 strengthens this boundary so first-write ambiguity, confirmed partial results, safe audit-target normalization and concurrency guarantees/refusal can be represented correctly for contractual execution.

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

`GristService` owns validated data/schema behavior including read/write/schema guardrails, exact-target deletion, write batching, partial-success handling, validation of identifiers/counts and semantic result projection.

Large record operations may use sequential non-atomic batches. The current implementation is the substrate J0 is explicitly stabilizing: uncertainty must be distinguished from proven no-effect failure and confirmed earlier results/identifiers must survive later failure or uncertainty. Blind whole-operation replay remains forbidden.

### Document UI layer

The bounded UI layer includes normalized page/widget inspection and bounded mutation for page layout, supported native widgets, rename/title/description, chart type, saved sort, select-by, existing custom-widget access/mappings and table/grid display options.

Inputs use stable current widget/column IDs where appropriate. Discovery/mutation enforce bounded layout/option/candidate/schema limits, reject unsupported, ambiguous or incomplete state before safety-sensitive writes, and never expose arbitrary metadata-table writes, custom-option payloads or arbitrary UserActions.

Current post-write verification proves the resulting value but does not by itself prove preservation of a concurrent human modification. J0 therefore classifies overwrite-sensitive read-modify-write paths and either supplies an effective tested protection for contractual mode or refuses that protected mode.

### Semantic document context

`DocumentContextService` builds compact structural context without reading user-table rows. Current context includes tables/columns/formulas, bounded formula diagnostics, relationships, normalized page/widget state and explicit incompleteness markers where exact normalization is unavailable.

No formula execution, Python interpreter, raw SQL or indiscriminate row loading is introduced.

### GristClient and low-level actions

`GristClient` owns explicit REST calls. Raw `/apply` is inaccessible to models. It may be used internally only behind fixed named bounded operations with known action shapes.

Raw `/apply` engine response bodies are not propagated through the corresponding model-facing semantic operations.

## Execution Engine contract

The Execution Engine is introduced incrementally by J0/J1 and is the mandatory path for capabilities declared part of the contractual Builder surface.

Its core rules are:

- immutable execution, plan and contract identity;
- authorization/mandate re-check before effectful work and resumed work;
- cumulative per-plan budgets, not only per-call limits;
- durable write-ahead effect journal before dispatch;
- explicit `NOT_APPLIED` / `CONFIRMED` / `UNCERTAIN` effect knowledge;
- preservation of confirmed stable identifiers/results;
- no blind replay after uncertain or partial effects;
- declared concurrency protection, isolation or refusal rather than a false guarantee;
- contextual property verification evidence rather than a global `success=true`;
- capability-specific reconciliation/recovery, with suspension when ambiguity cannot be resolved safely.

Secrets and unnecessary business payloads are not copied into public errors, audit or durable evidence merely for convenience.

## MCP tool contract

Each public MCP tool has a stable user-intent contract covering name/title/description, input schema, structured result/output shape where supported, required capability/OAuth scope, risk annotations and typed error behavior.

The v1 tool surface remains the compatibility substrate after the P4 KEEP decision. A future Builder may orchestrate bounded capabilities internally, but it must not expose a broad multi-action super-tool that obscures authority, partial effects or risk semantics without a separately reviewed contract.

## OAuth architecture

The C4 identity-provider gate is resolved:

- ProConnect is the upstream institutional identity source;
- Logto OSS self-hosted is the reference MCP-facing authorization server;
- `grist-chatgpt` remains a provider-neutral OAuth resource server using standard JWT/JWKS validation;
- direct ProConnect is ruled out for the assessed configuration because RFC 8707 Resource Indicators are disabled there;
- Auth0 EU and Curity Standard remain documented fallbacks.

C4-P0 has passed with real ChatGPT Developer Mode. C4 is productionization/operating-evidence work, not provider selection.

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

J0/J1 may be developed in an isolated controlled environment before C5. That is an engineering dependency exception only; it does not make the shared static credential suitable for real multi-user production.

## Audit and observability

Every current operation routed through `AuthorizedGristService` emits a bounded JSON audit event containing operational metadata such as request ID, principal, transport, operation, capability, normalized authorized document ID when available, item count, status, duration and error type. Cell values and secrets are excluded.

J0 additionally requires that rejected raw `documentIdOrUrl` values are not logged before safe target resolution and that uncertain/partial effect knowledge is not flattened into a clean no-effect error.

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

The architecture excludes:

- generic HTTP forwarding;
- raw SQL model surfaces;
- arbitrary `/apply` or arbitrary UserActions;
- unrestricted instance/organization/user administration;
- generic ACL administration outside an explicit accepted ApplicationContract and ManagedScope;
- model-visible credentials or secrets;
- deletion by broad filter when explicit stable identifiers can be required;
- blind automatic replay of partial/ambiguous writes;
- arbitrary routing across unrelated Grist instances in the initial product.

A future bounded application-specific access-policy capability may exist only when its exact semantics, authority, managed scope, verification and recovery are explicitly accepted by the relevant Builder contract and roadmap tranche. That is not permission for generic ACL/user administration.

## Architecture roadmap

Authoritative status is in `docs/ROADMAP.md`. The dependency shape is:

```text
PLATFORM / SECURITY       PRODUCT / EXECUTION
C4 -> C5 -> C6            P0-P4 DONE
                          -> J0 -> J1 -> J2 -> J3 -> J4 -> J5 -> J6
```

- C4 remains eligible production OAuth operating evidence.
- C5 remains blocked by C4 plus human persistence/encryption/key-management decisions.
- C6 remains blocked by C4/C5 for finalization.
- J0 is the finite next product-runtime tranche after roadmap reconciliation.
- J1-J6 remain dependency-gated and do not become eligible early.
- S0/S1/C7/C8 remain a separate public-distribution path.

## Architectural invariant

> The Builder may propose intent, but it never grants itself authority. Every effect must pass an independent server-side execution boundary with explicit target, capability, resource authorization, mandate/managed-scope limits, bounded effects, durable effect knowledge and verification/recovery semantics. In production, ChatGPT/Codex authenticates the user to `grist-chatgpt`; the bridge uses only that user's Grist credential upstream; Grist remains authoritative for upstream permissions; and every `grist-chatgpt` layer may only reduce that authority.