# Security model

## Security objective

`grist-chatgpt` must let an assistant build and maintain Grist applications only with authority intentionally granted to the authenticated principal, within the deployment resource boundary, the permissions of the **current user's own Grist identity**, the accepted application managed scope and the active execution mandate.

Authorization and effect control are layered and server-side; they are never delegated to the model or to the Builder's own reasoning.

The current bounded bridge remains the execution substrate. The frozen Agentic Builder target adds an independent Execution Engine boundary; it does not weaken any current credential, scope, resource-policy or Grist-permission control.

See also [Product Vision](PRODUCT_VISION.md), [Architecture](ARCHITECTURE.md), [Execution Engine J0/J1](EXECUTION-ENGINE-J0-J1.md), [OAuth operating model](OAUTH-OPERATIONS.md) and the [authoritative roadmap](ROADMAP.md).

## Trust and authorization boundaries

### Production identity principle

The selected multi-user product model for Grist Community DINUM is:

> each authenticated `grist-chatgpt` user executes upstream Grist operations with that user's own Grist API key.

A shared technical Grist account is not the production target.

Current effective authority is the intersection of:

```text
permissions of the user's Grist API key
∩ deployment resource policy
∩ principal resource grants
∩ required operation capability / OAuth scope
```

For contractual Builder execution, authority is further reduced by the accepted application contract/managed scope, mandate, plan budgets and capability-specific preconditions. No Builder or Execution Engine rule may increase upstream authority.

### Builder / Execution Engine separation

The Builder reasons about user intent and proposes changes. It is not an authorization authority.

The Execution Engine is the effect-control boundary for capabilities declared part of the contractual Builder surface. Before effectful work it must enforce, as applicable:

- immutable execution/plan/contract identity;
- current principal/resource authorization;
- accepted mandate and `ManagedScope`;
- cumulative plan budgets;
- capability preconditions and expected state;
- declared concurrency protection or isolation requirements;
- durable write-ahead effect recording;
- capability-specific verification and recovery rules.

The Builder cannot weaken those controls, silently relabel an unsupported capability as supported, or treat missing evidence as permission to proceed.

### Grist credentials

A Grist API key has the permissions of its owner and is therefore a high-value secret.

**Current development control:** `GRIST_API_KEY` remains server-side only and is resolved through `StaticApiKeyCredentialProvider`. It is never an MCP/GPT parameter, OpenAPI value, prompt value or client-visible secret.

**Production target:** a user-aware `GristCredentialProvider` resolves the current authenticated principal's own Grist credential. Each request/service context must use only the credential associated with that principal.

A Grist API key must never appear in:

- ChatGPT/Codex conversation content;
- MCP tool inputs or outputs;
- GPT Actions/OpenAPI parameters;
- `structuredContent`;
- application/execution evidence exposed to the model;
- audit events;
- general application logs;
- error payloads.

### Secure credential onboarding

Users must not paste Grist API keys into model conversations.

The C5 production target is a separate secure bridge-owned flow:

1. authenticate the plugin user;
2. open a secure bridge-owned Connect Grist page;
3. submit the API key directly to the bridge;
4. validate it against the configured Grist Community instance;
5. associate the verified Grist identity with the authenticated principal;
6. store the API key encrypted;
7. expose a disconnect/removal path;
8. support rotation/revalidation without exposing the secret to the model.

Persistence technology and encryption/key-management architecture remain explicit human gates under `docs/ROADMAP.md` / `docs/C5-DECISION.md`.

J0/J1 may be developed in an isolated controlled environment before C5. That exception does not permit a second real production user to rely on the shared static Grist credential path as if it provided per-user isolation.

### Credential and cache isolation

C3 separates shareable deployment policy from state derived from a Grist credential.

`DeploymentResourcePolicy` contains only the configured document/workspace ceiling and is safe to share. `GristContextFactory.create(principal)` resolves a credential for exactly that principal and creates a fresh `GristClient`, `GristResourceDiscovery` cache, `AccessPolicy`, authorization layer and service graph. The factory deliberately does not retain/reuse principal contexts.

