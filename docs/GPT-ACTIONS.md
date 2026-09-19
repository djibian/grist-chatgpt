# GPT Actions REST interface

## Purpose

GPT Actions/OpenAPI is the compatibility/development adapter for using Grist Community through a custom GPT while keeping Grist credentials, authorization and guardrails server-side.

It is **not** the long-term primary product contract; MCP is.

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

Configure a random `GPT_ACTION_TOKEN` of at least 32 characters. It identifies the static `chatgpt-actions` compatibility principal and is independent from MCP OAuth authentication.

```bash
openssl rand -hex 32
```

In the custom GPT Action editor:

- Authentication type: API key
- Auth type: Bearer
- Secret: `GPT_ACTION_TOKEN`

Capabilities are controlled by `GPT_ACTION_CAPABILITIES`; compatibility defaults are:

```text
doc:read,doc:write,doc.schema:write
```

Removing a capability denies the corresponding operations server-side even if the configured upstream Grist API key could perform them.

## OpenAPI schema

The bridge serves OpenAPI 3.1 at:

```text
GET /openapi.json
```

Re-import/refresh the schema after bridge upgrades that alter the compatibility surface. Advertised version is shared with MCP and `/healthz`.

## Resource scope

GPT Actions does not inherit every document accessible to the Grist API key.

`AccessPolicy` intersects:

- deployment ceiling from `GRIST_ALLOWED_DOCUMENT_IDS` / `GRIST_ALLOWED_WORKSPACE_IDS`;
- static GPT Actions principal grants;
- the capability required by the operation;
- final upstream Grist ACL enforcement through the configured credential.

`listGristDocuments` therefore returns only documents exposed to this compatibility principal.

## Discovery and semantic context

Current compatibility actions include:

- `getGristHelp` — registry-derived operation discovery, optional category filtering/counts and opt-in non-executing workflow descriptions;
- `inspectGristDocument` — compact structural context without user-table rows;
- `listGristDocuments`, `listGristTables`, `listGristColumns`;
- `getGristPages`, `getGristPageWidgets`.

`inspectGristDocument` currently exposes bounded formula/schema diagnostics, including local `$Column` references and exact one-hop `$Ref.Field` / `$RefList.Field` checks against already-loaded schema metadata, plus normalized relationships and page/widget context. Formulas are never executed.

For complex document work, inspect semantic context before broad discovery/mutation when that avoids unnecessary row disclosure.

## Data operations

- `queryGristRecords` — read/filter/sort records; supports the bridge's bounded Grist query contract;
- `createGristRecords` — create records;
- `updateGristRecords` — update records by explicit numeric ID;
- `deleteGristRecords` — delete exact unique numeric IDs only.

Read operations require `doc:read`; record writes require `doc:write`.

Read/write bounds are controlled by `GRIST_MAX_READ_RECORDS`, `GRIST_MAX_WRITE_RECORDS` and `GRIST_WRITE_BATCH_RECORDS`.

Internal batches are **not atomic as a group**. Partial failure reports completed work and the complete operation must not be blindly replayed.

Successful update/delete results are minimized to bounded semantic acknowledgements containing the exact stable targets rather than arbitrary upstream engine response bodies. Creation results retain functional created record IDs for safe follow-up work.

## Schema operations

`listGristColumns` is read-only under `doc:read`. Schema mutations require `doc.schema:write`:

- `createGristTables`;
- `updateGristTables`;
- `deleteGristTable`;
- `createGristColumns`;
- `updateGristColumns`;
- `renameGristColumn`;
- `deleteGristColumns`.

Schema operation size is controlled by `GRIST_MAX_SCHEMA_ITEMS`. For table creation, each table and nested initial column counts toward the same operation maximum.

Success-only update/delete/apply-backed results are projected to semantic acknowledgements rather than raw upstream response bodies. Create operations preserve functional created table/column identifiers.

Raw Grist `/apply` is never exposed to the GPT. Fixed internal actions such as `RenameColumn` and `RemoveTable` remain hidden behind named bounded operations.

## Document UI operations

The compatibility adapter exposes the same bounded document-UI business layer as MCP:

- `getGristPages`;
- `getGristPageWidgets`;
- `createGristPage`;
- `addGristPageWidget`;
- `renameGristPage`;
- `updateGristPageWidget`.

`updateGristPageWidget` currently supports bounded:

- title updates;
- description updates and explicit clearing;
- native chart type on chart widgets only;
- saved sort using stable current column IDs and supported bounded flags;
- direct same-table select-by;
- conservative Ref/RefList column select-by using the exact stable IDs advertised by page-widget inspection.

The adapter resolves required internal numeric Grist references server-side, revalidates current metadata before writes and re-reads the page after writes. Ambiguous post-write verification failures must not trigger blind replay.

Page deletion, widget deletion and broader destructive UI state are not exposed.

## Consequential actions

GPT Actions `x-openai-isConsequential` metadata is an approval/UX hint for this compatibility adapter, not an authorization boundary.

Server-side capability/resource checks remain authoritative regardless of client approval metadata.

## Audit

Every GPT operation routed through `AuthorizedGristService` emits bounded operational metadata: request ID, principal, operation, capability, target document, status, duration and related low-cardinality fields. Cell contents and credentials are not intentionally logged.

Because audited reads append an audit event, MCP's `readOnlyHint` semantics are intentionally stricter than the GPT Actions consequential UX flag; these are different contracts.

## Deliberately unsupported generic capabilities

The adapter does not expose:

- arbitrary HTTP requests;
- raw SQL;
- arbitrary Grist `/apply`/UserActions;
- unrestricted instance administration;
- user/ACL administration;
- model-visible Grist API keys.

## Current identity limitation

GPT Actions remains a **static-bearer compatibility path**. The production product uses MCP OAuth dynamic principals. In the current personal/development deployment, both transports still ultimately use the configured server-side `GRIST_API_KEY`; C5 will replace that shared upstream credential with per-user Grist credentials for production multi-user use.

## Validation approach

Use a synthetic allowed document for destructive/schema/UI validation. A representative sequence is:

1. `getGristHelp`;
2. `listGristDocuments`;
3. `inspectGristDocument`;
4. create temporary schema;
5. create/update/delete synthetic records;
6. inspect/create/configure page/widgets;
7. re-read exact targets after each bounded mutation;
8. remove only explicitly identified temporary schema objects.

This exercises the same authorized business layer used by MCP without exposing production data unnecessarily.
