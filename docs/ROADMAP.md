# Roadmap

This roadmap is the authoritative dependency map for autonomous development. It separates product/platform work from public-directory distribution so useful engineering can continue even while publication eligibility remains unresolved.

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
C4-P0 Logto/ProConnect MCP POC    DONE
S1 annotation semantics/package   DONE
P0 product architecture baseline  DONE
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam, per-principal Grist context/cache isolation, compact semantic document inspection, audit-aware risk metadata and a first bounded document-UI tranche. Since that baseline, `main` also contains bounded direct select-by option discovery, the first advisory formula-reference inspection slice, a non-secret OAuth deployment smoke command/runbook, and explicit minimization of public document-discovery metadata.

The C4 architecture decision is fixed: ProConnect is the upstream institutional identity source, Logto OSS is the reference MCP-facing authorization server, and `grist-chatgpt` remains a provider-neutral standards-based OAuth resource server. Auth0 EU and Curity Standard remain documented fallbacks.

The project now advances on three parallel axes:

```text
PLATFORM / SECURITY      PRODUCT CAPABILITIES       PUBLIC DISTRIBUTION
C4 -> C5 -> C6           P1 / P2 / P3              S0 + S1
                              -> P4                     -> C7 -> C8
```

Public-directory eligibility is a distribution gate. It does not block private ChatGPT Developer Mode use, Codex use, product-capability development or production-quality platform engineering that is independently useful.

## Axis A — platform and security

### C4-P0 — Logto / ProConnect / MCP interoperability POC

**Status: DONE**

Live evidence now covers the full POC exit path:

- Logto OSS + PostgreSQL non-production deployment;
- ProConnect federation and stable identity mapping;
- Authorization Code + PKCE `S256`;
- RFC 8707 canonical resource binding;
- JWT/JWKS, issuer, audience/resource and expiry validation;
- fixed scopes `doc:read`, `doc:write`, `doc.schema:write`;
- dynamic principal and principal-bound Grist context construction;
- wrong-resource and insufficient-scope rejection before mutation;
- RFC 9728 protected-resource metadata and OAuth challenges;
- Logto Dynamic app / CIMD with ChatGPT client metadata accepted;
- OIDC `openid` / `email` compatibility after enabling the corresponding Dynamic app permissions;
- real ChatGPT Developer Mode connection through Logto -> ProConnect -> Logto;
- real ChatGPT MCP reads;
- bounded additive write followed by targeted re-read;
- destructive delete with ChatGPT confirmation followed by targeted post-delete verification;
- connection persistence across a fresh ChatGPT conversation without full reauthentication;
- ChatGPT-side disconnect removes the connector from subsequent conversations;
- Logto grant removal leaves an already-issued access token usable only until expiry;
- after the configured 3600-second access-token lifetime, ChatGPT cannot silently renew the removed authorization and presents a reconnect prompt.

