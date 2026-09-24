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

The bridge targets Grist Community deployments where the official Grist MCP/OAuth integration is unavailable or insufficient. It is not intended to replace the official Grist MCP server where that integration already fits the deployment.

For the production multi-user target, every authenticated bridge user executes upstream Grist operations with **that user's own Grist API key**. Grist remains authoritative for real ACLs; the bridge may only reduce authority through deployment policy, principal grants, OAuth scopes/capabilities and bounded semantic operations.

See:

- [Product vision](docs/PRODUCT_VISION.md)
- [Authoritative roadmap](docs/ROADMAP.md)
- [Current architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Plugin-ready audit](docs/PLUGIN-READY-AUDIT.md)
- [C4 OAuth / identity-provider decision](docs/OAUTH-IDP-DECISION.md)
- [OAuth operating model](docs/OAUTH-OPERATIONS.md)
- [OpenAI submission planning](docs/OPENAI-SUBMISSION.md)

## Current status

Integrated milestones include:

- **M1 validated 2026-09-06:** Grist Community DINUM read/create/update proof of concept.
- **Public MCP validated 2026-09-10:** HTTPS -> Caddy -> MCP -> Grist DINUM.
- **GPT Actions validated 2026-09-10:** a custom GPT can read and write Grist through the public bridge without receiving the Grist API key.
- **v0.4 release:** realistic data/schema operations, explicit deletion, batching and hardened partial-failure reporting.
- **v0.5 release:** principals, Grist-aligned capabilities, policy-aware authorization, structured audit, operation registry and semantic document inspection.
- **V0.6 roadmap milestone DONE:** bounded document-UI inspection and mutation. This milestone has been integrated after the v0.5.0 release; the package/release version remains `0.5.0` until a separate release decision.
- **Q0 DONE:** retrospective quality/architecture cleanup has passed its integrated completion review.
- **C1 DONE:** credential abstraction with `GristCredentialProvider`, `StaticApiKeyCredentialProvider` and `GristClientFactory`.
- **C2 DONE:** MCP contract v1 with registry-driven product metadata, annotation checks, structured UI successes and typed error direction.
- **C3 DONE:** principal-aware Grist contexts with isolated client/discovery/cache/access-policy/service state.
- **C4-P0 DONE:** real ChatGPT Developer Mode interoperability through Logto OSS federated with ProConnect, including PKCE, RFC 8707 resource binding, JWT/JWKS validation, dynamic principals, scope enforcement, positive/negative MCP authorization paths, refresh/grant-revocation behavior and real bounded Grist reads/writes.
- **C4 ELIGIBLE:** productionize the already-proven OAuth design; the remaining committed work is operational evidence on the intended deployment, not identity-provider selection.
- **C5 BLOCKED:** secure per-user Grist credential onboarding still requires C4 productionization plus explicit persistence/encryption decisions.
- **C6 preparation integrated:** timeouts, release/rollback documentation, OAuth deployment preflight/smoke design, metrics vocabulary and audit contract review are present; finalization still depends on C4/C5.
- **P1 / P2 / P3 / P4 DONE:** document-UI parity, formula/schema safety, semantic context/discovery and the compact-surface evaluation have passed their integrated reviews; P4 keeps the current narrow v1 surface.
- **J0 DONE:** engine stabilization passed its exact-main integrated completion review after uncertain/partial-write handling, fail-closed contractual concurrency classification and safe audit-target handling were independently reviewed and integrated.
- **J1 DONE:** the first contractual transformation passed its exact-main integrated completion review after the deterministic two-step synthetic crash/recovery matrix proved durable write-ahead, cumulative budgets, authority re-checks, capability-specific recovery, ambiguity suspension and contextual verification without adding a generic Grist escape hatch.
- **S0 ACTIVE:** final public-plugin eligibility classification occurs during actual OpenAI review; there is no separate pre-review approval gate.
- **S1 ELIGIBLE / partially completed:** the remaining committed evidence is reviewer-path UserInfo with `email_verified: true`.

Historical milestone/evidence documents under `docs/M1-*`, `docs/M2-*`, `docs/M3-*` and the Logto/ProConnect POC files describe the implementation/evidence at the time they were recorded. `docs/ROADMAP.md` is authoritative for current tranche status.

## Goal

Allow ChatGPT/Codex or another MCP client to perform realistic Grist work on explicitly selected resources while keeping credentials, authorization and business rules server-side.

The bridge is intentionally not a generic Grist API proxy. Every model-visible capability corresponds to a named, bounded operation.

## Current architecture

