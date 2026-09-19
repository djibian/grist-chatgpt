# Security model

## Security objective

The bridge should let an assistant use only the Grist power intentionally granted to its authenticated bridge principal, within the deployment resource boundary and the permissions of the **current user's own Grist identity**.

Authorization is deliberately layered rather than delegated to the model.

See also [Plugin-ready audit — Grist Community / DINUM](PLUGIN-READY-AUDIT.md).

## Trust and authorization boundaries

### Production identity principle

The selected multi-user product model for Grist Community DINUM is:

> each authenticated `grist-chatgpt` user executes upstream Grist operations with that user's own Grist API key.

A shared technical Grist account is not the target production design.

The effective authority is therefore the intersection of:

```text
permissions of the user's Grist API key
∩ deployment resource policy
∩ principal resource grants
∩ required operation capability / OAuth scope
```

The bridge may reduce authority but must never grant authority that the user's Grist identity does not possess.

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

Users must not paste Grist API keys into the model conversation.

The production onboarding path should be a separate secure web flow owned by the bridge:

1. authenticate the plugin user;
2. open a secure bridge-owned "Connect Grist" page;
3. submit the API key directly to the bridge;
4. validate it directly against the configured DINUM Grist instance;
5. associate the verified Grist identity with the bridge principal;
6. store the API key encrypted;
7. expose a disconnect action that deletes the stored bridge credential.

A production credential record should associate the principal ID and verified Grist identity with encrypted credential material and non-secret lifecycle metadata. The encryption key must be held in infrastructure secret management rather than application data or source control.

Users retain the independent ability to revoke/regenerate their Grist API key at Grist level.

### Credential and cache isolation

C3 separates shareable deployment policy from every state item derived from a Grist credential.

`DeploymentResourcePolicy` contains only the configured document/workspace ceiling and is safe to share. `GristContextFactory.create(principal)` resolves a credential for exactly that principal and creates a fresh `GristClient`, `GristResourceDiscovery` cache, `AccessPolicy`, authorization layer and service graph. The factory deliberately does not retain or reuse principal contexts.

The current static MCP and GPT Actions principals still resolve through the same configured development API key, but their client/discovery/service contexts are distinct. A future user-aware credential provider can therefore supply different credentials without introducing cross-principal discovery state.

Any Grist client, document discovery result, workspace/document cache or authorization input derived from a user's API key must remain isolated by that credential/principal or reconstructed safely for the request/session.

It must be impossible for resource visibility discovered under user A's key to make a resource visible to user B.

### Deployment resource boundary

The Grist identity may access more documents than a particular DINUM bridge deployment should expose.

**Control:** the deployment policy permits only configured document IDs and/or workspaces through `GRIST_ALLOWED_DOCUMENT_IDS` and `GRIST_ALLOWED_WORKSPACE_IDS` in the current implementation.

This deployment boundary remains useful in the product model and is independent of user ACLs.

### Client principal boundary

An authenticated bridge client is represented as a `Principal`.

Current capabilities are:

- `doc:read`;
- `doc:write`;
- `doc.schema:write`.

The current prototype creates static principals for GPT Actions and MCP. The production MCP target replaces the static MCP identity with OAuth-authenticated dynamic principals.

Capabilities remain meaningful even when the user's Grist API key has broader technical authority. For example, a `doc:read` principal must be prevented from writing even if that user's Grist key could write.

### Bridge authentication

`/mcp` and `/api/v1` are separate entry points today.

**Current prototype control:** MCP uses `MCP_BEARER_TOKEN`; GPT Actions uses `GPT_ACTION_TOKEN`. Both are at least 32 characters and differ.

These current bearer tokens identify static bridge principals; they are not Grist credentials.

**Production MCP target:** use the current MCP-compatible OAuth 2.1 authentication model and derive a dynamic bridge principal and scopes from the authenticated token.

GPT Actions remain a development/compatibility adapter and must not define the product security model.

### Grist upstream permissions

After bridge authorization succeeds, Grist still evaluates the current user's API key permissions.

This is an important final enforcement layer: the bridge does not recreate Grist ACLs and cannot legitimately elevate the user's Grist permissions.

## Operation policy registry

`src/operations/registry.ts` is authoritative for each operation's required capability and risk metadata. The authorization facade reads capability requirements from the same registry exposed through `grist_help`.

The plugin-ready direction is to extend shared metadata so MCP scope and annotation policy cannot silently drift from server-side authorization.

## Powerful operations

### Data writes and deletion

Create/update/delete operations are supported under `doc:write`.

Deletion accepts only explicit unique numeric record IDs; there is no delete-by-filter operation.

Large create/update/delete requests are subject to configurable limits and may be split into sequential internal batches. Those batches are **not atomic as a group**. If a later batch fails after earlier batches succeeded, the bridge reports partial success and clients must not replay the complete operation blindly.

### Schema mutation

Table and column mutations require `doc.schema:write`.

The bridge supports bounded table/column creation, update and deletion, column ID renaming, types, formulas, widget metadata and related Grist schema features.

Schema requests are guarded by the configured per-operation limit.

Column deletion may partially succeed if a later deletion fails; partial-operation semantics must remain explicit.

### Document UI mutation

v0.6 introduces bounded UI operations under `doc.schema:write`:

- page creation;
- native widget creation;
- page rename;
- widget title update;
- conservative direct `select-by` configuration.