Durable evidence lives in:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
docs/CHATGPT-OAUTH-READINESS.md
docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md
```

Secondary operational unknowns such as a controlled full-host reboot are not C4-P0 exit blockers.

### C4 — production OAuth MCP identity

**Status: ELIGIBLE**  
**Priority: high**

Goal: productionize the already proven OAuth design rather than redesign it.

Fixed architecture:

- ProConnect upstream identity;
- Logto OSS reference authorization server;
- standards-based JWT/JWKS resource server;
- deployment-configurable canonical resource URI;
- public scopes remain exactly `doc:read`, `doc:write`, `doc.schema:write`;
- provider-specific behavior stays at the edge;
- static bearer may exist only as explicit development/backward-compatible mode.

Integrated productionization preparation now includes the offline OAuth deployment preflight, the operator release/rollback runbook, and `smoke:oauth-deployment`, a non-secret public smoke check for `/healthz`, protected-resource metadata and the unauthenticated MCP challenge. These checks intentionally do not substitute for authenticated issuer/JWKS, token, federation or Grist evidence.

C4 must still turn POC deployment/configuration/evidence into a repeatable production-quality operating model while preserving provider neutrality. Remaining C4 evidence includes exercising the documented release/rollback path on the intended deployment and recording issuer/JWKS key-rotation and outage/recovery behavior.

### C5 — secure Grist onboarding and credential lifecycle

**Status: BLOCKED by C4 and human persistence/encryption decisions**  
**Priority: required before multi-user operation**

Goal: allow an authenticated user to securely connect that user's own Grist Community API key outside model-visible MCP data.

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

No second real user/reviewer may rely on the current static Grist credential path as if it were isolated per user.

The minimum human decision package is maintained in `docs/C5-DECISION.md`;
it records required choices without selecting a persistence or encryption design.

### C6 — production hardening

**Status: PARTLY ELIGIBLE; finalization blocked by C4/C5**  
**Priority: high**

Already integrated:

- explicit Grist upstream abort timeout;
- bounded HTTP request/header reception;
- repository CI/ruleset protection;
- deployment/rollback operating documentation;
- offline OAuth deployment preflight;
- non-secret public post-deploy/rollback smoke checks.

Independent preparation that may proceed now:

- metrics vocabulary;
- audit event format review.

Finalization after C4/C5:

- per-principal rate limiting;
- operational metrics and alerting;
- structured audit export if required;
- secret/key rotation procedure;
- controlled production deployment and rollback evidence;
- authenticated post-deploy synthetic smoke evidence.

## Axis B — product capabilities

The product axis may advance in parallel with C4/C5 when a slice preserves the existing identity, authorization and bounded-operation invariants.

Reference inspirations are design provenance, not dependencies:

- Grist's official MCP is the main functional oracle for Grist-native semantics;
- Xe138/grist-mcp-server inspired granular principal/resource/capability policy and audit ideas;
- gwhthompson/grist-mcp-server inspired a compact, progressively discoverable MCP surface;
- nic01asFr/mcp-server-grist and GristCoder inspired safe semantic operations, formula inspection and compact document context.

### P0 — product architecture baseline

**Status: DONE**

Already integrated:

- one bounded business layer shared by MCP and compatibility adapters;
- `Principal` + resource grants + capabilities;
- `AuthorizationService` / authorized Grist service path;
- credential-provider seam;
- normative operation registry;
- audit-aware operation metadata;
- `grist_help`;
- compact `inspect_document` context;
- bounded records and schema operations;
- initial page/widget inspection and mutation operations;
- explicit partial/ambiguous-write semantics.

### P1 — document UI parity

**Status: ELIGIBLE**  
**Priority: highest product-expansion tranche**

Goal: move from the current bounded v0.6 UI slice toward the useful subset of the official Grist MCP document-design semantics without exposing arbitrary UserActions.

Current baseline:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
- bounded `update_page_widget` title/direct same-table `select-by` behavior;
- bounded `directSelectByOptions` discovery for supported same-page/same-table sources, with cycle checks and explicit truncation semantics.

Eligible non-generic work, in small slices:

- richer safe widget configuration;
- further explicit `select-by` configuration only where semantics remain bounded and verifiable;
- layout inspection and bounded layout mutation where semantics can be verified;
- configuration of known existing custom widgets/mappings where the upstream contract can be kept bounded.

Human gate before exposing any new destructive surface:

- page deletion;
- widget deletion;
- any new operation that can remove/overwrite broader document UI state.

Bounded adapters may internally emit known Grist UserActions, but no arbitrary `/apply` or UserAction payload may be exposed to the model.

### P2 — formula and schema safety

**Status: ELIGIBLE**  
**Priority: high**

Goal: add a bounded `FormulaInspector`-style layer that helps the model detect likely schema/formula mistakes before mutation while leaving Grist authoritative for actual formula evaluation.

Integrated first slice:

- `inspect_document` detects referenced `$Column` identifiers without executing formulas;
- references in quoted strings/comments are ignored and analysis is bounded/deduplicated;
- exact matches, unique case mismatches and missing columns are distinguished;
- up to three deterministic close existing-column suggestions are surfaced without rewriting user intent;
- matching/suggested Ref/RefList columns expose their target table;
- document context summarizes formula-reference and warning counts.

Further P2 work should proceed only where additional advisory schema/formula value is demonstrated and can stay non-executing and bounded.

Do not introduce a Python interpreter, raw SQL or a generic code-execution surface.

### P3 — semantic document context and progressive discovery

**Status: ELIGIBLE**  
**Priority: high**

`inspect_document` is the existing first implementation of the `document_context` idea. P3 should improve it only where additional semantic value is demonstrated.

Candidate slices:

- richer normalized relation graph;
- more compact summaries for large schemas;
- richer normalized UI/select-by context;
- cache/invalidation behavior that remains principal-isolated;
- optional MCP resource form such as `grist://documents/{id}/context` if it improves clients without duplicating unsafe data;
- progressively discoverable help/examples derived from the normative registry.

Do not indiscriminately load user-table rows into document context.

### P4 — compact MCP surface

**Status: BLOCKED by stabilization of P1/P2/P3**  
**Priority: medium**

Goal: evaluate whether the public surface should converge from many narrow tools toward a smaller user-intent surface such as records/schema/pages managers while preserving:

```text
1 invocation = 1 bounded semantic intention
```

Do not create a broad multi-action super-tool or pseudo-transaction that obscures partial success and risk annotations.