In the current personal/development deployment, different bridge principals still resolve to the same configured Grist API key. Their client/discovery/service contexts are distinct, but that shared upstream credential means the deployment must not be treated as production multi-user isolation. C5 replaces this development substitution with per-principal credentials.

Any client, document discovery result, cache, application evidence or authorization input derived from one user's Grist key must remain isolated by that principal/credential or be reconstructed safely.

### Deployment resource boundary

The Grist identity may access more documents than a specific deployment should expose.

The deployment policy permits only configured document IDs/workspaces through:

- `GRIST_ALLOWED_DOCUMENT_IDS`;
- `GRIST_ALLOWED_WORKSPACE_IDS`.

This ceiling is independent of the user's Grist ACLs and remains useful in production.

### Client principal boundary

An authenticated bridge client is represented as a `Principal` with the fixed current capabilities:

- `doc:read`;
- `doc:write`;
- `doc.schema:write`.

**MCP OAuth mode is already implemented and validated in C4-P0.** It derives dynamic principals/scopes from validated OAuth tokens. Static MCP bearer remains an explicit development/backward-compatibility mode. GPT Actions remains a static-bearer compatibility adapter.

Capabilities can only reduce upstream authority. A `doc:read` principal cannot write even if the upstream Grist key could. Adding/removing a public scope remains a human product/security gate.

### Bridge authentication

`/mcp` and `/api/v1` remain separate entry points.

For MCP:

- `MCP_AUTH_MODE=oauth` validates JWT/JWKS, issuer, audience/resource, expiry and required scopes and builds a dynamic principal;
- `MCP_AUTH_MODE=static` uses `MCP_BEARER_TOKEN` only for development/backward compatibility;
- OAuth bearer tokens are never forwarded into the Grist credential boundary.

For GPT Actions compatibility:

- `GPT_ACTION_TOKEN` identifies the static `chatgpt-actions` principal;
- `GPT_ACTION_CAPABILITIES` constrains its bridge authority.

The validated C4-P0 identity path is Logto OSS as MCP-facing authorization server federated to ProConnect. C4 now concerns productionization and operating evidence, not identity-provider selection.

### Grist upstream permissions

After bridge authorization succeeds, Grist still evaluates the current upstream API-key permissions. `grist-chatgpt` cannot legitimately elevate them.

A future bounded application-specific access-policy capability may author or reconcile only the exact Grist policy state accepted by its `BehavioralContract`, `ManagedScope`, capability contract and roadmap tranche. This is not generic organization/user/ACL administration and does not replace Grist as the final permission-enforcement authority.

## Operation policy registry

`src/operations/registry.ts` is authoritative for each current operation's required capability and risk metadata. Authorization, `grist_help`, MCP registration and submission annotation generation consume this common registry.

A capability promoted into the Builder must additionally declare its preconditions, effects, permissions, concurrency mode, verification, recovery and supported environment/version. Existing v1 operation metadata is not by itself a sufficient Builder execution contract.

## Powerful operations

### Data writes and deletion

Create/update/delete record operations require `doc:write`.

Deletion accepts only explicit unique numeric record IDs; there is no delete-by-filter operation.

Large operations may use sequential internal batches. They are **not atomic as a group**. Blind whole-operation replay after partial or uncertain effect is forbidden.

J0 strengthens the effect model so:

- a first-batch transport ambiguity is `UNCERTAIN`, not flattened into a generic failure;
- confirmed results/stable IDs from successful earlier batches survive later failure or uncertainty;
- uncertain and not-yet-started batches remain distinguishable;
- public results remain data-minimized while internal recovery state retains only what is necessary.

Successful update/delete responses remain minimized semantic acknowledgements containing stable targets needed for safe reconciliation. Creation responses retain functional created IDs.

### Schema mutation

Table/column mutations require `doc.schema:write` and are bounded by `GRIST_MAX_SCHEMA_ITEMS`.

