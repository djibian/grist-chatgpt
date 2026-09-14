# grist-chatgpt

Experimental open-source bridge for using Grist data and document structure from conversational clients, with ChatGPT compatibility as the target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Status

- **M1 validated 2026-09-06:** Grist Community DINUM read/create/update proof of concept.
- **Public MCP validated 2026-09-10:** HTTPS → Caddy → MCP → Grist DINUM.
- **ChatGPT Plus GPT Actions validated 2026-09-10:** a custom GPT can read and write Grist through the public bridge without receiving the Grist API key.
- **v0.4.0 consolidation:** configurable document/workspace scope, realistic data operations, explicit deletion, bulk batching, schema management, coherent versioning and hardened partial-failure reporting.

See:

- [Current architecture](docs/ARCHITECTURE.md)
- [M1 validation evidence](docs/M1-VALIDATION.md)
- [M2 protected remote demo](docs/M2-REMOTE-DEMO.md)
- [M3 public VPS deployment](docs/M3-PUBLIC-DEPLOYMENT.md)
- [GPT Actions REST interface](docs/GPT-ACTIONS.md)
- [Security model](docs/SECURITY.md)

Historical milestone documents describe the implementation that existed at the time of each validation. `README.md`, `docs/ARCHITECTURE.md` and `docs/SECURITY.md` describe the current implementation.

## Goal

Allow a conversational assistant to perform realistic Grist work on explicitly selected documents while preserving Grist as the data and permission authority.

Current capabilities include:

- discover allowed documents/workspaces;
- list tables and columns;
- read/filter/sort records;
- create/update/delete records;
- create/update/delete tables;
- create/update/rename/delete columns;
- set Grist column metadata such as types, formulas and `widgetOptions`;
- configure guardrails for read/write/schema operation sizes.

The bridge deliberately does **not** expose arbitrary HTTP, raw SQL, raw Grist `/apply`, or unrestricted Grist administration.

## Architecture

```text
ChatGPT custom GPT / MCP client
             |
             v
grist-chatgpt bridge
   |                 |
   | /api/v1         | /mcp
   | GPT Actions     | MCP
   +--------+--------+
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
            v
       Grist REST API
```

The Grist API key stays server-side. ChatGPT can target only documents explicitly selected by `GRIST_ALLOWED_DOCUMENT_IDS` and/or workspaces selected by `GRIST_ALLOWED_WORKSPACE_IDS`. Grist permissions remain an additional upstream boundary.

## Main capabilities

### Data

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| list allowed documents | `listGristDocuments` | `list_documents` |
| list tables | `listGristTables` | `list_tables` |
| query/filter/sort records | `queryGristRecords` | `query_records` |
| create records | `createGristRecords` | `create_records` |
| update records | `updateGristRecords` | `update_records` |
| delete explicit record IDs | `deleteGristRecords` | `delete_records` |

Large create/update/delete requests are split into sequential internal batches. Those batches are **not atomic as a group**. If a later batch fails after earlier batches succeeded, the bridge reports the partial success and clients must not retry the complete operation blindly.

### Schema

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| list columns | `listGristColumns` | `list_columns` |
| create tables | `createGristTables` | `create_tables` |
| update/rename tables | `updateGristTables` | `update_tables` |
| delete explicit table | `deleteGristTable` | `delete_table` |
| create columns | `createGristColumns` | `create_columns` |
| update metadata/formulas/types | `updateGristColumns` | `update_columns` |
| rename column ID | `renameGristColumn` | `rename_column` |
| delete explicit columns | `deleteGristColumns` | `delete_columns` |

`deleteGristTable` and `renameGristColumn` use Grist's low-level `/apply` endpoint internally, but the bridge constructs only the fixed `RemoveTable` or `RenameColumn` action. Raw `/apply` is never model-accessible.

## Configuration

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Important variables:

- `GRIST_BASE_URL`
- `GRIST_API_KEY`
- `GRIST_ALLOWED_DOCUMENT_IDS` and/or `GRIST_ALLOWED_WORKSPACE_IDS`
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

## Development and validation

```bash
npm install
npm run check
npm test
npm run build
```

A generated npm lockfile is not committed yet, so CI currently resolves the declared dependency ranges with `npm install`. A real `package-lock.json` should be generated and committed from a registry-connected environment rather than fabricated manually.

## Design principles

1. **Grist remains authoritative** — bridge scope and Grist permissions both apply.
2. **One business layer** — MCP and GPT Actions share `AccessPolicy`, `GristService` and `GristClient`.
3. **Powerful but explicit operations** — destructive targets are exact record/table/column IDs.
4. **Configurable guardrails** — fixed prototype limits are replaced with deployment policy.
5. **Partial writes are explicit** — non-atomic batch failures report already-applied items and forbid blind whole-operation retry.
6. **No generic escape hatches** — no arbitrary HTTP, SQL or raw `/apply` tool.
7. **Secrets remain server-side** — Grist credentials never enter model-visible inputs.

## Authoritative references

- Grist REST API: https://support.getgrist.com/api/
- Grist REST API usage: https://support.getgrist.com/rest-api/
- OpenAI GPT Actions: https://help.openai.com/en/articles/9442513

## License

Apache-2.0.
