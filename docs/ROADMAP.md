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
C4-P0 Logto/ProConnect MCP POC    ACTIVE (final revocation/refresh evidence remains)
S1 annotation semantics/package   DONE
P0 product architecture baseline  DONE
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam, per-principal Grist context/cache isolation, compact semantic document inspection, audit-aware risk metadata and a first bounded document-UI tranche.

The C4 architecture decision is recorded: ProConnect is the upstream institutional identity source, Logto OSS is the reference MCP-facing authorization server, and `grist-chatgpt` remains a provider-neutral standards-based OAuth resource server. Auth0 EU and Curity Standard remain documented fallbacks.

The product direction is now explicitly split into three parallel axes:

```text
PLATFORM / SECURITY      PRODUCT CAPABILITIES       PUBLIC DISTRIBUTION
C4-P0 -> C4 -> C5        P1 / P2 / P3              S0 + S1
             -> C6              -> P4                    -> C7 -> C8
```

Public-directory eligibility is a distribution gate. It must not block useful private/product development that remains compatible with the agreed security architecture.

## Axis A — platform and security

### C4-P0 — Logto / ProConnect / MCP interoperability POC

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
- public readiness probe returning PASS;
- real ChatGPT Developer Mode connection using CIMD/OIDC through Logto and ProConnect;
- real ChatGPT MCP reads (`list_documents`, document inspection without row disclosure);
- real bounded additive write with targeted re-read verification;
- real destructive delete requiring ChatGPT confirmation and targeted post-delete verification;
- connection persistence across a fresh ChatGPT conversation without a new login;
- ChatGPT-side disconnect removing the connector from subsequent conversations.

Remaining evidence:

- complete the post-revocation lifecycle check after the already-issued access token expires, proving that a removed Logto grant cannot silently renew the ChatGPT authorization;
- capture the final result durably in the POC evidence documents before marking C4-P0 DONE.

Durable evidence:

```text
docs/LOGTO-PROCONNECT-MCP-POC.md
docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md
docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md
docs/CHATGPT-OAUTH-READINESS.md
docs/LOGTO-PROCONNECT-MCP-POC-NEXT.md
```

Do not weaken OAuth/MCP behavior to make a client test pass.

### C4 — production OAuth MCP identity

**Status: BLOCKED by C4-P0 completion**  
**Priority: high**

S0 no longer blocks this product/platform work. C4 is useful for private and institutional operation even if public-directory eligibility remains unresolved.

Goal: productionize the already proven OAuth design rather than redesign it.

Fixed architecture:

- ProConnect upstream identity;
- Logto OSS reference authorization server;
- standards-based JWT/JWKS resource server;
- deployment-configurable canonical resource URI;
- public scopes remain exactly `doc:read`, `doc:write`, `doc.schema:write`;
- provider-specific behavior stays at the edge;
- static bearer may exist only as explicit development/backward-compatible mode.

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

### C6 — production hardening

**Status: PARTLY ELIGIBLE; finalization blocked by C4/C5**  
**Priority: high**

Already integrated:

- explicit Grist upstream abort timeout;
- bounded HTTP request/header reception;
- repository CI/ruleset protection.

Independent preparation that may proceed now when it does not assume unfinished C4/C5 decisions:

- deployment/rollback documentation;
- non-secret operational health/smoke-test design;
- metrics vocabulary;
- audit event format review.

Finalization after C4/C5:

- per-principal rate limiting;
- operational metrics and alerting;
- structured audit export if required;
- secret/key rotation procedure;
- controlled deployment and rollback procedure;
- post-deploy synthetic smoke tests.

## Axis B — product capabilities

The product axis may advance in parallel with C4/C5 when a slice preserves the existing identity, authorization and bounded-operation invariants.

Reference inspirations are not dependencies and must not be copied mechanically:

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

Current baseline already provides:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
- bounded `update_page_widget` title/direct same-table `select-by` behavior.

Eligible non-generic work to study and implement in small slices includes:

- richer safe widget configuration;
- explicit `select-by` option discovery and bounded configuration;
- layout inspection and bounded layout mutation where semantics can be verified;
- configuration of known existing custom widgets/mappings where the upstream contract can be kept bounded.

Human gate before implementation of new destructive surface:

- page deletion;
- widget deletion;
- any new operation that can remove/overwrite broader document UI state.

Those destructive candidates may be designed and tested internally, but must not become model-visible public capabilities without explicit human approval under `AGENTS.md`.

Implementation rule: bounded adapters may internally emit known Grist UserActions, but no arbitrary `/apply` or UserAction payload may be exposed to the model.

### P2 — formula and schema safety

**Status: ELIGIBLE**  
**Priority: high**

Goal: add a bounded `FormulaInspector`-style layer that helps the model detect likely schema/formula mistakes before mutation while leaving Grist authoritative for actual formula evaluation.

Candidate first slice:

- detect referenced `$Column` identifiers;
- detect missing columns and case mismatches;
- surface close existing column names without silently rewriting user intent;
- expose relevant Ref/RefList target information;
- keep formula validation advisory and non-executing.

Do not introduce a Python interpreter, raw SQL or a generic code-execution surface.

### P3 — semantic document context and progressive discovery