```text
GPT Actions compatibility                 MCP client
        |                                     |
        +------------------+------------------+
                           |
                           v
                   transport adapters
                           |
                           v
               Principal + capabilities
                           |
                           v
                  GristContextFactory
                 /          |          \
                v           v           v
       GristClientFactory  discovery   AccessPolicy
                |          private cache    |
                v                         v
     GristCredentialProvider      AuthorizationService
                |                         |
                v                         v
             GristClient        AuthorizedGristService
                |                         |
                +------------+------------+
                             |
                             v
                         GristService
                             |
                REST + bounded internal actions
                             |
                             v
                    Grist Community DINUM
```

`DeploymentResourcePolicy` is the shareable deployment-level ceiling. Each `GristContextFactory.create(principal)` call creates fresh credential-derived client, discovery/cache, access-policy and service state for that principal.

The validated MCP POC supports **OAuth dynamic principals through Logto OSS + ProConnect**. Static MCP bearer remains a development/backward-compatibility mode; GPT Actions continues to use its static compatibility bearer. Both paths still use one configured server-side `GRIST_API_KEY` through `StaticApiKeyCredentialProvider` in the current personal/development deployment. That shared upstream Grist credential is the remaining prototype substitution and must not be confused with production multi-user isolation.

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

Fixed public capability vocabulary:

- `doc:read` — discovery, schema/UI/context inspection and row reads;
- `doc:write` — record create/update/delete;
- `doc.schema:write` — table/column/document-UI structural mutations.

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

`inspect_document` reads structure without reading user-table rows. Current context includes formulas, bounded local and one-hop Ref/RefList field diagnostics, normalized relationships including verified reverse references, and normalized page/widget layout, sort, select-by, custom-widget settings and grid-display context where exact resolution is possible. Unsupported or stale metadata is marked incomplete rather than guessed.

`grist_help` can return the full operation catalog, filter by category, report compact category counts and optionally expose registry-derived non-executing workflow descriptions.

### Data

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| query/filter/sort records | `queryGristRecords` | `query_records` |
| create records | `createGristRecords` | `create_records` |
| update records | `updateGristRecords` | `update_records` |
| delete explicit record IDs | `deleteGristRecords` | `delete_records` |

Large create/update/delete requests may be split into sequential internal batches. Those batches are **not atomic as a group**. Definite partial failure preserves already-confirmed effects; ambiguous mutating outcomes are reported as uncertain, and the complete operation must not be blindly replayed.

Successful update/delete responses are minimized to bounded semantic acknowledgements rather than forwarding upstream engine response bodies. Creation responses retain the functional created identifiers needed for follow-up work.

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

Raw Grist `/apply` is never model-accessible. Where low-level actions are required internally, the bridge constructs only fixed bounded operations. Success-only schema mutation results are projected to stable requested targets; functional creation IDs remain available.

### Document UI

| Capability | GPT Actions | MCP |
| --- | --- | --- |
| create empty page | `createGristPage` | `create_page` |
| add native page widget | `addGristPageWidget` | `add_page_widget` |
| rename page | `renameGristPage` | `rename_page` |
| update bounded page layout | `updateGristPageLayout` | `update_page_layout` |
| update bounded widget configuration | `updateGristPageWidget` | `update_page_widget` |

Page/widget inspection exposes bounded normalized page layout through stable widget IDs plus normalized sort/select-by state, custom-widget settings and table/grid display state where exact resolution is possible.

`update_page_layout` accepts only a bounded normalized layout expressed with exact current widget IDs. Every current page widget must be accounted for exactly once as placed or collapsed; unknown, duplicate, omitted or malformed state is rejected before write. Tree depth/node count/collapsed-ID count are bounded, the bridge emits only the fixed internal page-layout metadata update, and the normalized page state is re-read and verified exactly. Arbitrary raw Grist BoxSpec/UserActions and model-supplied internal metadata refs are not public inputs.

`update_page_widget` supports bounded title/description changes, explicit description clearing, native chart type, saved sort through stable column IDs, direct same-table select-by, a conservative Ref/RefList column select-by subset, bounded access/column-mapping updates for an explicitly identified existing custom widget, and bounded table/grid display updates for gridlines, zebra stripes and row-number mode. Custom-widget mappings use only stable current column IDs; URLs, plugin/widget identity and arbitrary widget-owned options are not writable model inputs. Grid/custom updates preserve every untargeted existing option. All UI writes are re-read and verified; ambiguous post-write results are non-retryable at whole-operation level.

P1 has passed its integrated completion review; no committed P1 work remains.

## Operation registry and audit

`src/operations/registry.ts` centralizes required capability, product metadata and risk annotations used by authorization, help, MCP contract checks and submission preparation.

Every operation passing through `AuthorizedGristService` emits a structured JSON audit event including request ID, principal, transport, operation, capability, normalized target document only when safely available, item count where meaningful, status and duration. Unresolved/rejected document targets are omitted from error audit events; audit events do **not** contain bearer tokens, Grist credentials or full cell contents.

