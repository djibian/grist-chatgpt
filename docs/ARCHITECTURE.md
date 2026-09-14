# Architecture v0.4.0

## Objective

`grist-chatgpt` is a bridge between conversational clients and the Grist Community REST API. It exposes named Grist operations through GPT Actions and MCP while keeping authorization and business rules server-side.

## Current architecture

```text
ChatGPT custom GPT / MCP client
             |
             v
      GPT Actions / MCP
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

`GristClient` owns explicit REST calls. `AccessPolicy` limits ChatGPT to configured document IDs and/or workspace IDs. `GristService` applies shared read/write/schema guardrails and exact-target rules for both interfaces.

## Capabilities

The current bridge can:

- discover allowed documents and workspaces;
- list tables and columns;
- read, filter and sort records;
- create, update and delete records;
- create, update and delete tables;
- create, update, rename and delete columns;
- manage column types, formulas and `widgetOptions`.

Record writes may be split into sequential internal batches. These batches are not atomic as a group. If a later batch fails after earlier batches succeeded, the bridge reports how many batches and items were already applied and warns the client not to retry the complete operation blindly.

`GRIST_MAX_SCHEMA_ITEMS` is a total per-operation guardrail. When creating tables, both tables and their nested initial columns count toward the same maximum.

## Low-level Grist boundary

The low-level Grist `/apply` endpoint is never exposed directly to a model. It is used internally only for two fixed operations:

- `renameColumn` emits `RenameColumn`;
- `deleteTable` emits `RemoveTable`.

The model cannot choose an arbitrary low-level action.

## Deliberately unsupported generic capabilities

The bridge does not provide generic HTTP forwarding, raw SQL, raw `/apply`, unrestricted instance administration, or user/permission administration.

## Authentication and authorization

The current personal/development deployment uses:

- server-side `GRIST_API_KEY` for Grist;
- `MCP_BEARER_TOKEN` for `/mcp`;
- `GPT_ACTION_TOKEN` for `/api/v1`;
- `GRIST_ALLOWED_DOCUMENT_IDS` and/or `GRIST_ALLOWED_WORKSPACE_IDS` for the ChatGPT resource boundary.

Grist permissions remain authoritative upstream.

For an institutional multi-user deployment, the preferred design is a DINUM-hosted bridge that authenticates each user and calls Grist Community with that user's identity so existing Grist permissions remain authoritative. A shared technical account with bridge-managed authorization is only a fallback.

## Validated milestones

- **M1 — 2026-09-06:** local Grist Community read/create/update proof against synthetic data.
- **M2:** protected remote MCP transport with bearer authentication.
- **M3 — 2026-09-10:** public HTTPS deployment through Caddy with a loopback-only Node listener.
- **GPT Actions — 2026-09-10:** custom GPT read/write path through `/api/v1` and `/openapi.json`.
- **v0.4.0:** document/workspace policy, realistic data operations, explicit deletion, bulk handling and schema management.

Historical milestone files under `docs/M1-*`, `docs/M2-*` and `docs/M3-*` describe the state that existed at the time of each validation. `README.md`, this document and `SECURITY.md` describe the current implementation.

## Architectural invariant

> Every capability exposed to a model must correspond to a named, bounded Grist operation with explicit server-side authorization and predictable effects.
