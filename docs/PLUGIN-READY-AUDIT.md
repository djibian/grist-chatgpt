# Plugin-ready audit — Grist Community / DINUM

Status: architectural decision record and product-readiness audit, 2026-09-16.

This document records the intended product direction for `grist-chatgpt` after the v0.6 document-UI work. It does not change the current runtime implementation by itself.

## Product position

`grist-chatgpt` is intended to provide the MCP layer that is missing from **Grist Community**, with the first production target being the Grist Community instance operated for the DINUM / La Suite numérique environment.

The goal is not to compete with or replace Grist's official MCP server where that server is available. Hosted Grist and self-hosted editions that provide the official MCP/OAuth integration should normally use the official integration. The bridge is specifically valuable where Grist Community exposes the REST API but does not provide the official MCP/OAuth stack.

The target product can therefore be stated as:

> A secure multi-user MCP bridge that lets ChatGPT/Codex operate a Grist Community instance through bounded semantic tools, while keeping Grist credentials server-side and preserving Grist's own user permissions as the upstream authority.

## Product contract

The long-term product contract is **MCP-first**.

```text
Primary product contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target Grist edition      : Grist Community
Initial deployment target : DINUM instance
```

GPT Actions remain useful as a development and product-discovery surface during the prototype phase, but architectural decisions should no longer be driven primarily by OpenAPI/GPT Actions constraints.

## Current strengths

The current codebase already has the main policy and business boundaries needed for a production plugin:

- `AccessPolicy` defines the deployment-level Grist resource boundary;
- `Principal` and `AuthorizationService` separate client identity, resource grants and capabilities;
- `AuthorizedGristService` centralizes authorization and audit before business operations;
- the capability vocabulary is already Grist-aligned: `doc:read`, `doc:write`, `doc.schema:write`;
- destructive operations target explicit record/table/column identifiers rather than arbitrary filters;
- raw SQL, arbitrary HTTP and arbitrary `/apply` / UserActions are not model-visible;
- partial non-atomic writes are surfaced explicitly and must not be blindly replayed;
- MCP tools already use `readOnlyHint`, `destructiveHint` and `openWorldHint`;
- public HTTPS MCP transport, reverse proxying, loopback binding, host validation and secret separation have already been validated against the DINUM Grist Community instance;
- v0.6 adds bounded document UI inspection and mutation without exposing raw Grist metadata tables or arbitrary UserActions.

These are product assets to preserve rather than rewrite.

## Critical identity decision

For a multi-user production deployment, each authenticated `grist-chatgpt` user must execute Grist operations with **that user's own Grist API key**.

This is a deliberate architectural decision.

It means:

- Grist remains the authoritative source of the user's actual document/workspace permissions;
- the bridge does not need to recreate Grist ACLs;
- bridge capabilities can still reduce authority below what the Grist key technically allows;
- audit can attribute a bridge principal to a verified Grist identity;
- a shared technical Grist account is not the preferred product model.

The effective authority for one operation becomes the intersection of:

```text
Grist permissions of the user's API key
∩ deployment policy for the DINUM bridge
∩ principal resource grants
∩ operation capability / OAuth scope
```

## Two distinct authentication layers

The product must keep two concepts separate.

### 1. ChatGPT/Codex -> grist-chatgpt

The current static `MCP_BEARER_TOKEN` is appropriate for prototype validation but not the intended public multi-user identity model.

The plugin-ready target is OAuth 2.1 / MCP-compatible authentication that produces a dynamic bridge `Principal` with stable identity, resource grants and scopes/capabilities.

The existing capability names are candidates for plugin OAuth scopes:

```text
doc:read
doc:write
doc.schema:write
```

### 2. grist-chatgpt -> Grist Community

Grist Community does not provide the official Grist OAuth/MCP integration used by editions that include Connected Apps.

For the DINUM Community target, the bridge must therefore obtain the API key belonging to the authenticated user and use that credential for upstream Grist requests.

The two identities must not be conflated:

```text
plugin identity
!= bridge capability grant
!= Grist API credential
```

## Credential architecture