**Status: ELIGIBLE**  
**Priority: high**

`inspect_document` is the existing first implementation of the `document_context` idea. P3 should improve it only where the additional semantic value is demonstrated.

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

Attachments are a useful Grist capability and are present in reference MCPs, but they are not on the immediate critical path. Before model-visible attachment operations are added, define exact read/write semantics, data minimization, size bounds and whether any authorization-scope change is required. Adding/removing a public scope remains a human gate.

### P6 — webhooks

**Status: DEFERRED / HUMAN-GATE BEFORE PUBLIC SCOPE CHANGES**

Webhooks may be useful later, but they introduce external effects and likely additional authorization semantics. Do not add a `doc:webhooks`-style public scope or generic webhook management surface without an explicit product/security decision.

### Later product experiments

Not on the current critical path:

- generated executable custom widgets;
- companion Grist widget for visual confirmation/context selection;
- Apps SDK UI;
- distributed skills.

Generated executable widgets are a materially higher-risk capability and require a separate security decision.

## Permanent product/security non-goals

These are not deferred feature requests. They are architectural boundaries unless a later explicit human decision changes the product contract:

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

OpenAI's current public-plugin guidelines state that:

- third-party API integration requires appropriate authorization and compliance with the third party's terms; and
- plugins whose primary function is acting as unofficial connectors to third-party services, including intermediary relay layers, cannot be approved.

This repository explicitly describes itself as an independent, non-official Grist Labs / DINUM / OpenAI integration. No repository evidence currently establishes authorization from Grist Labs or DINUM for public directory distribution.

S0 therefore blocks public publication and publication-specific reviewer investment. It does **not** block private ChatGPT Developer Mode use, Codex use, product-capability development or production-quality platform engineering that is independently useful.

Resolve at least one durable path before public submission is treated as viable:

1. obtain/document the authorization or partnership basis needed for public Grist/DINUM integration; or
2. obtain written OpenAI clarification that this product, including its authentication/authorization and bounded semantic workflow layer, is eligible under the current unofficial-connector rule.

If OpenAI says explicit third-party authorization is required, determine which authorization is actually needed for the intended deployment/listing: Grist Labs, DINUM/La Suite numérique, both, or neither beyond the documented license/API/user-authorization model.

A plugin submission draft may be created to obtain a submission/plugin identifier for an OpenAI support clarification. Do not claim an official relationship that has not been explicitly established.

The decision package and exact clarification questions are tracked in GitHub issue #58.

### S1 — low-risk OpenAI submission protocol preparation

**Status: ELIGIBLE (partially completed)**  
**Priority: useful while S0 is unresolved**

Completed:

- MCP annotation semantics rechecked against current OpenAI/MCP definitions;
- overwrite/rename/clear/delete operations use `destructiveHint: true`, while additive create operations remain `false`;
- explicit per-tool justifications for `readOnlyHint`, `openWorldHint` and `destructiveHint` derive from the normative registry;
- `npm run submission:annotations` produces the review artifact and tests pin the destructive/additive/audited-read sets;
- `chatgpt-app-submission.json` packages the draft listing, 22 tools, five positive and three negative routing scenarios;
- real ChatGPT CIMD/OIDC connection has now demonstrated `openid`/`email` compatibility after enabling the corresponding Dynamic app permissions.

Remaining eligible work:

- prove UserInfo returns `email` with `email_verified: true` on the final reviewer-compatible path;
- prepare the safe deployment path for `/.well-known/openai-apps-challenge`; activate it only when the OpenAI portal issues the exact token;
- formalize exactly five positive and three negative reviewer scenarios with expected outcomes against the eventual synthetic reviewer fixture;
- audit tool outputs for data minimization and unnecessary diagnostic/internal fields.

Do not invent a domain-verification token or reviewer credential before the relevant live portal/environment exists.

### C7 — reviewer environment

**Status: BLOCKED by C5 and S0 viability; final auth path also depends on production C4**  
**Priority: submission-critical only if S0 is viable**

OpenAI's current remote-MCP review requirements require:

- ready-to-use demo credentials;
- no MFA, SMS confirmation, email confirmation or private-network dependency;
- synthetic data rather than real educational/administrative data;
- a functioning reviewer Grist identity/credential;
- exactly 5 positive and 3 negative tests;
- explicit expected outcomes.

The production ProConnect path may remain unchanged, but the reviewer path must satisfy these constraints without weakening normal production authentication.

Candidate scenarios are maintained in `docs/OPENAI-SUBMISSION.md`.

### C8 — publisher/submission package

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

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

Preferred parallel pattern after C4-P0:

```text
Worker platform  -> C4 production / C5 preparation
Worker product   -> one bounded P1, P2 or P3 slice
Controller       -> integration, dependency review, S0/S1 and human gates
```

While the final C4-P0 revocation test is still running, product work may proceed on independent branches, but do not redeploy an unrelated functional build over the POC server until the evidence capture is complete.

## Controller integration order

When multiple PRs are open, prefer:

1. safe completion/merge of an existing eligible dependency;
2. small independent product/platform slices whose invariants are already fixed;
3. work that resolves S0 or provides bounded S1 evidence;
4. work blocked on an unresolved human product/security decision only after that decision is obtained.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current OpenAI policy.
