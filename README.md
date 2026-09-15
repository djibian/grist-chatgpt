# grist-chatgpt

Controlled compatibility bridge for using Grist Community from conversational AI clients, with ChatGPT compatibility as the primary target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Status

- **M1 validated 2026-09-06:** Grist Community DINUM read/create/update proof of concept.
- **Public MCP validated 2026-09-10:** HTTPS → Caddy → MCP → Grist DINUM.
- **ChatGPT Plus GPT Actions validated 2026-09-10:** a custom GPT can read and write Grist through the public bridge without receiving the Grist API key.
- **v0.4.0:** realistic data/schema operations, explicit deletion, batching and hardened partial-failure reporting.
- **v0.5.0:** principals, Grist-aligned capabilities, policy-aware authorization, structured audit, operation registry and semantic document inspection.

See:

- [Current architecture](docs/ARCHITECTURE.md)
- [GPT Actions REST interface](docs/GPT-ACTIONS.md)
- [Security model](docs/SECURITY.md)
- historical milestone evidence under `docs/M1-*`, `docs/M2-*` and `docs/M3-*`

Historical milestone documents describe the implementation that existed at the time of each validation. `README.md`, `docs/ARCHITECTURE.md` and `docs/SECURITY.md` describe the current implementation.

## Goal

Allow a conversational assistant to perform realistic Grist work on explicitly selected resources while keeping credentials, authorization and business rules server-side.

The bridge is intentionally not a generic Grist API proxy. Every model-visible capability must correspond to a named, bounded operation.

## Architecture

```text
                ChatGPT GPT Actions       MCP client
                         |                    |
                         +---------+----------+
                                   |
                                   v
                         transport adapters
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
                           |              +--> structured audit
                           v
                         GristService
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
            Grist REST API                  bounded UserActions
                                             (internal only)
                  +----------------+----------------+
                                   |
                                   v
                                  Grist
```

`AccessPolicy` remains the deployment-level resource boundary. `AuthorizationService` adds a second boundary per client principal and capability. The configured Grist identity and Grist's own ACLs remain authoritative upstream.

## Authorization model

The bridge uses Grist-aligned capability names:

- `doc:read` — discovery, schema inspection and row reads;
- `doc:write` — record create/update/delete;
- `doc.schema:write` — table/column mutations.

The current personal deployment creates two principals:

- `chatgpt-actions` for `/api/v1`;
- `mcp-client` for `/mcp`.

Both inherit the configured `GRIST_ALLOWED_DOCUMENT_IDS` / `GRIST_ALLOWED_WORKSPACE_IDS` resource scope. Their capabilities can be restricted independently with `GPT_ACTION_CAPABILITIES` and `MCP_CAPABILITIES`.

This preserves today's simple single-user deployment while allowing future authenticators or credential providers to be introduced without rewriting Grist business services.

## Main capabilities

### Discovery and semantic context

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| list allowed documents | `listGristDocuments` | `list_documents` |
| list tables | `listGristTables` | `list_tables` |
| list columns | `listGristColumns` | `list_columns` |
| compact document context | `inspectGristDocument` | `inspect_document` |
| operation/capability help | `getGristHelp` | `grist_help` |

`inspect_document` / `inspectGristDocument` reads structure only. It returns tables, columns, formulas and `Ref` / `RefList` relationships without reading user-table rows. It is intended to let an assistant understand a document before complex work.

### Data

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| query/filter/sort records | `queryGristRecords` | `query_records` |
| create records | `createGristRecords` | `create_records` |
| update records | `updateGristRecords` | `update_records` |
| delete explicit record IDs | `deleteGristRecords` | `delete_records` |

Large create/update/delete requests are split into sequential internal batches. Those batches are **not atomic as a group**. If a later batch fails after earlier batches succeeded, the bridge reports the partial success and clients must not retry the complete operation blindly.

### Schema

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| create tables | `createGristTables` | `create_tables` |
| update/rename tables | `updateGristTables` | `update_tables` |
| delete explicit table | `deleteGristTable` | `delete_table` |
| create columns | `createGristColumns` | `create_columns` |
| update metadata/formulas/types | `updateGristColumns` | `update_columns` |
| rename column ID | `renameGristColumn` | `rename_column` |
| delete explicit columns | `deleteGristColumns` | `delete_columns` |

