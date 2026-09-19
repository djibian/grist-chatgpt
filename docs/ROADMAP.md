# Roadmap

This roadmap is the authoritative dependency map for autonomous development. It describes what is important, what depends on what, and what is currently eligible.

Status vocabulary:

- **DONE** — integrated on `main` and no longer active;
- **ELIGIBLE** — useful work can start now;
- **ACTIVE** — work is underway or an implementation/evidence tranche remains open;
- **BLOCKED** — a named dependency or human decision is missing;
- **DEFERRED** — intentionally not part of the current critical path.

Priority does not imply eligibility.

## Current baseline

```text
V0.6 bounded document UI          DONE
C1 credential abstraction         DONE
C2 MCP contract v1                DONE
C3 user-aware Grist context       DONE
C4-P0 Logto/ProConnect MCP POC    ACTIVE (live-client evidence remains)
S1 annotation semantics/package   DONE
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam and per-principal Grist context/cache isolation.

The C4 architecture decision is recorded: ProConnect is the upstream institutional identity source, Logto OSS is the reference MCP-facing authorization server, and `grist-chatgpt` remains a provider-neutral standards-based OAuth resource server. Auth0 EU and Curity Standard remain documented fallbacks.

Live C4-P0 evidence now includes OAuth-enabled `/mcp`, JWT/JWKS verification, canonical resource binding, fixed scopes, dynamic principals, positive/negative authorization proofs, RFC 9728, Logto/ProConnect federation, CIMD, PKCE, refresh-token capability and stable ChatGPT CIMD metadata compatibility.

## New highest-priority gate — S0 public-plugin eligibility

**Status: BLOCKED / HUMAN-INSTITUTIONAL GATE**  
**Priority: highest for the stated goal of public OpenAI plugin publication**

OpenAI's current public-plugin guidelines state that:

- third-party API integration requires appropriate authorization and compliance with the third party's terms; and
- plugins whose primary function is acting as unofficial connectors to third-party services, including intermediary relay layers, cannot be approved.

This repository explicitly describes itself as an independent, non-official Grist Labs / DINUM / OpenAI integration. No repository evidence currently establishes authorization from Grist Labs or DINUM for public directory distribution.

Before substantial **submission-only** engineering is treated as committed work, resolve at least one durable path:

1. obtain/document the authorization or partnership basis needed for public Grist/DINUM integration; or
2. obtain written OpenAI clarification that this product, including its authentication/authorization and bounded semantic workflow layer, is eligible under the current unofficial-connector rule.

A plugin submission draft may be created to obtain a submission/plugin identifier for an OpenAI support clarification. Do not claim an official relationship that has not been explicitly established.

The decision package and exact clarification questions are tracked in GitHub issue #58.

Authoritative audit:

```text
docs/PLUGIN-READY-AUDIT.md
docs/OPENAI-SUBMISSION.md
```

## Critical path to public plugin

```text
                 S0 publication eligibility
                        BLOCKED
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
 C4-P0 live-client proof            low-risk submission prep
       ACTIVE                       ELIGIBLE in parallel
          |
          v
 C4 production OAuth identity
 BLOCKED by S0 + C4-P0 completion
          |
          v
 C5 secure Grist onboarding
 BLOCKED by C4 + persistence/encryption decision
          |
     +----+----+
     |         |
     v         v
 C6 production   C7 reviewer fixture
 hardening       and review auth
     |         |
     +----+----+
          |
          v
 C8 submission package
          |
          v
 OpenAI review / publication
```

## C4-P0 — Logto / ProConnect / MCP interoperability POC

**Status: ACTIVE**  
**Priority: blocking for final C4 proof**

Integrated/live PASS evidence includes:

- Logto OSS + PostgreSQL non-production deployment;
- ProConnect federation and stable identity mapping;
- Authorization Code + PKCE `S256`;
- RFC 8707 canonical resource binding;
- JWT/JWKS, issuer, resource/audience and expiry validation;
- fixed scopes `doc:read`, `doc:write`, `doc.schema:write`;
- dynamic principal and principal-bound Grist context construction;
- wrong-resource rejection;
- insufficient-scope rejection before mutation;
- OAuth-enabled actual `/mcp` positive and negative request paths;
- prevention of static-bearer override in OAuth mode;
- OAuth bearer excluded from the Grist credential path;
- RFC 9728 protected-resource metadata and OAuth challenges;
- root MCP tool `securitySchemes` and runtime insufficient-scope challenge;
- Logto Dynamic app / CIMD;
- stable ChatGPT CIMD compatibility including `private_key_jwt` metadata support;
- public readiness probe returning PASS.

Durable evidence:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
docs/CHATGPT-OAUTH-READINESS.md
docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md
```

Remaining C4-P0 evidence is real ChatGPT client behavior: end-to-end authorization callback, subsequent bearer calls, reconnect/refresh and logout/revocation. The current personal ChatGPT workspace does not expose custom Apps/developer mode; this is an external availability gate, not evidence of bridge incompatibility. Public plugin submission itself is a separate OpenAI Platform route.

Do not weaken OAuth/MCP behavior merely to bypass the external client-availability gate.

## C4 — production OAuth MCP identity

**Status: BLOCKED by S0 and C4-P0 completion**  
**Priority: blocking after S0 is viable**

### Goal

Finalize production-quality OAuth identity on the already integrated provider-neutral seams.

Fixed architecture:

- ProConnect upstream identity;
- Logto OSS reference authorization server;
- standards-based JWT/JWKS resource server;
- deployment-configurable canonical resource URI;
- public scopes remain exactly `doc:read`, `doc:write`, `doc.schema:write`;
- provider-specific behavior stays at the edge;
- static bearer may exist only as explicit development/backward-compatible mode.

The POC already implements most core resource-server mechanics. C4 should productionize rather than redesign them.

## C5 — secure Grist onboarding and credential lifecycle

**Status: BLOCKED by C4 and human persistence/encryption decisions**  
**Priority: submission-critical**

### Goal

Allow an authenticated user to securely connect that user's own Grist Community API key outside model-visible MCP data.

Required behavior:

- bridge-owned secure onboarding flow;
- validate the supplied key against the configured Grist Community instance;
- associate the verified Grist identity with the authenticated principal;
- encrypted-at-rest credential storage;
- per-principal retrieval only;
- disconnect/removal;
- rotation/revalidation lifecycle;
- never log, return or prompt the credential through MCP/model-visible surfaces.

Human decisions still required:

- persistence technology;
- encryption/key-management design;
- production institutional ownership where required.

## S1 — low-risk OpenAI submission protocol preparation

**Status: ELIGIBLE (partially completed)**  
**Priority: useful while S0 is unresolved**

Completed:

- MCP annotation semantics rechecked against current OpenAI/MCP definitions;
- overwrite/rename/clear/delete operations now use `destructiveHint: true`, while additive create operations remain `false`;
- explicit per-tool justifications for `readOnlyHint`, `openWorldHint` and `destructiveHint` are generated from the normative registry;
- `npm run submission:annotations` produces the review artifact and tests pin the destructive/additive/audited-read sets; audited reads explicitly use `readOnlyHint: false` while retaining `doc:read`.
- `chatgpt-app-submission.json` packages the draft listing, 22 tools, five positive and three negative routing scenarios; live reviewer-fixture validation remains pending.

Remaining eligible work:

- prove the final Logto/CIMD client path enables OIDC `openid` and `email` and that UserInfo returns `email` with `email_verified: true`;
- prepare the safe deployment path for `/.well-known/openai-apps-challenge`; activate it only when the OpenAI portal issues the exact token;
- formalize exactly five positive and three negative reviewer scenarios with expected outcomes against the eventual synthetic reviewer fixture;
- audit tool outputs for data minimization and unnecessary diagnostic/internal fields.

Do not invent a domain-verification token or reviewer credential before the relevant live portal/environment exists.

## C6 — production hardening

**Status: BLOCKED by C4/C5 for finalization**  
**Priority: high**

Already integrated:

- explicit Grist upstream abort timeout;
- bounded HTTP request/header reception;
- repository CI/ruleset protection.

Remaining:

- per-principal rate limiting;
- operational metrics and alerting;
- structured audit export if required;
- secret/key rotation procedure;
- controlled deployment and rollback procedure;
- post-deploy synthetic smoke tests.

Independent preparation may proceed only when it does not assume unfinished C4/C5 decisions.

## C7 — reviewer environment

**Status: BLOCKED by C4/C5 and S0 viability**  
**Priority: submission-critical**

OpenAI's current remote-MCP review requirements require:

- ready-to-use demo credentials;
- no MFA, SMS confirmation, email confirmation or private-network dependency;
- synthetic data rather than real educational/administrative data;
- a functioning reviewer Grist identity/credential;
- exactly 5 positive and 3 negative tests;
- explicit expected outcomes.

The production ProConnect path may remain unchanged, but the reviewer path must satisfy these constraints without weakening normal production authentication.

Candidate scenarios are maintained in `docs/OPENAI-SUBMISSION.md`.

## C8 — publisher/submission package

**Status: BLOCKED by S0, C6 and C7**  
**Priority: final**

Final package must be revalidated against current OpenAI requirements and includes at least:

- verified developer/business publisher identity;
- `api.apps.write` / App Management Write permission;
- stable production public HTTPS MCP URL;
- successful current Tool Scan;
- domain verification challenge;
- exact annotations plus per-annotation justifications;
- website, support, privacy and terms HTTPS URLs;
- listing metadata, category, availability, capabilities and release notes;
- up to 3 starter prompts;
- exactly 5 positive + 3 negative review tests;
- reviewer credentials/instructions;
- demo recording URL;
- OAuth OIDC/UserInfo domain-restriction compatibility;
- accurate, non-misleading Grist/DINUM/OpenAI relationship statements.

Initial submission remains MCP-only. Custom UI and skills are not required.

## Deferred feature breadth

Not on the critical path:

- layout mutation;
- page/widget deletion;
- broader widget replacement semantics;
- generated executable custom widgets;
- Apps SDK UI;
- skills;
- arbitrary multi-instance Grist routing;
- generic HTTP forwarding;
- raw SQL;
- arbitrary Grist UserActions.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

While S0 is unresolved, prefer documentation, policy clarification and the bounded S1 preparation above over opening costly C4/C5/C6 implementation branches whose value depends on public-plugin eligibility.

## Controller integration order

When multiple PRs are open, prefer:

1. safe completion/merge of an existing eligible dependency;
2. work that resolves S0 or provides bounded evidence for S1;
3. independent reviewable preparation already underway;
4. new production implementation only when its dependencies and human gates are satisfied.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current OpenAI policy.
