# Plugin-ready audit — Grist Community / DINUM

Status: architectural decision record and product-readiness audit, 2026-09-16.

Audit basis: `feat/v0.6-document-ui` after the validated v0.6 document-UI tranche. This document records product direction and target architecture; it does not by itself change runtime behavior.

## Executive decision

`grist-chatgpt` is intended to provide the MCP/authentication layer that is missing from **Grist Community**, with the first production target being the Grist Community instance operated for the DINUM / La Suite numérique environment.

The project is not intended to compete with or replace Grist's official MCP server where that server is available and sufficient. Hosted Grist and self-hosted editions that provide the official MCP/OAuth integration should normally use the official integration. The bridge is specifically valuable where Grist Community exposes the REST API but does not provide the official MCP/OAuth stack.

The target product is therefore:

> A secure multi-user MCP bridge that lets ChatGPT/Codex operate one configured Grist Community instance through bounded semantic tools, while preserving Grist's own user permissions as the upstream authority.

The long-term product contract is **MCP-first**:

```text
Primary product contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target Grist edition      : Grist Community
Initial deployment target : DINUM instance
Initial tenancy model     : multi-user, one Grist instance
```

GPT Actions remain useful as a development and product-discovery surface during the prototype phase, but architectural decisions should no longer be driven primarily by OpenAPI/GPT Actions constraints.

## Resolved identity decision

For a multi-user production deployment, each authenticated `grist-chatgpt` user will execute Grist operations with **that user's own Grist API key**.

This decision resolves the main upstream-identity question. A shared technical Grist account with bridge-reimplemented ACLs is not the target product model.

Consequences:

- Grist remains authoritative for the user's actual document/workspace permissions;
- the bridge does not recreate Grist ACLs;
- bridge scopes/capabilities can still reduce authority below what the Grist key technically allows;
- audit can attribute bridge operations to a stable authenticated principal and a verified Grist identity;
- upstream requests are executed with the same user's Grist identity rather than a shared service identity;
- credentials, clients, resource discovery and caches must be isolated by user.

The effective authority for one operation is the intersection of:

```text
permissions of the current user's Grist API key
∩ deployment policy for this DINUM bridge
∩ principal resource grants
∩ operation capability / OAuth scope
```

The bridge may only reduce authority. It must never grant authority that the user's Grist identity does not possess.

## Plugin-ready status

| Domain | Status | Assessment |
| --- | --- | --- |
| Product positioning | Green | Clear Community-edition gap; first target is DINUM |
| Public remote MCP over HTTPS | Green | Already validated end-to-end to Grist Community DINUM |
| Grist business layer | Green | Reads, records, schema and bounded document UI are implemented |
| Internal authorization model | Green | `AccessPolicy` + principals + capabilities + audit already exist |
| MCP risk annotations | Green/amber | Current hints are broadly correct; full-surface invariants still need enforcement |
| MCP public contracts | Amber | Functional surface is strong, but titles, outputs and typed errors need hardening |
| OAuth ChatGPT/Codex -> bridge | Red / blocking | Static MCP bearer is still the prototype mechanism |
| Per-user Grist credential execution | Red / blocking | Current runtime still uses one process-wide `GRIST_API_KEY` |
| Reviewer environment | Red | Dedicated synthetic identity/data fixture still required |
| Production operations | Amber | HTTPS/systemd/Caddy baseline is solid; rate limits, monitoring and release discipline need formalization |
| Plugin documentation | Amber | Direction is now documented; contracts and submission evidence still need completion |
| Privacy / Terms / Support | Red / pre-submission | Public artifacts/URLs still required |
| Apps SDK UI | Not required | Initial MCP-only plugin is the intended minimal product |
| Skills | Not required initially | May be added later only if they provide clear user value |

## Current architecture assets to preserve

The existing architecture already contains the correct core policy boundaries:

```text
MCP / GPT Actions
       |
       v
Principal + capabilities
       |
       v
AuthorizationService
       |
       v
AuthorizedGristService
       |
       v
GristService
       |
       v
GristClient
       |
       v
Grist Community
```