The current process-wide `GRIST_API_KEY` and singleton `GristClient` are intentionally a prototype implementation.

The product target should introduce a credential abstraction such as:

```text
Principal
   |
   v
GristCredentialProvider
   |
   v
GristClient / service context for that principal
```

A `StaticApiKeyCredentialProvider` can preserve the current single-user deployment while a user-aware provider is introduced for production.

The user-aware implementation must ensure that no cache, client or discovered-resource state created with one user's Grist API key can be reused for another user.

In particular, today's `AccessPolicy` discovery cache must not become cross-user state. Deployment policy and user-visible Grist resources should become clearly separated concepts.

## Secure Grist credential onboarding

A Grist API key must never be exposed to the model or passed as an MCP tool argument.

The key must not appear in:

- ChatGPT conversation content;
- MCP tool inputs or outputs;
- `structuredContent`;
- audit events;
- application logs;
- error payloads;
- OpenAPI/GPT Actions parameters.

The intended product flow is a separate secure onboarding page owned by `grist-chatgpt`:

```text
OAuth-authenticated plugin user
        |
        v
"Connect your Grist account"
        |
        v
secure browser form
        |
        v
bridge validates key directly against Grist
        |
        v
associate verified Grist identity with principal
        |
        v
encrypted credential storage
```

The bridge should validate a supplied API key directly against the configured DINUM Grist instance before storing it.

A production credential record should minimally associate:

- bridge principal ID;
- verified Grist user identity;
- encrypted API key;
- non-secret credential fingerprint;
- creation timestamp;
- last validation timestamp.

The encryption key must remain in infrastructure secret management rather than in the repository or application database.

The product must also provide an explicit "Disconnect Grist" operation that removes the stored credential. Users must additionally be able to revoke/regenerate the API key at the Grist level.

## Access-policy refactor

The current deployment-level allowlist remains valuable for the institutional DINUM deployment, but it should be conceptually separated from per-user resource visibility.

Target model:

```text
DeploymentPolicy
  -> which DINUM documents/workspaces this bridge may expose at all

UserResourceAccess
  -> what the current user's Grist credential can actually access

Principal grants/scopes
  -> what the current plugin authorization permits
```

Authorization must always fail closed when any layer denies access.

## MCP tool-contract readiness

The current MCP surface is functionally strong but should be hardened into a stable public contract before submission.

### Preserve

- named bounded tools rather than generic proxy primitives;
- precise destructive annotations;
- `openWorldHint: false` for the private bounded Grist environment;
- semantic operations and stable functional IDs;
- post-write verification for UI operations;
- explicit partial-write reporting.

### Improve

Each public MCP tool should have a complete product-level contract including:

- stable tool name;
- user-intent-oriented title and description;
- explicit input schema;
- explicit output schema when useful;
- structured results rather than relying only on JSON serialized into text;
- required OAuth capability/scope;
- read-only/destructive/open-world annotations;
- stable typed error behavior.

Descriptions should explain user intent and constraints, not internal Grist `UserAction` implementation details.

Open-ended schema dictionaries such as arbitrary metadata `fields` should be reviewed and progressively replaced or constrained where a stable semantic contract is practical.

## Operation registry as the normative source

`src/operations/registry.ts` already centralizes capability, category, read-only and destructive metadata.

The plugin-ready architecture should extend this idea so that security and tool metadata cannot drift independently.

Target direction:

```text
OperationDefinition
  - capability / scope
  - category
  - readOnly
  - destructive
  - openWorld
  - title
  - description
  - input contract
  - output contract
          |
          v
MCP registration + tests
```

CI should assert the relevant annotations and scope mapping across the entire MCP surface, not only selected tools.

## Error contract

Public MCP errors should evolve from arbitrary message strings toward a stable typed contract, for example:

```json
{
  "code": "PAGE_NOT_FOUND",
  "message": "...",
  "retryable": false,
  "resource": { "type": "page", "id": 4 }
}
```

The exact shape is not yet fixed, but the contract must preserve the important existing invariants:

- partial non-atomic writes are explicit;
- ambiguous writes must set an equivalent of `retryWholeOperation: false`;
- internal stack traces, secrets and irrelevant infrastructure identifiers must not leak;
- functional IDs required for safe follow-up operations may remain visible.