`deleteGristTable` and `renameGristColumn` use Grist's low-level `/apply` endpoint internally, but the bridge constructs only fixed `RemoveTable` or `RenameColumn` actions. Raw `/apply` is never model-accessible.

## Operation registry and audit

`src/operations/registry.ts` is the authoritative source for each operation's required capability and risk metadata. `AuthorizationService` enforcement and `grist_help` use the same definitions.

Every operation passing through `AuthorizedGristService` emits one JSON audit event suitable for `journald`, including:

- request ID;
- principal and transport;
- operation and required capability;
- target document when applicable;
- item count when meaningful;
- success/error status and duration.

Audit events do **not** contain bearer tokens, Grist credentials or full cell contents.

## Configuration

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm ci
npm run dev
```

Important variables:

- `GRIST_BASE_URL`
- `GRIST_API_KEY`
- `GRIST_ALLOWED_DOCUMENT_IDS` and/or `GRIST_ALLOWED_WORKSPACE_IDS`
- `GPT_ACTION_CAPABILITIES` (default `doc:read,doc:write,doc.schema:write`)
- `MCP_CAPABILITIES` (same default)
- `GRIST_MAX_READ_RECORDS` (default `5000`, `0` = unlimited bridge-side)
- `GRIST_MAX_WRITE_RECORDS` (default `500`, `0` = unlimited bridge-side)
- `GRIST_WRITE_BATCH_RECORDS` (default `200`)
- `GRIST_MAX_SCHEMA_ITEMS` (default `100`, `0` = unlimited bridge-side)
- `MCP_BEARER_TOKEN`
- `GPT_ACTION_TOKEN`

`GRIST_MAX_SCHEMA_ITEMS` is a **total per-operation** guardrail. When creating tables, both each table and each nested initial column count toward the same maximum.

The MCP and GPT Actions bearer tokens must each be at least 32 characters and must differ.

Endpoints:

```text
/mcp          MCP
/api/v1       GPT Actions REST
/openapi.json GPT Actions OpenAPI 3.1 schema
/healthz      health check
```

The Node service intentionally binds to localhost. Use a reverse proxy for public HTTPS deployment and configure `MCP_ALLOWED_HOSTS` for the public MCP hostname.

## Deliberate exclusions

The bridge does **not** expose:

- arbitrary HTTP forwarding;
- raw SQL;
- arbitrary Grist `/apply` / UserActions;
- unrestricted Grist instance administration;
- user/ACL administration.

These are architectural boundaries, not missing generic convenience features.

## Roadmap

The next functional layer is document UI composition: pages, native widgets, layout and `select-by`, implemented through named bounded operations modeled on Grist's official MCP semantics. Generated executable custom widgets remain a later, separate risk boundary.

## Development and validation

```bash
npm ci
npm run check
npm test
npm run build
```

`package-lock.json` is generated by npm and committed. CI uses `npm ci`, so the dependency graph validated in CI is reproducible.

## Design principles

1. **Grist remains authoritative** — bridge policy and Grist permissions both apply.
2. **Transport-neutral business logic** — GPT Actions and MCP use the same policy-aware service layer.
3. **Capabilities are explicit** — resource access and `read/write/schema` authority are separate concerns.
4. **Powerful but bounded operations** — destructive targets are exact record/table/column IDs.
5. **Understand before modifying** — semantic document context is available without reading row data.
6. **Partial writes are explicit** — no blind replay after partial success.
7. **No generic escape hatches** — no arbitrary HTTP, SQL or raw `/apply` tool.
8. **Secrets remain server-side** — Grist credentials never enter model-visible inputs.

## Authoritative references

- Grist REST API: https://support.getgrist.com/api/
- Grist REST API usage: https://support.getgrist.com/rest-api/
- OpenAI GPT Actions: https://help.openai.com/en/articles/9442513

## License

Apache-2.0.
