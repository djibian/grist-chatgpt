# grist-chatgpt

Controlled compatibility bridge between conversational AI clients and Grist Community.

The bridge keeps Grist credentials server-side and exposes bounded semantic operations through both MCP and GPT Actions. Access is constrained by an explicit document/workspace policy and per-principal capabilities.

## Current stable baseline

`v0.5.0` is the stable policy-first baseline. The `feat/v0.6-document-ui` draft branch extends document inspection with Grist pages/widgets and is progressively adding bounded document-UI operations.

## v0.6 draft: document UI

The current draft branch can inspect normalized page/widget metadata without exposing raw `_grist_*` records. It also contains a creation-only UI tranche built around an internal `GristUiActionsAdapter`:

- `get_pages` / `getGristPages` — list normalized pages;
- `get_page_widgets` / `getGristPageWidgets` — inspect normalized widgets;
- `create_page` / `createGristPage` — create one empty named page through the exact bounded `AddView` UserAction;
- `add_page_widget` / `addGristPageWidget` — add one native widget through the exact bounded `CreateViewSection` UserAction.

UI writes require `doc.schema:write`, are re-read after creation, and never expose arbitrary `/apply` payloads to the model. If Grist may have applied a write but the bridge cannot verify its returned object, the bridge reports the operation as non-retryable as a whole to avoid duplicate pages/widgets.

Page/widget update, removal, select-by writes and layout writes remain outside this tranche.

## Security invariants

- Grist API keys remain on the bridge host.
- Documents/workspaces must be explicitly allowed by server policy.
- Operations are authorized by principal and capability (`doc:read`, `doc:write`, `doc.schema:write`).
- No raw SQL, arbitrary HTTP, arbitrary UserActions or model-facing access to `_grist_*` metadata tables.
- Destructive record/schema operations require explicit targets.
- Grist data is treated as untrusted content, never as instructions.
- Structured audit events do not log cell values or credentials.

## Configuration

Copy `.env.example` and configure the required Grist URL/key, allowed documents or workspaces, separate MCP/GPT bearer tokens, and optional capability restrictions.

The service binds to localhost by design; use a reverse proxy for HTTPS remote access.

## Development

```bash
npm ci
npm run check
npm test
npm run build
```

Run locally with:

```bash
npm run dev
```

The service exposes:

- MCP: `/mcp`
- GPT Actions API: `/api/v1`
- OpenAPI schema: `/openapi.json`
- health check: `/healthz`

For architecture, deployment and security details, see the documents under `docs/`.