## Submission-readiness gaps

The project is not yet ready for public OpenAI plugin submission. The main gaps are:

1. OAuth 2.1 / MCP authentication and dynamic principals;
2. per-user Grist credential storage and retrieval;
3. strict isolation of client/cache/resource discovery by principal credential;
4. stable MCP output and error contracts;
5. full-surface annotation/scope tests;
6. production rate limiting, observability and operational rollback discipline;
7. a reviewer environment using synthetic data;
8. public privacy policy, terms, support and publisher metadata;
9. domain verification and the current OpenAI submission requirements at submission time.

## Reviewer environment

Reviewer access must not require real educational or administrative DINUM data.

Prepare a dedicated synthetic Grist environment/account and reproducible scenarios. Candidate positive scenarios already exercised during development include:

1. inspect document structure, relations, pages and widgets;
2. query/filter records;
3. create a table with columns and records;
4. update bounded data/schema metadata;
5. create a page, add widgets, configure direct select-by and verify by independent re-read.

Candidate negative scenarios include:

1. write attempted with read-only scope;
2. document outside deployment/principal grant;
3. invalid or nonexistent page/widget/select-by target with no unintended write.

These scenarios should become automated integration tests and reviewer instructions.

## Production hardening

The existing HTTPS/Caddy/systemd/loopback design is a solid base. Before publication, add or formalize:

- rate limiting per authenticated principal;
- explicit upstream and request timeouts;
- health and operational metrics;
- alerting and structured audit export where required;
- documented deployment and rollback process;
- production secret rotation;
- protected release workflow / protected `main` policy;
- synthetic smoke tests after deployment.

## Deliberate non-goals for the next tranche

Do not broaden the Grist feature surface merely to appear complete before solving identity.

In particular, layout mutation, page/widget deletion and further UI operations are lower priority than authentication and per-user credential isolation once v0.6 is stabilized.

Do not introduce:

- generic HTTP forwarding;
- raw SQL;
- arbitrary `/apply` / UserActions;
- model-visible Grist credentials;
- bridge-managed recreation of Grist ACLs;
- multi-tenant routing across arbitrary Grist instances unless a future product decision explicitly requires it.

The initial product is multi-user for **one configured DINUM Grist Community instance**, not a universal proxy for arbitrary Grist installations.

## Roadmap

### P0 — stabilize v0.6

Complete, validate and merge the current bounded document-UI tranche without expanding the feature surface unnecessarily.

### P1 — MCP becomes normative

Treat MCP as the primary public product contract. Keep GPT Actions as a compatibility/development adapter while custom-GPT testing remains useful.

### P2 — credential abstraction

Introduce a `GristCredentialProvider` / client-factory boundary while preserving the current static API-key deployment as one implementation.

### P3 — user-aware Grist context

Ensure all Grist clients, resource discovery and caches are isolated by authenticated user credential.

### P4 — OAuth 2.1 MCP identity

Replace the static production MCP principal with OAuth-authenticated dynamic principals and explicit scopes/capabilities.

### P5 — secure Grist onboarding

Implement the separate secure flow for collecting, validating, encrypting, storing, rotating and disconnecting per-user Grist API keys.

### P6 — stable MCP v1 contract

Add product titles/descriptions, structured outputs, output schemas where useful, typed errors and registry-driven security metadata.

### P7 — production hardening

Rate limits, observability, protected releases, secret rotation, deployment rollback and operational evidence.

### P8 — reviewer fixture

Provide synthetic Grist data, reviewer credentials and at least the required positive/negative reproducible tests.

### P9 — publisher package and submission

Prepare domain verification, publisher identity, support, privacy policy, terms, public metadata and submit the MCP plugin through the current OpenAI process.

## Architectural target

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

## Core invariant

> ChatGPT/Codex authenticates the user to the bridge; the bridge authenticates that same user to Grist Community with the user's own API key; Grist remains authoritative for upstream permissions; and the bridge may only reduce authority through deployment policy, scopes, explicit grants and bounded semantic operations.
