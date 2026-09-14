# Security model

## Security objective

The bridge should let ChatGPT use the power intentionally granted to it without becoming a broader authority than the configured Grist identity, the server-side document/workspace policy, and Grist's own permissions.

## Trust boundaries

### Grist credentials

A Grist API key has the permissions of its owner.

**Control:** `GRIST_API_KEY` is server-side only. It is never an MCP/GPT parameter, OpenAPI value, prompt value, or client-visible secret.

### ChatGPT document scope

The Grist account may access more documents than should be exposed to ChatGPT.

**Control:** `AccessPolicy` allows documents by explicit document ID and/or workspace ID. A document must be within that bridge policy and still be allowed by Grist upstream permissions.

### Bridge credentials

`/mcp` and `/api/v1` are separate entry points.

**Control:** MCP uses `MCP_BEARER_TOKEN`; GPT Actions uses `GPT_ACTION_TOKEN`. Both are at least 32 characters and must differ.

## Powerful operations

The bridge intentionally supports realistic document manipulation rather than a permanently read-mostly demo.

### Data writes and deletion

Create/update/delete operations are supported. Deletion accepts only explicit unique numeric record IDs; there is no delete-by-filter operation. GPT deletion is marked consequential and MCP deletion is marked destructive.

Large create/update/delete requests are subject to `GRIST_MAX_WRITE_RECORDS` and are split into sequential internal batches configured by `GRIST_WRITE_BATCH_RECORDS`.

These batches are **not atomic as a group**. If a later batch fails after earlier batches succeeded, the bridge raises an explicit partial-operation error containing:

- operation name;
- completed batch count;
- completed item count;
- failed batch number;
- an explicit indication that the whole operation must not be retried blindly.

This is particularly important for record creation, where replaying a complete partially successful request could duplicate rows.

### Schema mutation

The bridge supports table and column creation/update/deletion, column ID renaming, types, formulas, `widgetOptions`, and other metadata accepted by the official Grist endpoints.

Schema requests are guarded by `GRIST_MAX_SCHEMA_ITEMS`. This is a **total per-operation** guardrail. For table creation, each table and each nested initial column counts toward the same maximum.

Column deletion is sequential and may also fail after earlier columns were already deleted. The same partial-operation reporting applies.

Destructive schema actions require explicit table/column IDs and are annotated as consequential/destructive.

### Low-level Grist actions

Grist exposes `/api/docs/{docId}/apply`, a powerful low-level User Action endpoint.

**Control:** raw `/apply` is never exposed to ChatGPT or MCP. The bridge uses it only behind two fixed service methods:

- `renameColumn` emits exactly `RenameColumn`;
- `deleteTable` emits exactly `RemoveTable`.

The model cannot choose an arbitrary User Action type or payload.

## Generic escape hatches remain excluded

### Arbitrary HTTP

There is no generic URL/method tool. `GRIST_BASE_URL` is process configuration, preventing the bridge from becoming a model-driven HTTP proxy or SSRF primitive.

### Raw SQL

No SQL execution capability is exposed. Grist's documented API and targeted service abstractions remain the supported path.

### Raw administration

The bridge does not expose unrestricted instance administration.

## Guardrails

Defaults are deployment policy, not permanent product limitations:

- `GRIST_MAX_READ_RECORDS=5000`;
- `GRIST_MAX_WRITE_RECORDS=500`;
- `GRIST_WRITE_BATCH_RECORDS=200`;
- `GRIST_MAX_SCHEMA_ITEMS=100`.

For the `MAX_*` settings, `0` means no bridge-side maximum. Grist and upstream infrastructure limits still apply.

## Consequential actions

GPT Actions marks reads as non-consequential. Create/update/delete data and all schema mutations are consequential so ChatGPT can request user confirmation where appropriate.

MCP tools use `readOnlyHint` and `destructiveHint`; record deletion and table/column deletion are destructive.

## Prompt injection and returned data

Grist cell contents are untrusted data, not instructions. Tool descriptions state this explicitly. Authorization and document-scope checks remain server-side regardless of model output or cell content.

## Logging and privacy

Production logging should record operation names, request IDs, status and latency rather than credentials or full row contents. A multi-user/institutional deployment should add structured audit events for writes and privacy review for any personal data crossing the bridge boundary.

Partial-operation events should be logged distinctly because they require reconciliation rather than automatic whole-request retry.

## Institutional deployment target

The current personal deployment uses one user's Grist API key. The desired institutional architecture is different: the bridge should authenticate each user and call Grist Community on behalf of that authenticated identity so Grist continues to enforce that user's existing permissions.

The bridge's document/workspace policy remains useful as an additional boundary controlling which Grist resources are made available to ChatGPT.

## Secret handling

Never commit or paste:

- Grist API keys;
- `MCP_BEARER_TOKEN`;
- `GPT_ACTION_TOKEN`;
- OAuth/access/refresh tokens;
- session cookies;
- private signing keys.

Use a root-controlled environment file or secret manager in deployed environments.