Important assets that should be preserved:

- `AccessPolicy` defines the deployment-level Grist resource boundary;
- `Principal` and `AuthorizationService` separate client identity, resource grants and capabilities;
- `AuthorizedGristService` centralizes authorization and structured audit before business operations;
- the capability vocabulary is already Grist-aligned: `doc:read`, `doc:write`, `doc.schema:write`;
- destructive operations target explicit record/table/column identifiers rather than arbitrary filters;
- raw SQL, arbitrary HTTP and arbitrary `/apply` / UserActions are not model-visible;
- partial non-atomic writes are surfaced explicitly and must not be blindly replayed;
- document UI writes use bounded operations and normalized post-write verification;
- MCP tools already use `readOnlyHint`, `destructiveHint` and `openWorldHint`;
- HTTPS MCP transport, reverse proxying, loopback binding, host validation and secret separation have already been validated against the DINUM Grist Community instance.

The project therefore does **not** need a rewrite of its Grist business layer. The principal remaining work is identity, per-user credential execution, public MCP contract hardening and production/reviewer readiness.

## Two distinct authentication layers

The product must keep two concepts separate.

### 1. ChatGPT/Codex -> grist-chatgpt

The current static `MCP_BEARER_TOKEN` is appropriate for prototype validation but is not the intended public multi-user identity model.

The plugin-ready target is MCP-compatible OAuth 2.1 authentication that produces a dynamic bridge `Principal` with stable identity, resource grants and scopes/capabilities.

The existing capability names are candidates for plugin OAuth scopes:

```text
doc:read
doc:write
doc.schema:write
```

The OAuth/MCP implementation must follow the current MCP authorization contract at implementation time, including the then-current protected-resource metadata, authorization-server metadata, token validation requirements, issuer/audience/expiry validation and scope handling.

Public MCP tools that require authentication should expose the corresponding MCP security metadata. Authentication challenges should use the current MCP mechanism (including `mcp/www_authenticate` metadata where required by the specification/client contract) rather than ad-hoc model instructions.

The static bearer mechanism can remain available as a development or controlled-deployment compatibility mode, but it must not define the public plugin identity model.

### 2. grist-chatgpt -> Grist Community

Grist Community does not provide the official Grist OAuth/MCP integration used by editions that include Connected Apps.

For the DINUM Community target, the bridge will therefore obtain the API key belonging to the authenticated user and use that credential for upstream Grist requests.

The following concepts must remain distinct:

```text
who authenticated to the plugin
        !=
what scopes the plugin principal was granted
        !=
which Grist credential is used upstream
        !=
which resources Grist actually allows that credential to access
```

## Credential architecture

The current process-wide `GRIST_API_KEY` and singleton `GristClient` are intentionally prototype substitutions.

The product target should introduce a credential abstraction such as:

```text
Principal
   |
   v
GristCredentialProvider
   |
   v
credential belonging to this user
   |
   v
GristClient / service context for that principal
```

A `StaticApiKeyCredentialProvider` can preserve the current single-user deployment while a production user-aware provider is introduced.

A user-aware provider must guarantee that one principal can never retrieve another principal's credential.

### Credential lifecycle

A production credential record should minimally associate:

- bridge principal ID;
- verified Grist user identity;
- encrypted Grist API key;
- non-secret credential fingerprint;
- creation timestamp;
- last successful validation timestamp;
- optional revocation/disconnection metadata.

The encryption key must be held in infrastructure secret management, not in the repository and not alongside encrypted application data in an equivalent trust boundary.

The bridge should support explicit disconnection that deletes the stored credential association. Grist-level API-key revocation/regeneration remains independently available to the user.

Because a Grist Community API key is a powerful account credential rather than a narrowly delegated OAuth token, the product must clearly document that revoking/regenerating it may affect other integrations using the same key.

## Secure Grist credential onboarding

A Grist API key must **never** be exposed to the model or passed as an MCP tool argument.

It must not appear in:

- ChatGPT/Codex conversation content;
- MCP tool inputs or outputs;
- `structuredContent`;
- audit events;
- general application logs;
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
secure bridge-owned browser form
        |
        v
bridge validates key directly against configured DINUM Grist
        |
        v
verified Grist identity associated with principal
        |
        v
encrypted credential storage
```

The bridge should validate the supplied key directly against the configured DINUM Grist instance before storing it. The Grist profile endpoint available to API-key-authenticated clients is a natural validation primitive, subject to re-checking against the deployed DINUM Grist version before implementation.

Failed validation must not persist the credential.

## User isolation and access-policy refactor

The current singleton `GristClient` and `AccessPolicy` discovery cache are constructed under one process-wide Grist API key.

That model is unsafe for a multi-user deployment unless all user-derived state becomes credential-aware.

It must be impossible for a document discovered under user A's key to become visible to user B merely because it was cached earlier.

The target conceptual separation is:

```text
DeploymentPolicy
  -> which DINUM documents/workspaces this bridge may expose at all

UserResourceAccess
  -> what the current user's Grist credential can actually access

Principal grants/scopes
  -> what the current plugin authorization permits
```

Any Grist client, document discovery result, workspace/document cache or authorization input derived from a user's API key must be isolated by principal/credential or reconstructed safely for the current request/session.

Authorization must fail closed whenever any layer denies access.

## One DINUM instance, not arbitrary Grist multi-tenancy

The initial product is deliberately:

```text
many authenticated users
        |
        v
one grist-chatgpt deployment
        |
        v
one configured Grist Community DINUM instance
```

It is **not** initially:

```text
one universal router
        |
        +--> arbitrary Grist instance A
        +--> arbitrary Grist instance B
        +--> arbitrary Grist instance C
```

This matters for both security and product scope. The stable public MCP endpoint can represent one institutional service boundary while each user authenticates individually and operates through their own Grist identity.

Do not introduce tenant routing, user-supplied Grist base URLs or arbitrary instance discovery unless a future product decision explicitly broadens the target.

This also preserves the existing SSRF boundary: `GRIST_BASE_URL` remains deployment configuration rather than model/user-controlled tool input.

## MCP tool-contract readiness

The current MCP surface is functionally strong but should be hardened into a stable public contract before submission.

### Preserve

- named bounded tools rather than generic proxy primitives;
- precise destructive annotations;
- `openWorldHint: false` for operations confined to the configured private Grist environment;
- semantic operations and stable functional IDs;
- post-write verification for UI operations;
- explicit partial-write reporting;
- structural inspection before complex modification;
- server-side authorization independent of model behavior.

### Improve

Each public MCP tool should have a complete product-level contract including:

- stable tool name;
- user-intent-oriented title;
- user-intent-oriented description;
- explicit input schema;
- explicit output schema where useful;
- structured results (`structuredContent` or the current equivalent) rather than relying only on JSON serialized into text;
- required OAuth capability/scope;
- read-only/destructive/open-world annotations;
- stable typed error behavior.

Descriptions should explain user intent and constraints, not internal Grist `UserAction` implementation details such as `AddView` or `CreateViewSection` unless that detail is genuinely useful to a developer debugging the bridge.

Open-ended metadata dictionaries such as broad `fields: Record<string, unknown>` surfaces should be reviewed. They can remain where Grist flexibility materially requires them, but a public v1 contract should prefer documented semantic fields where practical so the model is not effectively handed an undocumented metadata escape hatch.

### Functional identifiers

Document, table, column, record, page and widget identifiers are legitimate model-visible data when they are needed for safe follow-up calls.

The contract should explicitly tell clients to reuse identifiers returned by discovery/read tools rather than invent or guess them.

## Operation registry as the normative source

`src/operations/registry.ts` already centralizes capability, category, read-only and destructive metadata.

The plugin-ready architecture should extend this pattern so security and tool metadata cannot drift independently.

Target direction:

```text
OperationDefinition
  - capability / OAuth scope
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
MCP registration + authorization + tests + help
```

CI should assert the relevant annotations and scope mapping across the **entire MCP surface**, not only selected schema tools.

Future operations should fail CI if they are missing required policy metadata.

## MCP annotation semantics

MCP annotations must describe the **real operation**, not a desired approval UX:

- reads: `readOnlyHint: true`;
- state-changing operations: `readOnlyHint: false`;
- record/table/column deletion and future difficult-to-reverse destructive actions: `destructiveHint: true`;
- tools confined to the configured private Grist environment: `openWorldHint: false`.

These annotations are not authorization controls. OAuth scopes, principal grants, deployment policy and Grist ACLs remain the enforcement layers.

GPT Actions' `x-openai-isConsequential` flag belongs only to the temporary GPT Actions approval UX and must not redefine the MCP risk semantics or the bridge's security model.

## Error contract

Public MCP errors should evolve from arbitrary message strings toward a stable typed contract, for example:

```json
{
  "code": "PAGE_NOT_FOUND",
  "message": "The requested Grist page does not exist.",
  "retryable": false,
  "resource": { "type": "page", "id": 4 }
}
```

The exact shape is not fixed yet, but the contract must preserve the important existing invariants:

- partial non-atomic writes are explicit;
- completed batches/items are available for reconciliation where appropriate;
- ambiguous writes must carry an equivalent of `retryWholeOperation: false`;
- invalid inputs and authorization failures are distinguishable from upstream infrastructure failures;
- internal stack traces, secrets and irrelevant infrastructure identifiers must not leak;
- functional IDs required for safe follow-up/reconciliation may remain visible.

Errors should be designed for deterministic client behavior, reviewer tests and auditability rather than for exposing implementation diagnostics.

## Deployment readiness

The deployment baseline is already stronger than a typical proof of concept.

Validated characteristics include:

```text
Internet HTTPS
    |
    v
