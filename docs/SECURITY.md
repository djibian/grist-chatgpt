# Security model

## Security objective

The bridge should let an assistant use only the Grist power intentionally granted to its authenticated bridge principal, within the deployment resource boundary and the permissions of the **current user's own Grist identity**.

Authorization is layered and server-side; it is never delegated to the model.

See also [Plugin-ready audit](PLUGIN-READY-AUDIT.md), [Architecture](ARCHITECTURE.md) and [OAuth operating model](OAUTH-OPERATIONS.md).

## Trust and authorization boundaries

### Production identity principle

The selected multi-user product model for Grist Community DINUM is:

> each authenticated `grist-chatgpt` user executes upstream Grist operations with that user's own Grist API key.

A shared technical Grist account is not the production target.

Effective authority is the intersection of:

```text
permissions of the user's Grist API key
∩ deployment resource policy
∩ principal resource grants
∩ required operation capability / OAuth scope
```

The bridge may reduce authority but must never grant authority the user's Grist identity does not possess.

### Grist credentials

A Grist API key has the permissions of its owner and is therefore a high-value secret.

**Current development control:** `GRIST_API_KEY` remains server-side only and is resolved through `StaticApiKeyCredentialProvider`. It is never an MCP/GPT parameter, OpenAPI value, prompt value or client-visible secret.

**Production target:** a user-aware `GristCredentialProvider` resolves the current authenticated principal's own Grist credential. Each request/service context must use only the credential associated with that principal.

A Grist API key must never appear in:

- ChatGPT/Codex conversation content;
- MCP tool inputs or outputs;
- GPT Actions/OpenAPI parameters;
- `structuredContent`;
- audit events;
- general application logs;
- error payloads.

### Secure credential onboarding

Users must not paste Grist API keys into model conversations.

The C5 production target is a separate secure bridge-owned flow:

1. authenticate the plugin user;
2. open a secure bridge-owned Connect Grist page;
3. submit the API key directly to the bridge;
4. validate it against the configured DINUM Grist instance;
5. associate the verified Grist identity with the authenticated principal;
6. store the API key encrypted;
7. expose a disconnect/removal path;
8. support rotation/revalidation without exposing the secret to the model.

Persistence technology and encryption/key-management architecture remain explicit human gates under `docs/ROADMAP.md` / `docs/C5-DECISION.md`.

### Credential and cache isolation

C3 separates shareable deployment policy from state derived from a Grist credential.

`DeploymentResourcePolicy` contains only the configured document/workspace ceiling and is safe to share. `GristContextFactory.create(principal)` resolves a credential for exactly that principal and creates a fresh `GristClient`, `GristResourceDiscovery` cache, `AccessPolicy`, authorization layer and service graph. The factory deliberately does not retain/reuse principal contexts.

In the current personal/development deployment, different bridge principals still resolve to the same configured Grist API key. Their client/discovery/service contexts are distinct, but that shared upstream credential means the deployment must not be treated as production multi-user isolation. C5 replaces this development substitution with per-principal credentials.

Any client, document discovery result, cache or authorization input derived from one user's Grist key must remain isolated by that principal/credential or be reconstructed safely.

### Deployment resource boundary

The Grist identity may access more documents than a specific bridge deployment should expose.

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

Capabilities can only reduce upstream authority. A `doc:read` principal cannot write even if the upstream Grist key could.

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

After bridge authorization succeeds, Grist still evaluates the current upstream API-key permissions. The bridge does not recreate Grist ACLs and cannot legitimately elevate them.

## Operation policy registry

`src/operations/registry.ts` is authoritative for each operation's required capability and risk metadata. Authorization, `grist_help`, MCP registration and submission annotation generation consume this common registry.

## Powerful operations

### Data writes and deletion

Create/update/delete record operations require `doc:write`.

Deletion accepts only explicit unique numeric record IDs; there is no delete-by-filter operation.

Large operations may use sequential internal batches. They are **not atomic as a group**. A later failure after earlier success reports completed work; the full request must not be blindly replayed.

Successful update/delete responses are minimized to semantic acknowledgements containing only the stable targets needed for safe reconciliation. Creation responses retain functional created IDs. Upstream engine-only response data must not be forwarded unnecessarily.

### Schema mutation

Table/column mutations require `doc.schema:write` and are bounded by `GRIST_MAX_SCHEMA_ITEMS`.

The bridge supports bounded table/column creation, update/deletion, column-ID rename, types, formulas and widget metadata. Column deletion may partially succeed and preserves explicit partial-operation semantics.

Fixed internal `/apply` actions such as `RenameColumn` and `RemoveTable` return bounded semantic acknowledgements rather than raw engine response payloads.

### Document UI mutation

Bounded UI operations require `doc.schema:write` and currently include:

- page creation;
- supported native widget creation;
- page rename;
- widget title/description update and description clearing;
- native chart-type configuration for chart widgets;
- saved sort configuration through stable current column IDs;
- direct same-table select-by configuration;
- bounded Ref/RefList column select-by configuration using advertised stable widget/column IDs;
- bounded custom-widget access and column-mapping updates for an explicitly identified existing custom widget, using stable current column IDs and preserving URL/plugin/widget identity plus unrelated options;
- bounded table/grid display updates for vertical/horizontal gridlines, zebra stripes and row-number mode while preserving unrelated widget options.

