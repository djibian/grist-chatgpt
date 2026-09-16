# Architecture

`grist-chatgpt` is a controlled compatibility bridge between conversational AI clients and Grist Community. GPT Actions and MCP are transport adapters over the same policy-aware service layer.

## Core flow

```text
GPT Actions / MCP
        |
        v
principal + capabilities
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
   |
   +--> Grist REST API
   |
   +--> GristUiActionsAdapter
            |
            +--> fixed, bounded UserActions only
```

`AccessPolicy` remains the deployment-level allowlist for documents/workspaces. `AuthorizationService` adds principal-specific resource and capability checks. Grist's own permissions remain authoritative upstream.

## Capabilities

The bridge uses Grist-aligned capabilities:

- `doc:read`: discovery, semantic inspection and record reads;
- `doc:write`: record create/update/delete;
- `doc.schema:write`: document structure changes, including table/column mutations and v0.6 page/widget creation.

The operation registry is authoritative for the capability required by each semantic operation.

## Service boundaries

### `GristClient`

Low-level HTTP client for the stable Grist REST API. It also owns the private `/apply` transport used by bounded adapters. The raw `/apply` method is never exposed as a model-facing operation.

### `GristService`

Business layer for documents, tables, columns and records, including batching and schema guardrails.

### `AuthorizedGristService`

Policy-aware facade used by both transports. It:

- resolves the document resource;
- enforces the operation capability from the registry;
- invokes the semantic service/adapter;
- emits one structured audit event;
- builds normalized document/page/widget context from internal metadata reads.

Public `query_records` cannot target `_grist_*` tables. Internal semantic inspection is limited to the fixed metadata tables needed to reconstruct pages and widgets.

### `GristUiActionsAdapter` (v0.6 draft)

This adapter is the only layer allowed to construct document-UI UserActions. The creation tranche currently permits exactly two semantic effects:

```text
create_page
  -> ["AddView", tableId, "empty", pageName]

add_page_widget
  -> ["CreateViewSection", tableRef, pageId, widgetType, null, null]
```

The model never supplies an action name or raw UserAction array.

`tableRef` is resolved internally from a stable Grist `tableId`. Page and widget IDs returned by Grist are checked, then the normalized UI model is re-read after each creation. If the write may have succeeded but its result cannot be verified, the bridge returns a dedicated verification error that explicitly forbids blind whole-operation retry.

Updates, removals, select-by writes and layout writes are not part of this creation tranche.

## Semantic document context

`DocumentContextService` returns a compact representation of:

- tables and columns;
- formulas;
- `Ref` / `RefList` relations;
- pages and normalized widgets;
- layout/options metadata when present;
- current select-by references when present.

The goal is to let a model understand document structure before complex operations without loading user rows.

## Operation registry

`src/operations/registry.ts` is the canonical catalog for:

- operation name;
- category;
- required capability;
- read-only/write classification;
- destructive classification;
- short semantic description.

`AuthorizationService` and `grist_help` consume this same catalog so transport documentation and enforcement do not diverge.

## Audit

Each operation through `AuthorizedGristService` records a structured event containing identifiers and operational metadata such as request ID, principal, transport, operation, document, capability, item count, outcome and duration.

Normal audit events never contain bearer tokens, Grist credentials or full cell contents.

## Failure model

Record/schema batching is sequential rather than transactionally atomic across all batches. Partial success is reported explicitly and must not trigger blind replay.

The v0.6 UI creation adapter applies the same principle more conservatively: once `/apply` has been sent, an unexpected response or failed post-write verification is treated as a potentially successful write. The caller receives `retryWholeOperation: false` when the transport supports structured error output.

## Security invariants

1. Grist credentials remain server-side.
2. Every target document/workspace must be allowed by deployment policy.
3. Every semantic operation has an explicit capability.
4. GPT Actions and MCP share the same authorized business facade.
5. No raw SQL, arbitrary HTTP or arbitrary `/apply` is exposed.
6. Model-facing reads cannot query `_grist_*` directly.
7. Destructive operations use explicit targets.
8. Grist cell content is untrusted data, never instructions.
9. Executable custom-widget generation remains outside the current trust boundary.