The bridge supports bounded table/column creation, update/deletion, column-ID rename, types, formulas and widget metadata. Fixed internal `/apply` actions such as `RenameColumn` and `RemoveTable` return bounded semantic acknowledgements rather than raw engine response payloads.

### Document UI mutation

Bounded UI operations require `doc.schema:write` and currently include page creation, supported native widget creation, page rename/layout, widget title/description/chart type, saved sort, select-by, existing custom-widget access/mappings and table/grid display options.

The model never receives raw Grist metadata-table write access, arbitrary custom-widget option payloads or internal numeric column refs as write inputs. Safety-sensitive UI mutations fail closed when the current bounded metadata snapshot or required normalized state is incomplete. Ambiguous post-write state must not trigger blind replay.

Current read-modify-write paths that rewrite a complete value may overwrite a concurrent human change even when their final re-read equals the bridge's value. J0 therefore requires contractual concurrency classification: an overwrite-sensitive capability must have an effective tested protection, run only in a justified isolated mode, or refuse the protected mode. An extra read or post-write equality is not sufficient to claim `PROTECTED`.

New page/widget deletion or broader destructive UI surfaces remain human-gated unless a later explicit roadmap/capability contract authorizes a bounded form.

### Low-level Grist actions

Raw `/api/docs/{docId}/apply` is never exposed to ChatGPT/MCP. Fixed bridge methods may use known UserActions internally only behind specifically named bounded operations. The model cannot choose arbitrary UserAction types/payloads.

## Semantic document inspection

`inspect_document` / `inspectGristDocument` requires `doc:read` and returns structural metadata without reading user-table rows.

Current advisory context includes tables/columns/formulas, bounded formula diagnostics, normalized relationships, normalized page/widget state and explicit incompleteness markers instead of guessed metadata.

Formula inspection never executes Python/formulas and does not add a code-execution surface.

Application-level evidence must distinguish what is known, partial and unknown. Missing metadata or failed verification does not become a guessed success.

## Generic escape hatches remain excluded

### Arbitrary HTTP

There is no generic URL/method tool. `GRIST_BASE_URL` is process configuration, preventing the bridge from becoming a model-driven HTTP proxy/SSRF primitive.

### Raw SQL

No SQL execution capability is exposed.

### Raw administration

The product does not expose unrestricted instance/organization/user administration or generic ACL administration.

Application-specific access-policy work is permitted only when a future explicit contract fixes the exact policy semantics, target, managed scope, authority, verification and recovery. It must not become a generic permission-management escape hatch.

### Arbitrary code and integrations

The Builder roadmap does not automatically authorize arbitrary generated executable code, arbitrary network destinations, webhook targets or new public scopes. J5 remains dependency- and capability-gated; each supported integration must declare exact artifacts/destinations/permissions and recovery semantics.

### Model-visible credentials

No tool accepts or returns a Grist API key. Credential onboarding is outside model-visible tool surfaces.

## Guardrails, mandates and budgets

Current default per-operation deployment guardrails include:

- `GRIST_MAX_READ_RECORDS=5000`;
- `GRIST_MAX_WRITE_RECORDS=500`;
- `GRIST_WRITE_BATCH_RECORDS=200`;
- `GRIST_MAX_SCHEMA_ITEMS=100`.

For `MAX_*` settings, `0` means no bridge-side maximum; Grist/upstream limits still apply.

J1 additionally proves cumulative **per-plan** budgeting so a Builder cannot exceed an accepted budget by splitting work across multiple otherwise-valid operations. Authorization/mandate is re-checked before resumed/new effects.

Explicit Grist upstream abort timeout and bounded inbound HTTP request/header reception are already integrated. Remaining C6 work includes per-principal rate limiting, operational metrics/alerting, audit export if required, secret/key rotation and controlled production deployment/rollback evidence.

## Effect knowledge, replay and recovery

For Builder execution, failure and effect knowledge are separate concepts.

The minimum semantic distinction is:

```text
NOT_APPLIED
CONFIRMED
UNCERTAIN
```

If the system cannot prove that an effect was not applied, it must not report `NOT_APPLIED`.

