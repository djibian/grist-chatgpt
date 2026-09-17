# Roadmap

This roadmap is the authoritative dependency map for autonomous development. It describes what is important, what depends on what, and what is currently eligible.

Status vocabulary:

- **DONE** — integrated on `main` and no longer active;
- **ELIGIBLE** — useful work can start now;
- **ACTIVE** — an implementation PR exists or work is underway;
- **BLOCKED** — a named dependency or human decision is missing;
- **DEFERRED** — intentionally not part of the current critical path.

Priority does not imply eligibility. An item may be high priority but blocked.

## Current baseline

### V0.6 — bounded document UI

**Status: DONE**

Integrated capabilities include:

- semantic page/widget inspection;
- bounded page creation;
- bounded native widget creation;
- page rename;
- widget title update;
- conservative direct `select-by` configuration;
- post-write normalized verification;
- UI missing-resource error handling;
- plugin-ready architecture/security documentation.

Further document-UI breadth is not the current critical path.

## Critical path to plugin-ready v1

```text
                     V0.6 DONE
                         |
             +-----------+-----------+
             |                       |
             v                       v
 C1 Credential abstraction      C2 MCP contract v1
          DONE                       DONE
             |
             v
 C3 User-aware Grist context
          DONE
             |
             +------------+
                          |
                          v
                 C4 OAuth MCP identity
             BLOCKED by human gate
                          |
                          v
                 C5 Secure onboarding
                 BLOCKED by C4
                          |
             +------------+-------------+
             |                          |
             v                          v
 C6 Production hardening       C7 Reviewer fixture
 BLOCKED by C4/C5              BLOCKED by C4/C5
             |
             +------------+-------------+
                          |
                          v
                 C8 Submission package
                 BLOCKED by C6/C7
                          |
                          v
                   Plugin submission
```

C1, C2 and C3 are integrated. The C4 protocol/identity decision package is integrated in `docs/OAUTH-IDP-DECISION.md`, and the ProConnect compatibility tranche is recorded in `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`.

The compatibility result narrows the human gate:

- ProConnect remains the preferred institutional identity source unless a later human decision changes that;
- direct ProConnect as the MCP-facing authorization server is not viable with the current ProConnect configuration because RFC 8707 Resource Indicators are explicitly disabled;
- core C4 implementation is therefore blocked on the human choice of the intermediary authorization-server architecture/provider, not on further proof of the current direct-ProConnect option.

No provider-specific C4 implementation is eligible until that remaining decision is made durable.

## C1 — Credential abstraction

**Status: DONE**  
**Priority: blocking / highest**  
**Suggested branch:** `feat/credential-provider`

### Goal

Introduce the architectural seam required to stop treating one process-wide `GRIST_API_KEY` as the only possible credential source, without changing production behavior yet.

### Intended slice

- define a `GristCredentialProvider` (or equivalently minimal abstraction);
- define a credential-aware `GristClientFactory` / request-context seam;
- implement a `StaticApiKeyCredentialProvider` preserving today's single-user deployment;
- route current business-service construction through that seam with no behavior regression;
- add tests proving the static provider preserves current behavior;
- document the interface expected by future user-aware providers.

### Must not do yet

- no database/secret-store choice;
- no OAuth provider choice;
- no user onboarding UI;
- no per-user storage implementation;
- no new public tool behavior.

### Exit criteria

- process-wide API key is encapsulated behind the credential seam;
- current deployment remains behaviorally equivalent;
- downstream code can later request a client/service context for a principal without redesigning Grist business operations;
- CI green on exact PR head.

## C2 — MCP contract v1

**Status: DONE**  
**Priority: high / independent**  
**Suggested branch:** `feat/mcp-contract-v1`

### Goal

Make MCP the clear product contract while preserving existing service behavior.

### Intended slice

