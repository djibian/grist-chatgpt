# GPT Actions REST interface

## Purpose

Provide a ChatGPT Plus-compatible path to Grist Community through a custom GPT while keeping the Grist API key, authorization and guardrails server-side.

The GPT authenticates only to the bridge with `GPT_ACTION_TOKEN`.

```text
ChatGPT custom GPT
       |
       | HTTPS + GPT_ACTION_TOKEN
       v
principal: chatgpt-actions
       |
       v
AuthorizationService
       |
       v
AuthorizedGristService
       |
       v
GristService -> GristClient -> Grist Community
```

## Authentication and capability scope

Configure a random `GPT_ACTION_TOKEN` of at least 32 characters, distinct from `MCP_BEARER_TOKEN`.

```bash
openssl rand -hex 32
```

In the custom GPT Action editor:

- Authentication type: API key
- Auth type: Bearer
- Secret: `GPT_ACTION_TOKEN`

The bearer identifies the static `chatgpt-actions` principal in the current personal deployment.

Its capabilities are controlled by `GPT_ACTION_CAPABILITIES`. When omitted, compatibility defaults are:

```text
doc:read,doc:write,doc.schema:write
```

Removing a capability denies the corresponding operations server-side even if the Grist API key itself could perform them.

## OpenAPI schema

The bridge serves OpenAPI 3.1 at:

```text
GET /openapi.json
```

Re-import or refresh the schema in the custom GPT after bridge upgrades that add operations. The advertised version is shared with MCP and `/healthz`.

## Resource scope

ChatGPT does not inherit every document accessible to the Grist API key.

`AccessPolicy` defines the deployment resource boundary with:

- `GRIST_ALLOWED_DOCUMENT_IDS`;
- `GRIST_ALLOWED_WORKSPACE_IDS`.

`AuthorizationService` then intersects that boundary with the `chatgpt-actions` principal and the capability required by each operation.

`listGristDocuments` therefore returns only documents visible to this principal.

## Discovery and semantic context

v0.5 adds two read-only actions:

- `getGristHelp` — returns the operation catalog with category, required capability and risk metadata;
- `inspectGristDocument` — returns a compact semantic context containing tables, columns, formulas and `Ref` / `RefList` relationships without reading user-table rows.

For complex document work, `inspectGristDocument` should normally be preferred over repeatedly discovering table structure one endpoint at a time.

## Data operations

- `listGristDocuments` — discover allowed documents/workspaces.
- `listGristTables` — list tables, optionally expanding column metadata.
- `queryGristRecords` — read/filter/sort records; supports `hidden` and `cellFormat`.
- `createGristRecords` — create records.
- `updateGristRecords` — update records by numeric ID.
- `deleteGristRecords` — delete exact unique numeric IDs only.

Read operations require `doc:read`; record writes require `doc:write`.

Read size is controlled by `GRIST_MAX_READ_RECORDS`. Write size is controlled by `GRIST_MAX_WRITE_RECORDS`; large writes are internally split according to `GRIST_WRITE_BATCH_RECORDS`.

Internal batches are **not atomic as a group**. If a later batch fails after previous batches succeeded, the API reports the already-applied batches/items. A client must reconcile those items and must not retry the complete operation blindly.

There is intentionally no pagination abstraction over Grist. Reads use Grist's native filter/sort/limit model.

## Schema operations

The following require `doc.schema:write`:

- `listGristColumns` itself is read-only and requires only `doc:read`;
- `createGristTables`;
- `updateGristTables`;
- `deleteGristTable`;
- `createGristColumns`;
- `updateGristColumns`;
- `renameGristColumn`;
- `deleteGristColumns`.

Schema operation size is controlled by `GRIST_MAX_SCHEMA_ITEMS`, a total per-operation guardrail. For `createGristTables`, each table and nested initial column counts toward the same maximum.

Column deletion is sequential and may therefore also report partial success.

`widgetOptions` must be supplied in the JSON-string representation expected by Grist.

## Consequential actions

Read operations, including help and document context, are marked `x-openai-isConsequential: false`.

Existing create/update/delete data and schema mutations remain marked consequential. This OpenAI metadata is independent of bridge authorization: it neither grants nor removes a server-side capability.

## Low-level Grist boundary

The bridge never exposes raw `/api/docs/{docId}/apply` to ChatGPT.

Two current high-level actions use it internally:

- `renameGristColumn` → fixed `RenameColumn`;
- `deleteGristTable` → fixed `RemoveTable`.

The model never supplies arbitrary User Action names or arrays.

## Audit

Every GPT operation routed through the policy-aware service emits structured operational metadata to the server log: request ID, principal, operation, capability, target document, status and duration. Cell values and credentials are not intentionally included.

## Deliberately unsupported generic capabilities

The GPT Actions interface does not expose:

- arbitrary HTTP requests;
- raw SQL;
- raw Grist `/apply` actions;
- unrestricted instance administration;
- user/ACL administration.

## Validation approach

Use a synthetic allowed document when validating destructive/schema changes. A useful sequence is:

1. `getGristHelp`;
2. `listGristDocuments`;
3. `inspectGristDocument`;
4. create a temporary table;
5. add typed/formula columns;
6. create/update/delete synthetic records;
7. delete temporary schema objects.

This exercises the same authorized business layer used by MCP without exposing production data unnecessarily.