The model never receives raw Grist metadata-table write access. Writes are followed by normalized re-read verification; ambiguous post-write state must not trigger blind replay.

### Low-level Grist actions

Grist exposes `/api/docs/{docId}/apply`, a powerful low-level User Action endpoint.

**Control:** raw `/apply` is never exposed to ChatGPT or MCP. Fixed bridge methods may use known UserActions internally only for specifically named bounded operations such as `RenameColumn`, `RemoveTable`, page creation or widget creation.

The model cannot choose an arbitrary UserAction type or payload.

## Semantic document inspection

`inspect_document` / `inspectGristDocument` requires `doc:read` and returns structural metadata: tables, columns, formulas, relationships and normalized page/widget context without reading user-table rows.

This keeps structural reasoning separate from disclosure of business data.

## Generic escape hatches remain excluded

### Arbitrary HTTP

There is no generic URL/method tool. `GRIST_BASE_URL` is process configuration, preventing the bridge from becoming a model-driven HTTP proxy or SSRF primitive.

### Raw SQL

No SQL execution capability is exposed. Grist's documented API and targeted service abstractions remain the supported path.

### Raw administration

The bridge does not expose unrestricted instance administration or user/ACL administration.

### Model-visible credentials

No tool may accept or return a Grist API key. Credential onboarding is outside the model tool surface.

## Guardrails

Current defaults are deployment policy, not permanent product limitations:

- `GRIST_MAX_READ_RECORDS=5000`;
- `GRIST_MAX_WRITE_RECORDS=500`;
- `GRIST_WRITE_BATCH_RECORDS=200`;
- `GRIST_MAX_SCHEMA_ITEMS=100`.

For `MAX_*` settings, `0` means no bridge-side maximum. Grist and upstream infrastructure limits still apply.

Production should additionally provide per-principal rate limiting and explicit request/upstream timeouts.

## MCP annotations and client approval

MCP annotations describe the actual operation:

- audited reads use `readOnlyHint: false` and `destructiveHint: false`; only the unaudited `grist_help` uses `readOnlyHint: true`;
- destructive record/table/column deletion uses `destructiveHint: true`;
- operations confined to the configured private Grist environment use `openWorldHint: false`.

These hints do not grant permission. OAuth scopes, principal grants, deployment policy and Grist ACLs remain independent enforcement layers.

GPT Actions' `x-openai-isConsequential` flag is an approval/UX concern for the temporary GPT Actions adapter, not a bridge security boundary. The server-side authorization model must remain correct regardless of that flag.

`list_documents`, `list_tables`, `list_columns`, `query_records`, `inspect_document`, `get_pages` and `get_page_widgets` retain `doc:read` authorization but declare `readOnlyHint: false`, `destructiveHint: false` and `openWorldHint: false`: their execution appends an audit event without changing Grist user data. Only `grist_help` remains `readOnlyHint: true`. Audit remains enabled; hints do not change OAuth scopes or authorization.

## Prompt injection and returned data

Grist cell contents are untrusted data, not instructions. Authorization checks remain server-side regardless of model output or cell content.

Tool descriptions and structured outputs should avoid encouraging the model to treat returned cell content as operational instructions.

## Error handling

Public errors must not contain secrets, stack traces or irrelevant internal infrastructure details.

The MCP contract should evolve toward stable typed errors while preserving existing safety semantics, especially:

- partial writes are explicit;
- non-atomic completed work is reported;
- ambiguous UI writes are non-retryable at whole-operation level;
- functional resource IDs may be returned when required for safe reconciliation.

## Structured audit

Every operation routed through `AuthorizedGristService` emits a JSON audit event containing operational metadata such as:

- request ID;
- principal ID and transport;
- operation and required capability;
- document ID when applicable;
- item count when meaningful;
- status and duration;
- error type on failure.

The audit layer intentionally excludes bearer tokens, Grist API keys and full row contents.

The production DINUM deployment may route the same event shape to centralized audit infrastructure.

## Prototype deployment

The current validated development architecture is intentionally simple:

```text
ChatGPT / MCP client
   |
   | static bridge bearer
   v
personal VPS bridge
   |
   | one server-side Grist API key
   v
Grist Community DINUM
```

This is appropriate for one trusted developer. It must not be mistaken for the final multi-user credential architecture.

## Institutional/product evolution

The selected target is multi-user access to one configured DINUM Grist Community instance:

```text
ChatGPT / Codex
   |
   | OAuth 2.1
   v
dynamic Principal
   |
   | scopes + grants
   v
AuthorizationService
   |
   v
GristCredentialProvider
   |
   | current user's encrypted Grist API key
   v
Grist Community DINUM
```

The product does not initially need arbitrary multi-tenant routing across unrelated Grist instances.

## Secret handling

Never commit, paste into conversations, log or return:

- Grist API keys;
- `MCP_BEARER_TOKEN`;
- `GPT_ACTION_TOKEN`;
- OAuth access/refresh tokens;
- session cookies;
- credential-encryption keys;
- private signing keys.

Use root-controlled environment files or production secret management for infrastructure secrets, and encrypted credential storage for per-user Grist API keys.

## Core invariant

> ChatGPT/Codex authenticates a user to the bridge; the bridge uses only that user's stored Grist credential for upstream work; Grist remains authoritative for the user's ACLs; and the bridge may only reduce authority through deployment policy, grants, scopes/capabilities and bounded semantic operations.