The model never receives raw Grist metadata-table write access, arbitrary custom-widget option payloads or internal numeric column refs as write inputs. Safety-sensitive UI mutations fail closed when the current bounded metadata snapshot or required normalized state is incomplete. Writes are followed by exact normalized or complete expected-state re-read verification; ambiguous post-write state must not trigger blind replay.

Bounded page-layout mutation is the remaining committed P1 slice and is not part of `main` until its review/integration gate passes. New page/widget deletion or broader destructive UI surfaces remain human-gated.

### Low-level Grist actions

Raw `/api/docs/{docId}/apply` is never exposed to ChatGPT/MCP. Fixed bridge methods may use known UserActions internally only behind specifically named bounded operations. The model cannot choose arbitrary UserAction types/payloads.

## Semantic document inspection

`inspect_document` / `inspectGristDocument` requires `doc:read` and returns structural metadata without reading user-table rows.

Current advisory context includes:

- tables/columns/formulas;
- bounded local `$Column` diagnostics;
- bounded one-hop `$Ref.Field` / `$RefList.Field` diagnostics against already-loaded schema;
- normalized relationships and verified reverse relationships;
- bounded normalized page layout through stable current widget IDs, with explicit incompleteness for unsupported/stale state;
- normalized page/widget sort and select-by state where exact resolution is possible;
- normalized existing custom-widget access/identity/column mappings and table/grid display state where exact resolution is possible;
- explicit incompleteness markers instead of guessed metadata.

Formula inspection never executes Python/formulas and does not add a code-execution surface.

## Generic escape hatches remain excluded

### Arbitrary HTTP

There is no generic URL/method tool. `GRIST_BASE_URL` is process configuration, preventing the bridge from becoming a model-driven HTTP proxy/SSRF primitive.

### Raw SQL

No SQL execution capability is exposed.

### Raw administration

The bridge does not expose unrestricted instance administration or user/ACL administration.

### Model-visible credentials

No tool accepts or returns a Grist API key. Credential onboarding is outside model-visible tool surfaces.

## Guardrails and timeouts

Current default deployment guardrails include:

- `GRIST_MAX_READ_RECORDS=5000`;
- `GRIST_MAX_WRITE_RECORDS=500`;
- `GRIST_WRITE_BATCH_RECORDS=200`;
- `GRIST_MAX_SCHEMA_ITEMS=100`.

For `MAX_*` settings, `0` means no bridge-side maximum; Grist/upstream limits still apply.

Explicit Grist upstream abort timeout and bounded inbound HTTP request/header reception are already integrated. Remaining C6 work includes per-principal rate limiting, operational metrics/alerting, audit export if required, secret/key rotation and controlled production deployment/rollback evidence.

## MCP annotations and client approval

Annotations describe actual operation effects but never grant permission:

- audited reads use `readOnlyHint: false` because the audit event is a state change, while `grist_help` remains the only unaudited `readOnlyHint: true` operation;
- destructive update/rename/clear/delete operations use `destructiveHint: true` as appropriate;
- operations remain confined to the configured Grist environment, so `openWorldHint: false`.

OAuth scopes, principal grants, deployment policy and Grist ACLs remain independent enforcement layers.

GPT Actions `x-openai-isConsequential` is an approval/UX concern for the compatibility adapter, not a bridge security boundary.

## Prompt injection and returned data

Grist cell contents are untrusted data, not instructions. Server-side authorization is unaffected by returned row content.

Model-facing discovery/schema outputs are projected to stable functional metadata rather than forwarding arbitrary Grist internal fields. Success-only mutation results are similarly minimized. Functional IDs required to target/verify bounded operations may remain model-visible.

## Error handling

Public errors must not contain secrets, stack traces or irrelevant internal infrastructure details.

Safety semantics include:

- explicit partial writes and completed work;
- no blind replay after partial/non-atomic success;
- ambiguous UI writes are non-retryable at whole-operation level;
- functional stable IDs may be returned where required for safe reconciliation.

## Structured audit

Every operation routed through `AuthorizedGristService` emits bounded JSON operational metadata such as request ID, principal, transport, operation, capability, document ID, item count, status, duration and error type.

Audit excludes bearer tokens, Grist API keys and full row contents. A production institutional deployment may route the same bounded event shape to centralized audit infrastructure.

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
- credential-encryption keys;
- private signing keys;
- real OpenAI domain-verification tokens.

Use protected environment/secret management for infrastructure secrets and, once C5 is decided, encrypted credential storage for per-user Grist API keys.

## Core invariant

> ChatGPT/Codex authenticates a user to the bridge; the bridge uses only that user's stored Grist credential for upstream work; Grist remains authoritative for the user's ACLs; and the bridge may only reduce authority through deployment policy, grants, scopes/capabilities and bounded semantic operations.