The existing public v1 operations remain the stable compatibility surface until a migration contract is explicitly designed and tested.

### P5 — attachments

**Status: DEFERRED**

Attachments are useful but not on the immediate critical path. Before adding model-visible attachment operations, define exact read/write semantics, data minimization, size bounds and whether any authorization-scope change is required. Adding/removing a public scope remains a human gate.

### P6 — webhooks

**Status: DEFERRED / HUMAN GATE BEFORE PUBLIC SCOPE CHANGES**

Webhooks introduce external effects and likely additional authorization semantics. Do not add a `doc:webhooks`-style public scope or generic webhook-management surface without an explicit product/security decision.

### Later product experiments

Not on the current critical path:

- generated executable custom widgets;
- companion Grist widget for visual confirmation/context selection;
- Apps SDK UI;
- distributed skills.

Generated executable widgets are a materially higher-risk capability and require a separate security decision.

## Permanent product/security non-goals

These are architectural boundaries, not deferred feature requests:

- generic HTTP forwarding;
- raw SQL model surface;
- arbitrary Grist `/apply`;
- arbitrary Grist UserActions;
- generic user/ACL administration by the model;
- model-visible credentials or secrets;
- deletion by broad filter when explicit stable identifiers can be required;
- blind automatic replay of partial/ambiguous writes;
- arbitrary multi-instance Grist routing in the initial product.

## Axis C — public distribution

### S0 — public-plugin eligibility

**Status: BLOCKED / HUMAN-INSTITUTIONAL GATE**  
**Priority: highest only for public OpenAI directory publication**

S0 blocks public publication and publication-specific reviewer investment. It does **not** block private ChatGPT Developer Mode use, Codex use, product-capability development or production-quality platform engineering that is independently useful.

The unresolved question is whether OpenAI will accept this independent Grist Community integration under its current rule against plugins whose primary function is acting as unofficial connectors to third-party services.

Resolve a durable path before public submission is treated as viable:

1. obtain written OpenAI clarification that the product is eligible; and, only if required,
2. obtain the relevant Grist Labs / DINUM authorization basis.

Issue #58 contains the exact clarification package. Do not claim an official relationship that has not been explicitly established.

### S1 — low-risk OpenAI submission protocol preparation

**Status: ELIGIBLE (partially completed)**

Completed:

- annotation semantics and per-tool justifications;
- submission artifact generation;
- draft `chatgpt-app-submission.json` with 22 tools, five positive and three negative routing scenarios;
- real ChatGPT CIMD/OIDC connection proving `openid` / `email` compatibility after the corresponding Dynamic app permissions were enabled;
- document discovery now explicitly projects only the public org/workspace/document identifiers, names and access metadata needed by the bridge contract instead of forwarding arbitrary upstream extension fields.

Remaining eligible work:

- prove UserInfo returns `email` with `email_verified: true` on the final reviewer-compatible path;
- prepare the safe deployment path for `/.well-known/openai-apps-challenge`; activate it only when the OpenAI portal issues the exact token;
- formalize exactly five positive and three negative reviewer scenarios with expected outcomes against the eventual synthetic reviewer fixture;
- continue auditing other tool outputs for unnecessary diagnostic/internal fields.

### C7 — reviewer environment

**Status: BLOCKED by C5 and S0 viability; final auth path also depends on production C4**

Required only if S0 becomes viable. The reviewer path must use synthetic data and ready-to-use credentials without MFA/SMS/email-confirmation/private-network dependencies, while not weakening normal production authentication.

### C8 — publisher/submission package

**Status: BLOCKED by S0, C6 and C7**

Final package includes the current production MCP URL, Tool Scan, domain challenge, publisher/legal metadata, annotations and justifications, reviewer credentials/instructions, demo recording and the exact current review-test package.

Initial submission remains MCP-only. Custom UI and skills are not required.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

Preferred steady state now that C4-P0 is DONE:

```text
Worker A: platform/security (C4, then C5/C6 as eligible)
Worker B: product capability (P1 first; P2/P3 when independently useful)
Controller: integration, dependency control, human gates, S0/S1 coordination
```

Do not deploy a product-feature branch onto the shared POC/production endpoint merely to test code if that would destroy an active authentication/security experiment. Use isolated test evidence when needed.

## Controller integration order

When multiple PRs are open, prefer:

1. close a ready existing dependency;
2. integrate small platform/security slices that keep the proven OAuth contract stable;
3. integrate independent bounded product slices;
4. progress low-risk S1 preparation while S0 remains unresolved;
5. stop at human gates rather than embedding unapproved persistence, scope, destructive-surface, institutional or branding decisions.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current external requirements.
