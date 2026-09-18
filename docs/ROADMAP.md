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

Integrated capabilities include semantic page/widget inspection, bounded page/widget mutation, conservative direct `select-by`, post-write normalized verification and plugin-ready architecture/security documentation.

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
             v
 C4-P0 Logto/ProConnect MCP POC
          ACTIVE
             |
             v
 C4 OAuth MCP identity
       BLOCKED by POC
             |
             v
 C5 Secure onboarding
       BLOCKED by C4
             |
        +----+----+
        |         |
        v         v
 C6 Production   C7 Reviewer
 hardening       fixture
 blocked C4/C5   blocked C4/C5
        |         |
        +----+----+
             |
             v
 C8 Submission package
             |
             v
 Plugin submission
```

C1, C2 and C3 are integrated. The C4 human identity-provider gate is resolved and recorded in `docs/OAUTH-IDP-DECISION.md`.

Selected architecture:

- ProConnect is the upstream institutional identity source;
- Logto OSS self-hosted is the reference MCP-facing authorization server;
- `grist-chatgpt` remains a provider-neutral OAuth resource server;
- Auth0 EU is the SaaS fallback and Curity Standard the commercial self-hosted fallback;
- direct ProConnect as MCP-facing authorization server remains ruled out for the currently assessed configuration because RFC 8707 Resource Indicators are disabled.

C4-P0 has completed the live Logto/ProConnect identity, resource-token, JWT/JWKS, dynamic-Principal and OAuth-enabled `/mcp` positive/negative resource-server proofs. ChatGPT-facing RFC 9728 metadata, tool `securitySchemes`, runtime OAuth challenges, and a non-destructive public readiness probe are integrated. The remaining blocking evidence is now the real non-production ChatGPT MCP OAuth flow, including reconnect/refresh and revocation behavior. Full C4 implementation remains blocked until those mandatory checks pass.

## C1 — Credential abstraction

**Status: DONE**  
**Priority: blocking / highest**

Integrated result:

- `GristCredentialProvider` seam;
- credential-aware client/context construction;
- static API-key provider preserving existing deployment behavior;
- no storage or multi-user persistence decision embedded in the abstraction.

## C2 — MCP contract v1

**Status: DONE**  
**Priority: high / independent**

Integrated result includes full-surface contract metadata/testing direction, user-intent-oriented tool metadata and stable structured-output/error conventions without weakening authorization or broadening Grist escape hatches.

## C3 — User-aware Grist context

**Status: DONE**  
**Priority: blocking**

Integrated result:

- deployment policy separated from credential-derived discovery;
- principal-bound Grist clients/service graphs;
- per-principal discovery/cache isolation;
- explicit cross-user isolation tests;
- current static single-key development deployment retained.

## C4-P0 — Logto / ProConnect / MCP interoperability POC

**Status: ACTIVE**  
**Priority: blocking / highest**  
**POC branch used for repository harness:** `poc/logto-proconnect-mcp`

### Goal

Prove the human-selected C4 architecture before production-quality OAuth integration.

Authoritative POC contract:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
```

### Integrated repository harness and proven live seams

The repository and live POC evidence now cover:

- provider-neutral OAuth identity -> dynamic `Principal` mapping;
- OAuth scope reduction to the existing Grist capability vocabulary;
- standard JWT/JWKS verification plus issuer, audience/resource and expiry policy checks;
- bearer -> verifier -> bounded principal/context construction;
- principal-bound C3 `GristContextFactory` behavior without forwarding the OAuth bearer as a Grist credential;
- wrong-resource rejection before Grist access;
- insufficient-scope write rejection before mutation;
- OAuth-enabled Express `/mcp` positive and negative request paths;
- prevention of static-bearer override in OAuth mode;
- Logto OSS + PostgreSQL non-production deployment;
- ProConnect federation with stable identity mapping;
- Authorization Code + PKCE `S256` with RFC 8707 canonical resource binding;
- local refresh-token issuance with `offline_access` plus consent;
- RFC 9728 protected-resource metadata and OAuth resource challenges;
- root MCP tool `securitySchemes` with compatibility mirror;
- runtime `_meta["mcp/www_authenticate"]` insufficient-scope challenges;
- a safe public ChatGPT OAuth readiness probe.

Durable evidence and the exact live handoff are in:

```text
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
docs/CHATGPT-OAUTH-READINESS.md
docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md
```

### Current live dependency

The next mandatory POC work is an operator/live-client gate:

1. deploy the current integrated `main` to the public non-production MCP endpoint;
2. enable Logto 1.43 Dynamic app / CIMD with only the fixed `doc:read`, `doc:write`, `doc.schema:write` permissions;
3. run `probe:chatgpt-oauth-readiness` against the public endpoint;
4. connect the real ChatGPT developer/draft MCP client and record sanitized end-to-end OAuth evidence;
5. demonstrate reconnect/refresh behavior and logout/revocation enforcement.

The exact ChatGPT callback/client metadata observed during the live connection is authoritative; do not hard-code guessed client/callback values into bridge core.

No production ProConnect/DataPass commitment is implied or authorized by this POC step.

### Required proof

The POC must demonstrate:

- Logto OSS non-production deployment with PostgreSQL/HTTPS and secrets outside Git;
- ProConnect integration login through Logto's generic OIDC federation path;
- stable identity mapping across repeated login;
- MCP Authorization Code + PKCE `S256`;
- RFC 8707 `resource` handling;
- access token audience/resource binding to the canonical MCP resource;
- representation/enforcement of `doc:read`, `doc:write`, `doc.schema:write`;
- rejection of wrong-resource and insufficient-scope tokens;
- standard JWT/JWKS resource-server validation without proprietary Logto SDK coupling;
- mapping to dynamic `Principal` and the existing C3 `GristContextFactory` isolation boundary;
- durable refresh/offline connectivity with a draft ChatGPT MCP app;
- proof that OAuth/ProConnect tokens never become Grist credentials.

### Constraints

- non-production only unless separately approved;
- no production ProConnect/DataPass commitment;
- no model-visible or committed secrets/tokens;
- no C5 credential persistence/encryption decision;
- do not broaden public scopes;
- do not make Logto-specific SDK behavior part of bridge core.

### Exit criteria

All mandatory POC checks are PASS with sanitized durable evidence in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

If a mandatory MCP requirement fails because of Logto, reopen only the authorization-server product choice and evaluate the documented fallbacks. Do not silently weaken MCP conformance.

## C4 — OAuth MCP identity

**Status: BLOCKED by C4-P0 POC**  
**Priority: blocking**  
**Suggested branch after POC:** `feat/oauth-mcp`

### Goal

Replace the production MCP static bearer principal with OAuth-authenticated dynamic principals and explicit scopes.

### Fixed architecture after human decision

- identity source: ProConnect;
- reference authorization server: Logto OSS self-hosted;
- bridge: standards-based OAuth resource server;
- preferred token validation: JWT + JWKS;
- canonical resource URI is deployment-configurable;
- scopes remain `doc:read`, `doc:write`, `doc.schema:write`;
- static bearer may remain only as an explicit development/backward-compatibility path if still useful.

### Core implementation after POC

- publish protected-resource metadata and standards-compatible authentication challenges;
- validate signature, issuer, audience/resource, expiry and scopes;
- construct dynamic `Principal` objects;
- create principal-bound Grist contexts through `GristContextFactory`;
- enforce scopes through existing `AuthorizationService`;
- keep provider-specific configuration at the edge, not in Grist business logic.

## C5 — Secure Grist onboarding and credential lifecycle

**Status: BLOCKED by C4 and human persistence/encryption decisions**  
**Priority: blocking**  
**Suggested branch:** `feat/grist-onboarding`

### Goal

Allow an authenticated user to securely connect their own Grist Community API key outside model-visible MCP tool data.

### Required behavior

- bridge-owned secure onboarding flow;
- validate supplied key against configured DINUM Grist;
- associate verified Grist identity with authenticated principal;
- encrypted-at-rest credential storage;
- per-principal retrieval only;
- disconnect/removal and revalidation/rotation lifecycle;
- never log/return/prompt the credential.

### Remaining human gates

- persistence technology;
- encryption/key-management design;
- production institutional ownership where required.

## C6 — Production hardening

**Status: BLOCKED by C4/C5 for finalization**  
**Priority: high**

### Integrated independent preparation

- Grist upstream requests have an explicit 10-second abort timeout;
- Node HTTP request reception is explicitly bounded to 120 seconds and header reception to 60 seconds without limiting MCP streaming response duration;
- `main` is protected by the repository ruleset and required CI gate.

### Remaining/finalization work

- per-principal rate limiting;
- operational metrics and alerting;
- structured audit export as needed;
- secret/key rotation procedure;
- deployment and rollback procedure;
- post-deploy synthetic smoke tests.

Independent low-risk preparation may continue only when it does not assume unfinished C4/C5 behavior.

## C7 — Reviewer fixture

**Status: BLOCKED by C4/C5**  
**Priority: submission-critical**

Provide reproducible synthetic reviewer access without real educational/administrative data, including positive record/schema/UI scenarios and negative insufficient-scope/resource/linkage scenarios.

## C8 — Publisher/submission package

**Status: BLOCKED by C6/C7**  
**Priority: final**

Prepare/revalidate at submission time stable HTTPS MCP, publisher identity, domain verification, public metadata, privacy/terms/support, reviewer instructions, availability and tool-scan findings.

## Deferred feature breadth

The following are intentionally not on the current critical path:

- layout mutation;
- page/widget deletion;
- broader widget replacement semantics;
- generated executable custom widgets;
- Apps SDK UI;
- skills;
- arbitrary multi-instance Grist routing.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

The C4 human gate is resolved and the repository-side C4-P0 harness is integrated. C4-P0 remains ACTIVE until the mandatory live ChatGPT POC evidence is PASS. Full C4 OAuth integration must not start before those exit criteria are met.

## Controller integration order

When multiple PRs are open, prefer:

1. safe completion/merge of an existing eligible dependency;
2. independent reviewable work already underway;
3. opening new work only when it does not create avoidable dependency stacking.

After every merge, resolve the new exact `main` SHA and re-evaluate this roadmap against current code/GitHub state.