- enrich the operation registry with product-level metadata where it can safely become authoritative;
- add user-intent-oriented titles/descriptions;
- remove unnecessary internal `UserAction` implementation terminology from public descriptions;
- verify `readOnlyHint`, `destructiveHint` and `openWorldHint` over the full MCP surface;
- introduce reusable structured output/error conventions incrementally;
- add `outputSchema` / `structuredContent` where stable and useful, especially for IDs reused by later calls;
- define stable typed error categories without leaking secrets/internal stacks;
- ensure the operation registry and MCP annotations cannot silently drift.

### Constraints

- do not weaken existing authorization;
- do not change the per-user credential architecture;
- do not broaden Grist feature scope merely to make the tool catalog larger;
- keep functional resource IDs available where needed for safe follow-up calls.

### Exit criteria

- full-surface contract tests exist;
- tool metadata is coherent and user-intent-oriented;
- structured outputs/errors have a documented stable direction;
- CI green on exact PR head.

## C3 — User-aware Grist context

**Status: DONE**  
**Priority: blocking**  
**Suggested branch:** `feat/user-aware-grist-context`

### Goal

Make clients, resource discovery, deployment policy intersection and caches safe for multiple authenticated users with different Grist API keys.

### Integrated slice

- deployment-level document/workspace policy is separated from credential-derived Grist discovery;
- principal contexts are constructed through the credential/client factory;
- every created principal context gets its own Grist client, discovery cache, access policy and service graph;
- the deployment policy remains a shareable static maximum boundary;
- explicit cross-user tests prove visibility/cache state learned through user A cannot appear under user B;
- the existing static single-key development deployment remains supported.

### Exit criteria

- no singleton user-derived Grist visibility state remains;
- explicit cross-user isolation tests pass;
- current single-user static credential deployment still works.

## C4 — OAuth MCP identity

**Status: BLOCKED by human authorization-server decision**  
**Priority: blocking**  
**Suggested branch after decision:** `feat/oauth-mcp`

### Goal

Replace the production MCP static bearer principal with OAuth-authenticated dynamic principals and explicit scopes.

### Decision package and compatibility evidence

The protocol research and human decision questions are integrated in `docs/OAUTH-IDP-DECISION.md`.

The direct-ProConnect compatibility tranche is integrated on the current research branch through:

- `docs/PROCONNECT-MCP-COMPAT.md`;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`;
- the reusable `probe:proconnect` tooling.

Current evidence establishes:

- ProConnect implements PKCE S256;
- ProConnect's current OIDC-provider configuration explicitly disables `resourceIndicators`;
- MCP 2026-07-28 requires RFC 8707 Resource Indicators;
- architecture A (direct ProConnect as the MCP authorization server) is therefore not viable in the current configuration.

A live ProConnect integration client is no longer required merely to establish that current architectural result. The live probe is retained for revalidation if ProConnect changes its configuration or a deployed environment is shown to differ.

### Human gate

The remaining human decision is now narrower:

- whether ProConnect remains the production identity source;
- which MCP-facing authorization-server architecture/provider should sit between ChatGPT/Codex and `grist-chatgpt` if ProConnect remains the identity source;
- whether that authorization server may be managed externally, must be self-hosted, or either subject to evaluation;
- which client-registration and session/refresh model is acceptable;
- who owns the resulting institutional registrations/obligations.

Autonomous implementation must stop before choosing or committing to that provider/architecture.

### Design/research work allowed now

Research and documentation may continue to compare concrete intermediary authorization-server options against the fixed MCP requirements:

- protected-resource metadata and challenge behavior;
- PKCE S256;
- RFC 8707 `resource` and audience binding;
- issuer/audience/expiry/scope token validation;
- bridge-scope representation for `doc:read`, `doc:write`, `doc.schema:write` without changing that public scope set;
- refresh/session behavior;
- pre-registration/CIMD/DCR compatibility;
- self-hosted vs managed operational implications;
- federation to ProConnect where architecture B is considered.

Research may reduce uncertainty, but it must not silently select the provider or create institutional commitments.

### Core implementation after the human decision

- validate OAuth access tokens;
- construct dynamic `Principal` objects;
- create a principal-bound Grist context through `GristContextFactory`;
- enforce scopes through the existing authorization service;
- expose appropriate MCP security metadata/challenges;
- preserve the static bearer mode only as an explicit development/backward-compatible path if still useful.

## C5 — Secure Grist onboarding and credential lifecycle

**Status: BLOCKED by C4 and human persistence/encryption decisions**  
**Priority: blocking**  
**Suggested branch:** `feat/grist-onboarding`

### Goal

Allow an authenticated user to securely connect their own Grist Community API key without exposing it to the model.

### Required behavior

- bridge-owned secure onboarding flow outside MCP tool arguments/conversation content;
- validate the supplied key directly against the configured DINUM Grist instance;
- associate verified Grist identity with the authenticated principal;
- encrypt credential at rest;
- retrieve it only for that principal's upstream requests;
- provide disconnect/removal;
- support revalidation/rotation lifecycle metadata;
- never log/return/prompt the credential.

### Human gates

Before implementation, require explicit decisions for:

- persistence technology;
- encryption/key-management design;
- production identity-provider integration details if they affect credential binding.

## C6 — Production hardening

**Status: BLOCKED by C4/C5 for finalization**  
**Priority: high**

Work includes:

- per-principal rate limiting;
- explicit request and Grist upstream timeouts;
- operational metrics and alerting;
- structured audit export as needed;
- secret/key rotation procedure;
- deployment and rollback procedure;
- protected release workflow / `main` protections;
- post-deploy synthetic smoke tests.

Independent low-risk preparatory improvements may be done earlier when they do not assume the final identity implementation.

## C7 — Reviewer fixture

**Status: BLOCKED by C4/C5**  
**Priority: submission-critical**

### Goal

Provide reproducible synthetic reviewer access without real educational/administrative data.

Positive scenarios should include at least:

1. inspect structure/relations/pages/widgets;
2. query/filter records;
3. create a table, columns and records;
4. update bounded data/schema state;
5. create a page, add widgets, configure `select-by`, verify by independent re-read.

Negative scenarios should include at least:

1. write with insufficient scope;
2. resource outside deployment/principal permission;
3. invalid/nonexistent UI linkage target with no unintended write.

Turn these into both automated integration tests and reviewer instructions.

## C8 — Publisher/submission package

**Status: BLOCKED by C6/C7**  
**Priority: final**

Prepare/revalidate at submission time:

- stable public HTTPS MCP endpoint;
- publisher/developer identity and permissions;
- domain verification challenge;
- public plugin metadata and example prompts;
- website/support contact;
- privacy policy and terms;
- reviewer credentials/instructions;
- countries/availability;
- tool scan findings and fixes;
- explicit non-misleading relationship to Grist Labs and DINUM.

## Deferred feature breadth

The following are intentionally not on the current critical path:

- layout mutation;
- page/widget deletion;
- broader widget replacement semantics;
- generated executable custom widgets;
- Apps SDK UI;
- skills;
- arbitrary multi-instance Grist routing.

They may become eligible later only when identity/security critical-path work no longer dominates or a demonstrated user need raises their priority.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

The ProConnect compatibility boundary is now established: direct ProConnect is not currently a conforming MCP authorization-server option because RFC 8707 Resource Indicators are disabled. The next critical-path transition is the human selection of the intermediary authorization-server architecture/provider documented in `docs/OAUTH-IDP-DECISION.md`. No core C4 OAuth implementation is eligible until that decision is made durable.

Independent low-risk research may continue only where it does not assume the outcome of that human gate.

## Controller integration order

When multiple PRs are open, prefer:

1. safe completion/merge of an existing eligible dependency;
2. independent reviewable work already underway;
3. opening new work only when it does not create avoidable dependency stacking.

After every merge, resolve the new exact `main` SHA and re-evaluate this roadmap against current code/GitHub state.
