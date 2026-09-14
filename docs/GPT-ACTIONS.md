# GPT Actions REST interface

## Purpose

Provide a ChatGPT Plus-compatible path to Grist through a custom GPT while preserving the MCP endpoint as the future plugin/public integration path.

The GPT authenticates only to the bridge with `GPT_ACTION_TOKEN`. The Grist API key remains server-side.

```text
ChatGPT custom GPT
       |
       | HTTPS + GPT_ACTION_TOKEN
       v
grist-chatgpt /api/v1
       |
       v
   AccessPolicy
       |
       v
   GristService
       |
       v
   GristClient
       |
       | GRIST_API_KEY (server-side only)
       v
Grist Community
```

## Authentication

Configure a random `GPT_ACTION_TOKEN` of at least 32 characters, distinct from `MCP_BEARER_TOKEN`.

```bash
openssl rand -hex 32
```

In the custom GPT Action editor:

- Authentication type: API key
- Auth type: Bearer
- Secret: `GPT_ACTION_TOKEN`

## OpenAPI schema

The bridge serves the complete OpenAPI 3.1 document at:

```text
GET /openapi.json
```

A deployed bridge may be imported directly by URL, e.g. `https://bridge.example.org/openapi.json`. Re-import or refresh this schema in the custom GPT after bridge upgrades that add operations.

The OpenAPI version advertised by the bridge is shared with the MCP and health-check runtime version.

## Document scope

ChatGPT does not automatically inherit every document accessible to the Grist API key. The bridge adds its own resource boundary:

- `GRIST_ALLOWED_DOCUMENT_IDS`: explicit document IDs;
- `GRIST_ALLOWED_WORKSPACE_IDS`: all documents currently present in selected workspaces.

At least one scope entry is required. `listGristDocuments` returns only documents included in this bridge policy and accessible upstream in Grist.

## Data operations

- `listGristDocuments` — discover allowed documents/workspaces.
- `listGristTables` — list tables, optionally expanding column metadata.
- `queryGristRecords` — read/filter/sort records; supports `hidden` and `cellFormat`.
- `createGristRecords` — create records.
- `updateGristRecords` — update records by numeric ID.
- `deleteGristRecords` — delete exact unique numeric IDs only.

Read size is controlled by `GRIST_MAX_READ_RECORDS`. Write size is controlled by `GRIST_MAX_WRITE_RECORDS`; large writes are internally split according to `GRIST_WRITE_BATCH_RECORDS`.

Internal batches are **not atomic as a group**. If a later batch fails after previous batches succeeded, the API returns an explicit partial-operation error with the operation name, completed batch count, completed item count and failed batch number. A client must reconcile the already-applied items and must not retry the complete operation blindly.

There is intentionally no pagination abstraction over Grist. Reads use Grist's native filter/sort/limit model.

## Schema operations

- `listGristColumns` — inspect IDs, labels, types, formulas and widget metadata.
- `createGristTables` — create tables with optional initial columns.
- `updateGristTables` — update table metadata; `fields.tableId` renames a table and `fields.onDemand` changes on-demand loading.
- `deleteGristTable` — delete one exact table ID.
- `createGristColumns` — create columns.
- `updateGristColumns` — modify metadata such as `label`, `type`, `formula`, `isFormula`, `visibleCol`, `widgetOptions`, etc.
- `renameGristColumn` — rename one column ID.
- `deleteGristColumns` — delete exact column IDs.

Schema operation size is controlled by `GRIST_MAX_SCHEMA_ITEMS`. It is a total per-operation guardrail. For `createGristTables`, each table and each nested initial column counts toward the same maximum.

Column deletion is sequential and may therefore also report a partial operation if a later column deletion fails.

`widgetOptions` must be supplied in the JSON-string representation expected by Grist.

## Consequential actions

Read operations are marked `x-openai-isConsequential: false`.

Create/update/delete data and every schema mutation are marked consequential. Destructive actions also require exact record/table/column identifiers rather than broad delete filters.

## Low-level Grist API boundary

The bridge never exposes raw `/api/docs/{docId}/apply` to ChatGPT.

Two high-level actions use it internally because they need Grist User Actions:

- `renameGristColumn` → fixed `RenameColumn` action;
- `deleteGristTable` → fixed `RemoveTable` action.

The model never supplies the User Action name or arbitrary action array.

## Deliberately unsupported generic capabilities

The GPT Actions interface does not expose:

- arbitrary HTTP requests;
- raw SQL;
- raw Grist `/apply` actions;
- unrestricted instance administration.

## Validation approach

Use a synthetic allowed document when validating new destructive/schema actions. A useful sequence is:

1. `listGristDocuments`;
2. inspect tables/columns;
3. create a temporary table;
4. add a typed column and a formula column;
5. update/rename a column;
6. create/update/delete synthetic records;
7. delete the temporary columns/table after explicit confirmation.

This exercises the same business layer used by MCP without exposing production data.