Caddy reverse proxy
    |
    v
Node service bound to loopback
    |
    v
MCP host validation
    |
    v
Grist Community DINUM
```

The current deployment also keeps service secrets outside the Git checkout and uses process supervision. CI currently validates dependency installation/audit, type checking, tests and build.

Before plugin production, formalize or add:

- per-principal rate limiting;
- explicit inbound and upstream timeouts;
- health, latency and error metrics;
- alerting;
- structured audit export where institutionally required;
- documented deployment and rollback procedure;
- production secret rotation;
- protected release workflow and protected `main` policy;
- synthetic smoke tests after deployment;
- incident ownership and support escalation.

Not every item is necessarily a formal OpenAI submission requirement; they are normal requirements for a service allowed to perform institutional writes.

## Reviewer environment

Reviewer access must not depend on real educational or administrative DINUM data.

Prepare a dedicated synthetic Grist environment/account and reproducible scenarios. Reviewer credentials must satisfy the current OpenAI requirements at submission time and should not depend on inaccessible private-network steps or interactive barriers that prevent independent review.

Candidate positive scenarios already exercised during development include:

1. inspect document structure, relations, pages and widgets;
2. query/filter records;
3. create a table with four columns and twelve records;
4. update bounded data/schema state;
5. create a page, add two widgets, configure direct `select-by` and verify through independent re-read.

Candidate negative scenarios include:

1. write attempted with only `doc:read` scope -> rejected before upstream mutation;
2. document outside deployment/principal grant -> rejected;
3. invalid/nonexistent page, widget or select-by source -> no unintended write and stable error;
4. invalid/duplicate destructive identifiers -> rejected before execution;
5. simulated partial write -> completed work reported and whole-operation replay explicitly discouraged.

At least the then-current required positive and negative scenarios should become both automated integration tests and reviewer instructions.

## Submission and publisher readiness

Before public submission, re-check the current OpenAI process rather than relying indefinitely on this snapshot.

The expected workstream includes:

- stable production HTTPS MCP endpoint;
- MCP-compatible OAuth authentication;
- verified OpenAI developer/organization identity;
- required app-management permissions in the OpenAI organization;
- domain ownership verification using the then-current challenge mechanism;
- plugin name, description, logo and example prompts;
- public product/support site;
- privacy policy;
- terms of use;
- support contact and incident ownership;
- countries/availability settings;
- reviewer credentials and instructions;
- required positive and negative reproducible test cases;
- tool scan/review and remediation of any findings before publication.

The relationship to Grist Labs and DINUM / La Suite numérique must remain explicit and non-misleading. Until agreed otherwise, this project is an independent integration, not an official Grist Labs or DINUM product.

## Documentation doctrine

The authoritative project documents should consistently express:

```text
Primary product contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target platform          : Grist Community DINUM
Upstream identity        : each user's own Grist API key
```

Statements implying that a shared technical Grist account is the preferred product target should be removed. A static process-wide API key remains only a prototype/deployment compatibility implementation.

Historical validation documents may retain the architecture that existed at the time, provided they are clearly labeled as historical snapshots.

## Deliberate non-goals for the next tranche

Do not broaden the Grist feature surface merely to appear complete before solving identity.

In particular, layout mutation, page/widget deletion and further UI operations are lower priority than authentication and per-user credential isolation once v0.6 is stabilized.

Do not introduce:

- generic HTTP forwarding;
- raw SQL;
- arbitrary `/apply` / UserActions;
- model-visible Grist credentials;
- bridge-managed recreation of Grist ACLs;
- user-supplied Grist base URLs;
- arbitrary multi-tenant routing across unrelated Grist instances unless a future product decision explicitly requires it.

## Roadmap

### P0 — stabilize v0.6

Complete, validate and merge the current bounded document-UI tranche without expanding the feature surface unnecessarily.

### P1 — MCP becomes normative

Treat MCP as the primary public product contract. Keep GPT Actions as a compatibility/development adapter while custom-GPT testing remains useful.

### P2 — credential abstraction

Introduce `GristCredentialProvider` and a credential-aware `GristClient`/service-context factory.

Preserve the current static API-key deployment through `StaticApiKeyCredentialProvider` or equivalent, but make per-user credentials the production model.

### P3 — user-aware Grist context

Separate deployment policy from user resource discovery. Ensure all Grist clients, document/workspace discovery and caches are isolated by authenticated user credential.

### P4 — OAuth 2.1 MCP identity

Replace the static production MCP principal with OAuth-authenticated dynamic principals and explicit scopes/capabilities. Implement the then-current MCP protected-resource/authentication contract and tool security metadata.

### P5 — secure Grist onboarding

Implement the separate secure web flow for collecting, validating, encrypting, storing, rotating/disconnecting and revalidating per-user Grist API keys.

### P6 — stable MCP v1 contract

Add product titles/descriptions, structured outputs, output schemas where useful, typed errors, explicit identifier guidance and registry-driven security metadata.

### P7 — production hardening

Add rate limits, timeouts, observability, protected releases, secret rotation, deployment rollback and operational evidence.

### P8 — reviewer fixture

Provide synthetic Grist data, reviewer identity/credential flow and the required positive/negative reproducible scenarios.

### P9 — publisher package

Prepare domain verification, publisher identity, support, privacy policy, terms, public metadata, example prompts and availability settings.

### P10 — submission and publication

Submit the MCP plugin through the then-current OpenAI process, complete tool scanning/review, remediate findings and publish only after approval.

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
             credential-aware client
                        |
                        v
             DeploymentPolicy
              + user ACL view
                        |
                        v
             REST + bounded actions
                        |
                        v
              Grist Community DINUM
```

## Core invariant

> ChatGPT/Codex authenticates the user to the bridge; the bridge authenticates that same user to Grist Community with the user's own API key; Grist remains authoritative for upstream permissions; and the bridge may only reduce authority through deployment policy, OAuth scopes, explicit grants and bounded semantic operations.

## References to re-check before implementation/submission

- OpenAI plugin submission documentation;
- OpenAI/MCP authentication documentation;
- current MCP authorization specification;
- Grist Community REST API and API-key documentation;
- Grist official MCP / Connected Apps documentation, to preserve the Community-vs-Full-edition product boundary.