## Credential boundary

A Grist API key is a high-value credential and must never become a tool argument or conversation value.

```text
Principal -> GristCredentialProvider -> credential -> GristClientFactory -> GristClient
```

The current static provider preserves personal/development deployment behavior. Production onboarding is C5 work and remains blocked on explicit persistence/encryption decisions. Any user-aware provider must guarantee that one principal can never retrieve another principal's credential.

## OAuth / ProConnect boundary

The C4 architecture decision is durable:

- **ProConnect** is the upstream institutional identity source;
- **Logto OSS self-hosted** is the reference MCP-facing authorization server;
- `grist-chatgpt` remains a provider-neutral JWT/JWKS OAuth resource server;
- direct ProConnect is ruled out for the assessed configuration because RFC 8707 Resource Indicators are disabled there;
- Auth0 EU and Curity Standard remain documented fallbacks.

C4-P0 proved this path with real ChatGPT Developer Mode. C4 now concerns productionization and operating evidence, not provider selection.

## Production-hardening status

Already integrated independently of final C5 identity/credential lifecycle:

- 10-second Grist upstream abort timeout;
- bounded inbound HTTP request/header reception;
- protected `main` integration gate;
- deployment/rollback operating documentation;
- offline OAuth deployment preflight;
- non-secret public OAuth deployment smoke checks;
- bounded production metrics vocabulary;
- structured audit contract/privacy review.

Remaining C6 finalization includes per-principal rate limiting, operational metrics/alerting, audit export if required, secret/key rotation, controlled production deployment/rollback evidence and authenticated post-deploy synthetic smoke evidence.

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
- `MCP_AUTH_MODE` (`static` or `oauth`)
- `MCP_BEARER_TOKEN` for static MCP development mode only
- `OAUTH_ISSUER`, `OAUTH_JWKS_URI`, `MCP_RESOURCE_URI` in OAuth mode
- `GPT_ACTION_TOKEN`
- `MCP_ALLOWED_HOSTS`
- optional `OPENAI_APPS_CHALLENGE_TOKEN` only when the submission portal issues the exact value

Endpoints:

```text
/mcp                                      MCP
/api/v1                                   GPT Actions REST
/openapi.json                             GPT Actions OpenAPI 3.1 schema
/healthz                                  health check
/.well-known/oauth-protected-resource     RFC 9728 metadata
/.well-known/openai-apps-challenge        optional portal challenge route
```

The Node service intentionally binds to localhost. Use a reverse proxy for public HTTPS deployment and configure `MCP_ALLOWED_HOSTS` for the public MCP hostname.

## Deliberate exclusions

The bridge does **not** expose arbitrary HTTP forwarding, raw SQL, arbitrary Grist `/apply`/UserActions, unrestricted instance administration, user/ACL administration, model-visible credentials, bridge-managed recreation of Grist ACLs, or arbitrary routing across unrelated Grist instances.

## Current roadmap axes

```text
QUALITY / BASELINE             PLATFORM / SECURITY                     PRODUCT / BUILDER                 PUBLIC DISTRIBUTION
Q0                             DONE   C4 Production OAuth               ELIGIBLE   P1 / P2 / P3 / P4       DONE   S0 Public eligibility   ACTIVE
C1 / C2 / C3 / C4-P0          DONE   C5 Secure Grist onboarding        BLOCKED    J0 Engine stabilization  DONE   S1 Preparation         ELIGIBLE
                                     C6 Production hardening           BLOCKED    J1 Contract execution    DONE   C7 Reviewer env.        BLOCKED
                                                                                  J2-J6                    BLOCKED    C8 Final submission     BLOCKED
```

J1 has completed its exact-main integrated completion review. J2 is now the next Builder tranche: its Stage follow-up business semantics are accepted and a partial reference schema/page binding is recorded, but runtime implementation remains blocked on controlled verification of the real teacher LinkKey/ACL path, teacher-specific UI behavior, dependency closure and an isolated fixture. Missing access/UI facts must not be invented. C4's remaining work requires evidence from the intended deployment; C5 also requires explicit human decisions on persistence and encryption. Public-directory eligibility is decided during the eventual OpenAI review rather than by a separate pre-review approval.

The exact dependency map and currently eligible work live in `docs/ROADMAP.md`.

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
5. **Understand before modifying** — semantic document context is available without indiscriminate row disclosure.
6. **Partial writes are explicit** — no blind replay after partial or ambiguous success.
7. **No generic escape hatches** — no arbitrary HTTP, SQL or raw `/apply` tool.
8. **Secrets remain outside the model** — Grist credentials and OAuth/session secrets never enter model-visible inputs or outputs.
9. **Per-user isolation is mandatory** — clients, resource discovery and caches derived from one credential never cross principal boundaries.

## License

Apache-2.0.