Recovery is capability-specific and uses durable journal evidence plus current observable state. The system must never implement a generic rule equivalent to `if step failed then replay step`. If ambiguity cannot be reconciled safely, execution suspends for human reconciliation.

## Verification evidence

Verification is property-scoped, contextual evidence, not a global success flag. Durable evidence records the relevant property, criticality, verdict, execution/plan identity, target state/revision when observable, identity used, verification method, timestamp and dependencies needed for later invalidation.

A critical property cannot be silently weakened after execution begins. Changing critical criteria creates a new contract/plan version.

## MCP annotations and client approval

Annotations describe actual operation effects but never grant permission:

- audited reads use `readOnlyHint: false` because the audit event is a state change, while `grist_help` remains the only unaudited `readOnlyHint: true` operation;
- destructive update/rename/clear/delete operations use `destructiveHint: true` as appropriate;
- current operations remain confined to the configured Grist environment, so `openWorldHint: false`.

OAuth scopes, principal grants, deployment policy, application mandate/managed scope and Grist permissions remain independent enforcement layers.

GPT Actions `x-openai-isConsequential` is an approval/UX concern for the compatibility adapter, not a server-side security boundary.

## Prompt injection and returned data

Grist cell contents are untrusted data, not instructions. Server-side authorization and execution contracts are unaffected by returned row content.

Model-facing discovery/schema outputs are projected to stable functional metadata rather than forwarding arbitrary Grist internal fields. Success-only mutation results are similarly minimized. Functional IDs required to target/verify bounded operations may remain model-visible.

## Error handling

Public errors must not contain secrets, stack traces or irrelevant internal infrastructure details.

Safety semantics include:

- explicit partial and uncertain writes;
- retention of confirmed stable identifiers/results needed for reconciliation;
- no blind replay after partial/non-atomic/uncertain effect;
- non-retryable verification disagreement where replay is unsafe;
- minimized public payloads distinct from durable internal recovery evidence.

## Structured audit

Every current operation routed through `AuthorizedGristService` emits bounded JSON operational metadata such as request ID, principal, transport, operation, capability, document ID, item count, status, duration and error type.

Audit excludes bearer tokens, Grist API keys, LinkKeys/query secrets and full row contents. Before successful resource resolution, a raw `documentIdOrUrl` must not be copied into audit; a non-secret failure classification may be recorded instead.

Mutation audit must distinguish ordinary failure, confirmed partial effect and uncertain effect when those states are material. A production institutional deployment may route the same bounded event shape to centralized audit infrastructure.

## Current validated personal/development deployment

```text
ChatGPT MCP client
   |
   | OAuth via Logto / ProConnect
   | (static MCP bearer optional in development)
   v
personal VPS bridge
   |
   | StaticApiKeyCredentialProvider
   | one server-side Grist API key
   v
Grist Community DINUM
```

This is appropriate for one trusted developer. OAuth identity and principal-scoped bridge contexts are validated; the shared upstream Grist credential remains the reason it is not yet production multi-user isolation.

## Secret handling

Never commit, paste into conversations, log or return:

- Grist API keys;
- `MCP_BEARER_TOKEN`;
- `GPT_ACTION_TOKEN`;
- OAuth access/refresh tokens;
- session cookies;
- LinkKeys/query secrets beyond the exact browser/request context that legitimately requires them;
- credential-encryption keys;
- private signing keys;
- real OpenAI domain-verification tokens.

Use protected environment/secret management for infrastructure secrets and, once C5 is decided, encrypted credential storage for per-user Grist API keys.

## Core invariant

> The Builder may propose what should change, but it cannot authorize its own effects. ChatGPT/Codex authenticates a user to `grist-chatgpt`; in production `grist-chatgpt` uses only that user's Grist credential upstream; Grist remains authoritative for upstream permissions; and every effect must pass server-side resource/capability authorization plus the applicable application mandate, managed scope, budgets, concurrency, durable effect-knowledge, verification and recovery controls. Every layer may only reduce authority, never expand it.