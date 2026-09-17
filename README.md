# grist-chatgpt

Controlled MCP compatibility bridge for using **Grist Community** from conversational AI clients, with the DINUM / La Suite numérique Grist Community instance as the first production target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Product direction

The long-term product contract is **MCP-first**.

```text
Primary product contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target Grist edition      : Grist Community
Initial deployment target : DINUM instance
Tenancy model             : multi-user, one configured Grist instance
```

The bridge is intended for Grist Community deployments where the official Grist MCP/OAuth integration is not available or sufficient. It is not intended to replace the official Grist MCP server where that integration already fits the deployment.

For the production multi-user target, each authenticated bridge user executes upstream Grist operations with **that user's own Grist API key**. Grist remains authoritative for the user's real ACLs; the bridge may only reduce authority through deployment policy, principal grants, scopes/capabilities and bounded semantic operations.

See:

- [Product vision](docs/PRODUCT_VISION.md)
- [Authoritative roadmap](docs/ROADMAP.md)
- [Plugin-ready audit](docs/PLUGIN-READY-AUDIT.md)
- [Current architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [C4 OAuth / identity-provider decision package](docs/OAUTH-IDP-DECISION.md)
- [ProConnect/MCP compatibility results](docs/PROCONNECT-MCP-COMPAT-RESULTS.md)
- [OpenAI submission planning](docs/OPENAI-SUBMISSION.md)

## Current status

Integrated milestones:

- **M1 validated 2026-09-06:** Grist Community DINUM read/create/update proof of concept.
- **Public MCP validated 2026-09-10:** HTTPS -> Caddy -> MCP -> Grist DINUM.
- **GPT Actions validated 2026-09-10:** a custom GPT can read and write Grist through the public bridge without receiving the Grist API key.
- **v0.4:** realistic data/schema operations, explicit deletion, batching and hardened partial-failure reporting.
- **v0.5:** principals, Grist-aligned capabilities, policy-aware authorization, structured audit, operation registry and semantic document inspection.
- **v0.6 DONE:** bounded document-UI inspection and mutation: pages, native widgets, page rename, widget title updates, conservative direct `select-by` links and post-write verification.
- **C1 DONE:** credential abstraction with `GristCredentialProvider`, `StaticApiKeyCredentialProvider` and `GristClientFactory`.
- **C2 DONE:** MCP contract v1 with registry-driven product metadata, full-surface annotation checks, structured stable successes and typed error direction.
- **C3 DONE:** principal-aware Grist contexts with isolated client/discovery/cache/access-policy/service state.
- **ProConnect compatibility research integrated:** PKCE `S256` is present in the assessed implementation, but RFC 8707 Resource Indicators are disabled; direct ProConnect is therefore ruled out as the MCP-facing authorization server for the assessed configuration.
- **C6 independent preparation:** Grist upstream requests have a 10-second abort timeout; inbound HTTP request/header reception is explicitly bounded without limiting MCP streaming response duration.

The current critical-path blocker is **C4 — OAuth MCP identity**. Provider-specific implementation is not eligible until the human identity-provider / authorization-server decision documented in `docs/OAUTH-IDP-DECISION.md` is made durable.

Historical milestone documents under `docs/M1-*`, `docs/M2-*` and `docs/M3-*` describe the implementation that existed at the time of each validation.

## Goal

Allow ChatGPT/Codex or another MCP client to perform realistic Grist work on explicitly selected resources while keeping credentials, authorization and business rules server-side.

The bridge is intentionally not a generic Grist API proxy. Every model-visible capability must correspond to a named, bounded operation.

## Current architecture

```text
                GPT Actions             MCP client
                     |                      |
                     +----------+-----------+
                                |
                                v
                       transport adapters
                                |
                                v
                    Principal + capabilities
                                |
                                v
                       GristContextFactory
                    /           |            \
                   /            |             \
                  v             v              v
       GristClientFactory  GristResourceDiscovery  AccessPolicy
              |               private cache           |
              v                                       v
   GristCredentialProvider                    AuthorizationService
              |                                       |
              v                                       v
   credential-derived GristClient            AuthorizedGristService
              |                                       |
              +-------------------+-------------------+
                                  |
                                  v
                              GristService
                                  |
                   REST + bounded internal actions
                                  |
                                  v
                         Grist Community DINUM
```

`DeploymentResourcePolicy` is the shareable deployment-level maximum boundary. Each `GristContextFactory.create(principal)` call creates fresh credential-derived client, discovery/cache, access-policy and service state for that principal.

The current development deployment still uses one configured server-side `GRIST_API_KEY` through `StaticApiKeyCredentialProvider` and two static bearer principals. Those are compatibility/development substitutions, not the final production identity model.

## Production identity target

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
              GristContextFactory
                        |
                        v
            GristCredentialProvider
                        |
             current user's Grist API key
                        |
                        v
                   GristClient
                        |
             REST + bounded actions
                        |
                        v
              Grist Community DINUM
```

Effective production authority is:

```text
current user's Grist permissions
∩ bridge deployment resource policy
∩ principal resource grants
∩ required operation capability / OAuth scope
```

Current capability vocabulary:

- `doc:read` — discovery, schema/UI inspection and row reads;
- `doc:write` — record create/update/delete;
- `doc.schema:write` — table/column/document-UI structural mutations.

No current work authorizes changing that scope vocabulary.

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

Raw Grist `/apply` is never model-accessible. Where low-level actions are required internally, the bridge constructs only fixed bounded operations.

### Document UI

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| create empty page | `createGristPage` | `create_page` |
| add native page widget | `addGristPageWidget` | `add_page_widget` |
| rename page | `renameGristPage` | `rename_page` |
| update widget title/direct select-by | `updateGristPageWidget` | `update_page_widget` |

Document-UI operations are semantic and bounded. The model does not receive arbitrary metadata-table write access or arbitrary UserActions. Writes are re-read and verified; ambiguous post-write results are treated as non-retryable at whole-operation level.

## Operation registry and audit

`src/operations/registry.ts` centralizes required capability, product metadata and risk annotations used by authorization/help/MCP contract checks.

Every operation passing through `AuthorizedGristService` emits a structured JSON audit event including request ID, principal, transport, operation, capability, target document, item count where meaningful, status and duration. Audit events do **not** contain bearer tokens, Grist credentials or full cell contents.

## Credential boundary

A Grist API key is a high-value credential and must never become a tool argument or conversation value.

The credential seam is already integrated:

```text
Principal -> GristCredentialProvider -> credential -> GristClientFactory -> GristClient
```

The current static provider preserves development deployment behavior. Production onboarding remains future C5 work and is blocked on explicit persistence/encryption decisions. Any user-aware provider must guarantee that one principal can never retrieve another principal's credential.

## OAuth / ProConnect boundary

The repository contains a bounded compatibility assessment for ProConnect against MCP `2026-07-28`.

For the assessed ProConnect public implementation:

- PKCE `S256` is supported;
- RFC 8707 Resource Indicators are disabled.

Because MCP requires resource-bound token acquisition, **direct ProConnect cannot be the MCP-facing authorization server in that assessed configuration**.

This does not decide whether ProConnect should remain the upstream identity source. A dedicated MCP authorization server federated to ProConnect, another identity/authorization provider, or another explicitly approved architecture remain behind the C4 human gate.

## Production-hardening status

Already integrated independently of final identity:

- 10-second Grist upstream request timeout;
- 120-second inbound request receive timeout;
- 60-second inbound header receive timeout.

Still pending C6 finalization includes per-principal rate limiting, metrics/alerting, audit export where required, secret rotation, deployment/rollback procedure, protected releases and post-deploy smoke tests.

## Configuration

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm ci
npm run dev
```

Important development/prototype variables include:

- `GRIST_BASE_URL`
- `GRIST_API_KEY`
- `GRIST_ALLOWED_DOCUMENT_IDS` and/or `GRIST_ALLOWED_WORKSPACE_IDS`
- `GPT_ACTION_CAPABILITIES`
- `MCP_CAPABILITIES`
- `GRIST_MAX_READ_RECORDS`
- `GRIST_MAX_WRITE_RECORDS`
- `GRIST_WRITE_BATCH_RECORDS`
- `GRIST_MAX_SCHEMA_ITEMS`
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

## Critical path to plugin-ready v1

```text
V0.6 bounded document UI       DONE
C1 Credential abstraction      DONE
C2 MCP contract v1             DONE
C3 User-aware Grist context    DONE
C4 OAuth MCP identity          BLOCKED by human identity-provider decision
C5 Secure Grist onboarding     BLOCKED by C4 + persistence/encryption decisions
C6 Production hardening        BLOCKED for finalization by C4/C5
C7 Reviewer fixture            BLOCKED by C4/C5
C8 Submission package          BLOCKED by C6/C7
```

The next critical-path transition is the human C4 decision recorded in `docs/OAUTH-IDP-DECISION.md`. Further Grist feature breadth is intentionally lower priority.

## Development and validation

```bash
npm ci
npm run check
npm test
npm run build
```

CI also runs the production dependency audit. `package-lock.json` is committed and CI uses `npm ci` for a reproducible dependency graph.

## Design principles

1. **Grist remains authoritative** — the current user's Grist permissions remain the upstream ACL boundary.
2. **MCP-first business logic** — product behavior is transport-neutral, with GPT Actions treated as a compatibility adapter.
3. **Capabilities are explicit** — resource access and `read/write/schema` authority are separate concerns.
4. **Powerful but bounded operations** — destructive targets are exact identifiers.
5. **Understand before modifying** — semantic document context is available without reading row data.
6. **Partial writes are explicit** — no blind replay after partial or ambiguous success.
7. **No generic escape hatches** — no arbitrary HTTP, SQL or raw `/apply` tool.
8. **Secrets remain outside the model** — Grist credentials and OAuth/session secrets never enter model-visible inputs or outputs.
9. **Per-user isolation is mandatory** — clients, resource discovery and caches derived from one credential never cross principal boundaries.

## License

Apache-2.0.
