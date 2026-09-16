# grist-chatgpt

Controlled MCP compatibility bridge for using **Grist Community** from conversational AI clients, with the DINUM / La Suite numérique Grist Community instance as the first production target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Product direction

The long-term product contract is **MCP-first**.

`grist-chatgpt` is intended to provide the MCP/authentication layer that is missing from Grist Community deployments where the official Grist MCP/OAuth integration is not available.

```text
Primary product contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target Grist edition      : Grist Community
Initial deployment target : DINUM instance
```

The goal is not to compete with the official Grist MCP server where that integration is available and sufficient.

For the production multi-user Community/DINUM target, each authenticated bridge user will execute Grist operations with **that user's own Grist API key**. Grist therefore remains authoritative for the user's real ACLs, while the bridge adds deployment policy, scopes/capabilities, bounded semantic operations and audit.

See:

- [Plugin-ready audit and roadmap](docs/PLUGIN-READY-AUDIT.md)
- [Current and target architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [OpenAI plugin submission plan](docs/OPENAI-SUBMISSION.md)
- [GPT Actions REST interface](docs/GPT-ACTIONS.md)

## Status

- **M1 validated 2026-09-06:** Grist Community DINUM read/create/update proof of concept.
- **Public MCP validated 2026-09-10:** HTTPS -> Caddy -> MCP -> Grist DINUM.
- **ChatGPT Plus GPT Actions validated 2026-09-10:** a custom GPT can read and write Grist through the public bridge without receiving the Grist API key.
- **v0.4.0:** realistic data/schema operations, explicit deletion, batching and hardened partial-failure reporting.
- **v0.5.0:** principals, Grist-aligned capabilities, policy-aware authorization, structured audit, operation registry and semantic document inspection.
- **v0.6 in progress:** bounded document UI inspection and mutation: pages, native widgets, rename/title updates and conservative direct `select-by` links with post-write verification.

Historical milestone documents under `docs/M1-*`, `docs/M2-*` and `docs/M3-*` describe the implementation that existed at the time of each validation. `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` and `docs/PLUGIN-READY-AUDIT.md` describe the current direction.

## Goal

Allow ChatGPT/Codex or another MCP client to perform realistic Grist work on explicitly selected resources while keeping credentials, authorization and business rules server-side.

The bridge is intentionally not a generic Grist API proxy. Every model-visible capability must correspond to a named, bounded operation.

## Current architecture

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
                           Grist Community
```

`AccessPolicy` remains the deployment-level resource boundary. `AuthorizationService` adds a principal/capability boundary. The configured Grist identity and Grist's own ACLs remain authoritative upstream.

The current prototype still uses one configured server-side `GRIST_API_KEY` and static bearer principals. Those are development substitutions, not the final multi-user identity design.

## Product architecture target

```text
                 ChatGPT / Codex
                        |
                     OAuth 2.1
                        |
                        v
                grist-chatgpt MCP
                        |
              dynamic user Principal
               scopes + resource grants
                        |
                        v
              AuthorizationService
                        |
                        v
           AuthorizedGristService
                        |
                        v
            GristCredentialProvider
                        |
             per-user Grist API key
                        |
                        v
                   GristClient
                        |
             REST + bounded actions
                        |
                        v
              Grist Community DINUM
```

The first product is multi-user for **one configured DINUM Grist Community instance**, not a universal proxy for arbitrary Grist installations.

## Authorization model

The bridge uses Grist-aligned capability names:

- `doc:read` — discovery, schema/UI inspection and row reads;
- `doc:write` — record create/update/delete;
- `doc.schema:write` — table/column/document-UI structural mutations.

The current personal deployment creates two static principals:

- `chatgpt-actions` for `/api/v1`;
- `mcp-client` for `/mcp`.

Both inherit the configured deployment resource scope. Their capabilities can be restricted independently with `GPT_ACTION_CAPABILITIES` and `MCP_CAPABILITIES`.

For the product target, the MCP principal becomes OAuth-authenticated and dynamic. The same capability vocabulary is intended to remain as the bridge authority/scope layer.

Effective production authority is intended to be:

```text
user's Grist permissions
∩ bridge deployment policy
∩ principal resource grants
∩ operation capability/scope
```

## Main capabilities

### Discovery and semantic context

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| list allowed documents | `listGristDocuments` | `list_documents` |
| list tables | `listGristTables` | `list_tables` |
| list columns | `listGristColumns` | `list_columns` |
| compact document context | `inspectGristDocument` | `inspect_document` |
| list pages | `getGristPages` | `get_pages` |
| inspect page widgets | `getGristPageWidgets` | `get_page_widgets` |
| operation/capability help | `getGristHelp` | `grist_help` |

`inspect_document` / `inspectGristDocument` reads structure without reading user-table rows. It returns tables, columns, formulas, `Ref` / `RefList` relationships and normalized page/widget context.

### Data

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| query/filter/sort records | `queryGristRecords` | `query_records` |
| create records | `createGristRecords` | `create_records` |
| update records | `updateGristRecords` | `update_records` |
| delete explicit record IDs | `deleteGristRecords` | `delete_records` |

Large create/update/delete requests may be split into sequential internal batches. Those batches are **not atomic as a group**. Partial failure is reported explicitly and the complete operation must not be blindly replayed.

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

`deleteGristTable` and `renameGristColumn` use Grist's low-level `/apply` endpoint internally, but the bridge constructs only fixed bounded actions. Raw `/apply` is never model-accessible.

### Document UI

Current v0.6 operations include:

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| create empty page | `createGristPage` | `create_page` |
| add native page widget | `addGristPageWidget` | `add_page_widget` |
| rename page | `renameGristPage` | `rename_page` |
| update widget title/direct select-by | `updateGristPageWidget` | `update_page_widget` |

Document UI operations are semantic and bounded. The model does not receive arbitrary metadata-table write access or arbitrary UserActions. Writes are re-read and verified; ambiguous post-write results are treated as non-retryable at whole-operation level.

## Operation registry and audit

`src/operations/registry.ts` is the authoritative source for each operation's required capability and risk metadata. `AuthorizationService` enforcement and `grist_help` use the same definitions.

Every operation passing through `AuthorizedGristService` emits one JSON audit event suitable for `journald`, including request ID, principal, transport, operation, capability, target document, item count where meaningful, status and duration.

Audit events do **not** contain bearer tokens, Grist credentials or full cell contents.

The plugin-ready roadmap extends this registry-driven approach to MCP scope/annotation/contract metadata so authorization and public tool descriptions cannot drift.

## Credential direction

A Grist API key is a high-value credential and must never become a tool argument or conversation value.

The product target introduces a `GristCredentialProvider`-style boundary:

```text
Principal -> credential provider -> current user's Grist API key -> GristClient
```

The current static `GRIST_API_KEY` deployment can remain as a development provider.

Production onboarding should use a separate secure bridge-owned web flow to collect, validate and encrypt the user's Grist API key. The credential must never appear in prompts, MCP results, GPT Actions arguments, audit logs or application errors.

Any Grist client, resource discovery state or cache created under one user's credential must be isolated from every other user.

## Configuration

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm ci
npm run dev
```

Important current prototype variables:

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
- user/ACL administration;
- model-visible Grist API keys;
- bridge-managed recreation of Grist ACLs;
- arbitrary routing across unrelated Grist instances.

These are architectural boundaries, not missing generic convenience features.

## Plugin-ready roadmap

After stabilizing v0.6, identity and contract work take priority over further Grist feature breadth:

1. make MCP the normative product surface;
2. introduce per-principal Grist credential/client context;
3. isolate document discovery/caches by user credential;
4. implement OAuth 2.1 MCP authentication and dynamic principals;
5. add secure Grist API-key onboarding/storage/disconnect;
6. stabilize MCP input/output/error contracts and registry-driven metadata;
7. add rate limiting, observability and protected release/rollback workflow;
8. prepare a synthetic reviewer fixture and reproducible positive/negative tests;
9. complete publisher metadata, domain verification and plugin submission.

Further layout mutation or page/widget deletion is lower priority than identity once the current UI tranche is stable.

## Development and validation

```bash
npm ci
npm run check
npm test
npm run build
```

`package-lock.json` is generated by npm and committed. CI uses `npm ci`, so the dependency graph validated in CI is reproducible.

## Design principles

1. **Grist remains authoritative** — the current user's Grist permissions remain the upstream ACL boundary.
2. **MCP-first business logic** — product behavior is transport-neutral, with GPT Actions treated as a compatibility adapter.
3. **Capabilities are explicit** — resource access and `read/write/schema` authority are separate concerns.
4. **Powerful but bounded operations** — destructive targets are exact record/table/column IDs.
5. **Understand before modifying** — semantic document context is available without reading row data.
6. **Partial writes are explicit** — no blind replay after partial or ambiguous success.
7. **No generic escape hatches** — no arbitrary HTTP, SQL or raw `/apply` tool.
8. **Secrets remain outside the model** — Grist credentials never enter model-visible inputs or outputs.
9. **Per-user isolation is mandatory** — clients, resource discovery and caches derived from one credential must never leak across principals.

## Authoritative references

- Grist REST API: https://support.getgrist.com/api/
- Grist REST API usage: https://support.getgrist.com/rest-api/
- Grist official MCP / Connected Apps documentation for edition-boundary comparison
- Current OpenAI plugin/MCP submission and authentication documentation at implementation/submission time

## License

Apache-2.0.
