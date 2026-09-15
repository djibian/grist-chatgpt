# Security model

## Security objective

The bridge should let an assistant use only the Grist power intentionally granted to its authenticated bridge principal, within the deployment resource boundary and the permissions of the configured Grist identity.

Authorization is deliberately layered rather than delegated to the model.

## Trust and authorization boundaries

### Grist credentials

A Grist API key has the permissions of its owner.

**Control:** `GRIST_API_KEY` is server-side only. It is never an MCP/GPT parameter, OpenAPI value, prompt value or client-visible secret.

### Deployment resource boundary

The Grist identity may access more documents than this bridge should expose.

**Control:** `AccessPolicy` permits only configured document IDs and/or workspaces through `GRIST_ALLOWED_DOCUMENT_IDS` and `GRIST_ALLOWED_WORKSPACE_IDS`.

### Client principal boundary

An authenticated bridge client is represented as a `Principal`. The current deployment has separate static principals for GPT Actions and MCP.

Each principal receives one or more resource grants and explicit capabilities. `AuthorizationService` intersects principal grants with the deployment `AccessPolicy` before any document operation runs.

Current capabilities are:

- `doc:read`;
- `doc:write`;
- `doc.schema:write`.

`GPT_ACTION_CAPABILITIES` and `MCP_CAPABILITIES` can restrict the two transports independently. They default to all three so existing personal deployments retain v0.4 behavior unless deliberately restricted.

A document being inside `AccessPolicy` is therefore necessary but not sufficient: the principal must also possess the required capability for that resource.

### Bridge credentials

`/mcp` and `/api/v1` are separate entry points.

**Control:** MCP uses `MCP_BEARER_TOKEN`; GPT Actions uses `GPT_ACTION_TOKEN`. Both are at least 32 characters and must differ.

These bearer tokens currently identify static bridge principals; they are not Grist credentials.

### Grist upstream permissions

After bridge authorization succeeds, Grist still evaluates the server-side API key's own permissions. Bridge authorization can reduce authority but cannot grant authority the Grist identity does not have.

## Operation policy registry

`src/operations/registry.ts` is authoritative for each operation's required capability and risk metadata. The authorization facade reads capability requirements from the same registry exposed through `grist_help`.

This prevents a tool description from silently drifting away from its server-side authorization requirement.

## Powerful operations

### Data writes and deletion

Create/update/delete operations are supported under `doc:write`.

Deletion accepts only explicit unique numeric record IDs; there is no delete-by-filter operation. GPT deletion remains marked consequential and MCP deletion destructive.

Large create/update/delete requests are subject to `GRIST_MAX_WRITE_RECORDS` and split into sequential internal batches configured by `GRIST_WRITE_BATCH_RECORDS`.

These batches are **not atomic as a group**. If a later batch fails after earlier batches succeeded, the bridge raises an explicit partial-operation error containing the completed batches/items and an instruction not to retry the complete operation blindly.

This is particularly important for record creation, where replaying a complete partially successful request could duplicate rows.

### Schema mutation

Table and column mutations require `doc.schema:write`.

The bridge supports table/column creation, update and deletion, column ID renaming, types, formulas, `widgetOptions` and other metadata accepted by the bounded Grist endpoints.

Schema requests are guarded by `GRIST_MAX_SCHEMA_ITEMS`, a total per-operation limit. For table creation, each table and nested initial column counts toward the same maximum.

Column deletion is sequential and may fail after earlier columns were already deleted; the same partial-operation reporting applies.

### Low-level Grist actions

Grist exposes `/api/docs/{docId}/apply`, a powerful low-level User Action endpoint.

**Control:** raw `/apply` is never exposed to ChatGPT or MCP. v0.5 uses it internally only behind fixed service methods:

- `renameColumn` emits exactly `RenameColumn`;
- `deleteTable` emits exactly `RemoveTable`.

The model cannot choose an arbitrary User Action type or payload.

Future pages/widgets support must preserve this invariant by introducing named bounded UI operations rather than an `apply_user_actions` escape hatch.

## Semantic document inspection

`inspect_document` / `inspectGristDocument` requires `doc:read` and returns structural metadata only: tables, columns, formulas and `Ref` / `RefList` relationships.

It does not read user-table rows, which keeps structural reasoning separate from disclosure of business data.

## Generic escape hatches remain excluded

### Arbitrary HTTP

There is no generic URL/method tool. `GRIST_BASE_URL` is process configuration, preventing the bridge from becoming a model-driven HTTP proxy or SSRF primitive.

### Raw SQL

No SQL execution capability is exposed. Grist's documented API and targeted service abstractions remain the supported path.

### Raw administration

The bridge does not expose unrestricted instance administration or user/ACL administration.

## Guardrails

Defaults are deployment policy, not permanent product limitations:

- `GRIST_MAX_READ_RECORDS=5000`;
- `GRIST_MAX_WRITE_RECORDS=500`;
- `GRIST_WRITE_BATCH_RECORDS=200`;
- `GRIST_MAX_SCHEMA_ITEMS=100`.

For the `MAX_*` settings, `0` means no bridge-side maximum. Grist and upstream infrastructure limits still apply.

## Consequential actions

GPT Actions marks reads as non-consequential. Existing create/update/delete data and schema mutations remain consequential so ChatGPT can request confirmation where its platform policy requires it.

MCP tools use `readOnlyHint` and `destructiveHint`; record/table/column deletion is destructive.

Capability authorization is independent of those client-side hints: annotations do not grant permission.

## Prompt injection and returned data

Grist cell contents are untrusted data, not instructions. Tool descriptions state this explicitly. Authorization checks remain server-side regardless of model output or cell content.

## Structured audit

Every operation routed through `AuthorizedGristService` emits a JSON audit event suitable for `journald` with:

- request ID;
- principal ID and transport;
- operation and required capability;
- document ID when applicable;
- item count when meaningful;
- status and duration;
- error type on failure.

The audit layer intentionally excludes bearer tokens, Grist API keys and full row contents.

Partial-operation failures remain visible through the operation result/error path; they must be reconciled instead of automatically replayed.

## Personal deployment

The current personal deployment intentionally remains simple:

```text
ChatGPT Plus -> HTTPS GPT Actions bearer -> personal VPS bridge -> personal Grist API key -> Grist Community
```

This is an appropriate model for one trusted user controlling both the bridge and the Grist credential.

## Institutional evolution

v0.5 does not implement institutional IAM. Its principal/capability boundary is designed so a future deployment can replace static bearer principals with OIDC/OAuth identities and replace the static Grist credential with delegated user credentials or another provider.

A shared technical Grist account with bridge-managed authorization remains a fallback, not the preferred institutional design.

If the target Grist deployment later supports Grist's official MCP/OAuth integration directly, the official mechanism should normally replace equivalent bridge IAM functionality.

## Secret handling

Never commit or paste:

- Grist API keys;
- `MCP_BEARER_TOKEN`;
- `GPT_ACTION_TOKEN`;
- OAuth/access/refresh tokens;
- session cookies;
- private signing keys.

Use a root-controlled environment file or secret manager in deployed environments.
