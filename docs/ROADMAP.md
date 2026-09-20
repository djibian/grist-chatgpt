# Roadmap

This roadmap is the authoritative dependency map for autonomous development. It separates product/platform work from public-directory distribution so useful engineering can continue even while publication eligibility remains unresolved.

Status vocabulary:

- **DONE** — integrated on `main` and no longer active;
- **ELIGIBLE** — useful work can start now;
- **ACTIVE** — work is underway or an implementation/evidence tranche remains open;
- **BLOCKED** — a named dependency or human decision is missing;
- **DEFERRED** — intentionally not part of the current critical path.

Priority does not imply eligibility.

## Roadmap execution contract

Autonomous expansion is finite. For every major ELIGIBLE/ACTIVE tranche, the roadmap must make the completion path explicit through its goal, exit criteria, finite committed next work and blockers/human gates.

Rules:

- only work explicitly listed as current/remaining/committed work is autonomously eligible;
- candidate ideas, inspirations and possible enrichments are not eligible merely because they are documented;
- a new committed slice may be added autonomously only when it is necessary to satisfy an already-defined exit criterion and introduces no new product/security decision;
- broader scope expansion requires an explicit roadmap decision;
- when a tranche has no committed work left and its exit criteria appear satisfied, the Controller triggers the integrated tranche-completion review instead of inventing another improvement;
- a dependent tranche is unlocked only after the required integrated review records PASS against exact `main` and the roadmap is updated accordingly.

## Current baseline

```text
V0.6 bounded document UI          DONE
C1 credential abstraction         DONE
C2 MCP contract v1                DONE
C3 user-aware Grist context       DONE
C4-P0 Logto/ProConnect MCP POC    DONE
S1 annotation semantics/package   DONE
P0 product architecture baseline  DONE
P1 document UI parity             DONE
P2 formula/schema safety          DONE
P3 semantic context/discovery     DONE
Q0 retrospective code assurance  DONE
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam, per-principal Grist context/cache isolation, compact semantic document inspection, audit-aware risk metadata and a bounded document-UI surface. `main` contains bounded direct and Ref/RefList column select-by option discovery/configuration, bounded widget saved-sort configuration through stable column IDs, bounded normalized page-layout inspection and mutation through stable widget IDs, bounded normalized existing-custom-widget access/mapping inspection and mutation through stable column IDs, bounded table/grid display-option inspection and mutation while preserving unrelated widget options, bounded advisory formula-reference and one-hop reference-field inspection with explicit unavailable-target incompleteness, a non-secret OAuth deployment smoke command/runbook, explicit minimization of public discovery metadata and success-only mutation results while preserving functional creation IDs, a documented production observability/audit contract, bounded widget-description mutation with post-write verification, bounded native chart-type configuration for explicitly identified chart widgets, and the completed Q0 repairs that enforce the internal metadata-table boundary, close schema-mutation metadata allowlists and fail closed on potentially truncated UI metadata snapshots.

The C4 architecture decision is fixed: ProConnect is the upstream institutional identity source, Logto OSS is the reference MCP-facing authorization server, and `grist-chatgpt` remains a provider-neutral standards-based OAuth resource server. Auth0 EU and Curity Standard remain documented fallbacks.

The project advances on three product/platform/distribution axes. Q0 remains recorded below as the completed retrospective trust-baseline tranche:

```text
QUALITY ASSURANCE         PLATFORM / SECURITY      PRODUCT CAPABILITIES       PUBLIC DISTRIBUTION
Q0 DONE                   C4 -> C5 -> C6           P1 / P2 / P3 DONE         S0 + S1
                                                       -> P4                     -> C7 -> C8
```

Q0 established the post-audit runtime trust baseline. New bounded product work may proceed only when its own finite roadmap tranche is explicitly defined and eligible.

Public-directory approval remains an external review risk. It does not block private ChatGPT Developer Mode use, Codex use, product-capability development or production-quality platform engineering. After the 2026-09-20 pre-review clarification recorded in issue #58, it also does not create a separate pre-approval prerequisite for C7/C8 preparation: actual OpenAI review is the point that resolves final eligibility.

## Cross-cutting quality assurance

### Q0 — retrospective code assurance

**Status: DONE**  
**Priority: completed stabilization baseline**

Goal: subject the complete integrated runtime inherited from the project's pre-review phases to one finite retrospective assurance pass under the repository's current correctness, security, contract and review standards, then establish a trusted post-Q0 baseline without an open-ended cleanup rewrite.

Initial runtime audit baseline:

```text
2f811ee34cbeb32c9c945aeb217de34fba5065f2
```

That exact `main` includes the independently reviewed P2 repair from PR #106 and the bounded grid-display work from PR #102. The Q0 setup documentation itself does not alter that runtime baseline.

Audit method and evidence rules are defined in `docs/RETROSPECTIVE-CODE-ASSURANCE.md`. The fixed read-only inventory against runtime baseline `2f811ee34cbeb32c9c945aeb217de34fba5065f2` found exactly three BLOCKING findings and no separate REQUIRED finding: an incomplete model-facing `_grist_*` metadata-table boundary, open-ended schema metadata mutation dictionaries that violated the stable bounded public contract, and silently truncated document-UI metadata snapshots that could weaken safety-sensitive graph validation. Those findings were repaired by independently reviewed PRs #110 (Q0-F1), #111 (Q0-F2) and #112 (Q0-F3).

Exit criteria:

- every current runtime domain named in the Q0 protocol has been reviewed at least once against the current repository invariants and exact audited `main` is recorded;
- no unresolved **BLOCKING** correctness, authorization/security, privacy, data-integrity, contract or replay/ambiguity finding remains;
- every **REQUIRED** assurance finding has either been repaired through the normal exact-head CI/independent-review process or explicitly reclassified with durable evidence;
- critical authorization, mutation, partial-failure, stable-ID/normalization and public-contract boundaries have adequate positive, negative and failure/ambiguity characterization where material;
- operation registry, MCP surface, GPT Actions/OpenAPI compatibility surface, runtime semantics and current-state documentation tell one materially coherent story;
- remaining cosmetic/style/speculative-refactor/tooling debt is explicitly **DEFERRED** rather than used to keep Q0 open;
- a fresh integrated Q0 tranche review records `PASS` against an exact post-repair `main` SHA.

Integrated tranche review: **PASS** against exact `main` `998d9db4731f1fdfe9f807b441593d4d92c65e04`. That exact tree is content-identical to the exact tested Q0-F3 head `aba169fced2dcf34f1976e22e4b00a8644aee8e2`; Q0-F1, Q0-F2 and Q0-F3 were each independently reviewed and integrated with exact-head CI. The integrated review found no new BLOCKING or REQUIRED item: F1 rejects model-facing `_grist_*` identifiers while preserving trusted internal metadata reads, F2 applies one closed semantic schema-mutation contract across MCP and GPT Actions/OpenAPI, and F3 makes bounded UI-metadata incompleteness explicit and fail-closed before safety-sensitive mutation or exact post-write verification. Existing identity/isolation, partial-write, stable-ID/normalization and output-minimization evidence from the fixed inventory remains applicable, and the committed Q0 set is exhausted.

Completed Q0 repair slices:

1. **Q0-F1 — internal metadata table boundary** — PR #110 centralizes and tests rejection of model-facing `_grist_*` record/schema/table identifiers, including create/rename targets, while preserving trusted bridge-internal metadata access.
2. **Q0-F2 — bounded schema mutation fields** — PR #111 replaces arbitrary table/column metadata mutation dictionaries with one finite stable semantic allowlist shared materially across MCP and GPT Actions/OpenAPI, with accepted/unknown/unstable-field contract tests.
3. **Q0-F3 — fail-closed UI metadata completeness** — PR #112 marks potentially truncated bounded page/view/section metadata snapshots explicitly and rejects UI mutations whose safety validation or exact verification requires a complete snapshot.
4. **integrated Q0 completion review** — PASS recorded above against exact post-repair `main` `998d9db4731f1fdfe9f807b441593d4d92c65e04`.

No fourth cleanup slice is committed. Generic cleanup, style-only, broad rewrite, blanket coverage, lint, complexity and mutation-testing ideas remain deferred unless a future concrete invariant justifies separate roadmap work.

Post-Q0 dependency state:

- P1, P2 and P3 have passed their required integrated reviews and are DONE;
- P4's former P1/Q0/P2/P3 dependency chain is satisfied and its finite evaluation-only tranche is eligible; no runtime/public-contract migration is implied by that evaluation;
- C6's Q0 prerequisite is satisfied, but C6 finalization still waits for C4/C5;
- C4 operational evidence and S1's remaining low-risk external evidence remain independently eligible when the required external environment/evidence is available.

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

Exit criteria:

- the documented release/rollback path has been exercised on the intended deployment and evidence recorded;
- issuer/JWKS key-rotation behavior and authorization-server outage/recovery behavior have been exercised and recorded;
- production configuration/runbooks remain provider-neutral and coherent with the validated OAuth contract.

Committed remaining C4 work:

1. exercise and record the intended deployment release/rollback path;
2. exercise and record issuer/JWKS key rotation plus outage/recovery behavior.

No new identity-provider selection work is part of C4.

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

**Status: BLOCKED by C4/C5 for remaining finalization**  
**Priority: high**

Already integrated:

- explicit Grist upstream abort timeout;
- bounded HTTP request/header reception;
- repository CI/ruleset protection;
- deployment/rollback operating documentation;
- offline OAuth deployment preflight;
- non-secret public post-deploy/rollback smoke checks;
- bounded production metrics vocabulary with low-cardinality label rules;
- review and documentation of the current structured audit event contract, including correlation/privacy boundaries.

Remaining finalization after C4/C5:

- per-principal rate limiting;
- operational metrics and alerting;
- structured audit export if required;
- secret/key rotation procedure;
- controlled production deployment and rollback evidence;
- authenticated post-deploy synthetic smoke evidence.

## Axis B — product capabilities

The product axis may advance now that Q0, P1, P2 and P3 are DONE only when a later tranche has an explicit finite roadmap contract and preserves the existing identity, authorization and bounded-operation invariants.

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

**Status: DONE**  
**Priority: completed product-capability tranche**

Goal: provide the useful bounded subset of Grist document-design semantics needed for realistic page/widget work without exposing arbitrary UserActions.

Current baseline:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
- bounded `update_page_layout` using stable current widget IDs, an exact placed/collapsed partition of all current page widgets, bounded node/depth/collapsed-ID counts, fixed internal `_grist_Views.layoutSpec` mutation and exact normalized post-write verification;
- bounded `update_page_widget` title/description/native chart-type/saved-sort/select-by/custom-widget-settings/table-grid-display behavior, including explicit description clearing, chart-only enforcement and normalized post-write verification;
- bounded saved-sort configuration using at most 20 stable current column IDs with `asc`/`desc` plus optional `emptyLast`, Text-only `naturalSort` and Choice/ChoiceList-only `orderByChoice`; internal numeric `colRef` values are resolved server-side only, schema resolution is capped at 5,000 columns, and the exact encoded post-state is verified by re-read;
- bounded `directSelectByOptions` discovery for supported same-page/same-table sources, with cycle checks and explicit truncation semantics;
- bounded `columnSelectByOptions` discovery/configuration for explicit non-summary `Ref`/`RefList` links, using reusable column IDs rather than invented numeric refs, excluding Attachments, chart/custom sources and cycles, with a 5,000-column schema ceiling plus response/candidate truncation semantics;
- read-only page layout normalization preserves the Grist BoxSpec grouping/order and finite non-negative sizes while replacing verified leaves with stable current widget IDs; collapsed/currently unplaced widget IDs are exposed separately, raw `layoutSpec` is retained for compatibility, and stale/duplicate/malformed state produces `layoutNormalizationIncomplete` rather than guessed output;
- layout normalization is capped at 1,000 tree nodes, depth 50 and 1,000 collapsed/unplaced IDs and performs no additional upstream read;
- existing `type === "custom"` widgets expose additive `customWidgetSettings` with normalized access, optional stable gallery/bundled `widgetId`, and single/list/null column mappings translated from Grist numeric refs to current stable column IDs; URLs, plugin identifiers and arbitrary widget-owned options are deliberately excluded from that normalized view;
- custom-widget mapping normalization and mutation are capped at 100 mapping keys, 1,000 mapped columns and 5,000 schema columns, exclude the legacy native-calendar alias `custom.calendar`, and never expose numeric Grist column refs as model inputs;
- bounded custom-widget mutation may change only access (`none`, `read table`, `full`) and stable-ID column mappings for an explicitly identified existing custom widget; the bridge read-modify-writes the complete `options` object, preserves URL/plugin/widget identity and arbitrary widget-owned options, and verifies the complete expected options object after re-read; malformed or unresolved state is rejected before write and post-write disagreement is non-retryable;
- table widgets expose normalized bounded `gridOptions` for vertical/horizontal gridlines, zebra stripes and row-number mode; `update_page_widget` may mutate only those named settings for an explicitly identified table widget, preserves every unrelated option through read-modify-write, rejects malformed current options, and verifies the complete expected options object after re-read.

Exit criteria:

- the current bounded UI baseline plus the committed slices are integrated with stable-ID inputs, bounded semantics and exact post-write verification for mutations;
- document-UI contracts, tests and current-state documentation are coherent;
- no arbitrary UserAction, generic `/apply`, arbitrary custom-option payload or newly destructive UI surface is exposed;
- no other non-destructive UI slice is required to satisfy the stated P1 goal.

Integrated tranche review: **PASS** against exact `main` `bc44d1f03d30db2e0e3951c96a06cc7ae113548e`. The bounded page-layout mutation from PR #115 is integrated on that exact tree, its exact merge-commit CI passed, and the prior review finding on the service-level read → fixed write → re-read path was repaired with focused regression tests covering successful exact serialization/verification, pre-write refusal of incomplete current layout metadata and non-retryable `UiWriteVerificationError` on post-write divergence. The public MCP and GPT Actions/OpenAPI contracts use the same authorized service path, require `doc.schema:write`, accept only bounded stable current widget IDs, expose no arbitrary UserAction or raw layout metadata write surface, and preserve the existing fail-closed/ambiguous-write semantics. No committed P1 work remains.

Committed next P1 slices: **none**.

Deferred P1 candidates — not autonomously eligible unless explicitly promoted:

- additional safe widget configuration beyond the committed slices;
- further select-by variants beyond the currently supported direct and Ref/RefList semantics;
- widget-owned custom options, which first require a separate bounded JSON size/depth/value contract;
- page deletion;
- widget deletion;
- any operation that can remove/overwrite broader document UI state.

The destructive candidates remain human-gated. Bounded adapters may internally emit known Grist UserActions, but no arbitrary `/apply` or UserAction payload may be exposed to the model.

### P2 — formula and schema safety

**Status: DONE**  
**Priority: high**

Goal: provide a bounded non-executing `FormulaInspector`-style layer that detects likely schema/formula mistakes before mutation while leaving Grist authoritative for actual formula evaluation.

Integrated advisory slices:

- `inspect_document` detects referenced `$Column` identifiers without executing formulas;
- references in quoted strings/comments are ignored and analysis is bounded/deduplicated;
- exact matches, unique case mismatches and missing columns are distinguished;
- up to three deterministic close existing-column suggestions are surfaced without rewriting user intent;
- matching/suggested Ref/RefList columns expose their target table;
- when expanded document schema is already available, exact one-hop `$Ref.Field` and `$RefList.Field` lookups are checked against the referenced table with the same exact/case-mismatch/missing semantics and suggestions;
- one-hop dereference inspection is independently capped at 100, ignores method-like/deeper-chain Python expressions and implicit `id`, performs no extra upstream read, never invents a warning when target-table metadata is unavailable, and now exposes `dereferencesIncomplete: true` when a current Ref/RefList source resolves but its target-table metadata is unavailable;
- document context preserves the complete bounded `formulaAnalysis` object while summarizing local formula references, checked dereferences, dereference warnings and aggregate formula warnings.

Exit criteria:

- local and one-hop reference diagnostics remain bounded, advisory and non-executing;
- unavailable metadata yields explicit incompleteness rather than invented conclusions;
- no Python interpreter, raw SQL or generic code-execution surface is introduced;
- tests/documentation cover the integrated advisory behavior and no committed P2 slice remains.

Integrated tranche review: **PASS** against exact `main` `2f811ee34cbeb32c9c945aeb217de34fba5065f2`. The prior review finding was repaired by independently reviewed PR #106: unavailable Ref/RefList target metadata now produces explicit bounded incompleteness without an extra upstream read or an invented missing-field diagnosis. `DocumentContextService` preserves that analysis in the returned column context, the repair has focused positive/negative tests, and no committed P2 work remains.

Committed next P2 slices: **none**.

Further formula/schema ideas remain deferred until an explicit roadmap decision demonstrates additional value and promotes a bounded slice.

### P3 — semantic document context and progressive discovery

**Status: DONE**  
**Priority: high**

Goal: provide compact semantic document context and progressive discovery that expose useful stable relationships/UI state without indiscriminate row disclosure or guessed normalization.

Integrated tranche review: **PASS** against exact `main` `9aa5cc42edcf1306c2d14b742a1deefa40dfdf43`. The integrated UI/relation normalizers fail closed with explicit incompleteness markers, progressive help derives operation metadata from the normative registry, `inspect_document` does not load user-table rows, and credential-derived contexts/caches remain principal-isolated. No committed P3 work remains.

Integrated normalized UI slice:

- page context exposes additive bounded `layoutNormalized` trees whose leaves are verified stable widget IDs, plus collapsed/unplaced widget IDs and `layoutNormalizationIncomplete` when raw Grist BoxSpec state cannot be represented exactly; raw `layoutSpec` remains for v1 compatibility;
- existing custom-widget context exposes data-minimized access/widget identity and stable-ID column mappings with explicit normalization incompleteness; custom URLs/plugin internals/widget-owned arbitrary options are not duplicated into the normalized semantic view;
- when expanded table metadata is available, widget context exposes additive stable-ID `sort` entries derived from native `sortColRefs`, plus `sortNormalizationIncomplete` when malformed, unsupported or unresolved raw entries prevent exact normalization;
- normalization uses the same 20-key and 5,000-column bounds as saved-sort configuration, never guesses unsupported semantics, and retains raw `sortColRefs` for v1 compatibility;
- non-expanded internal UI reads do not claim normalized saved-sort state;
- existing direct select-by links expose additive stable-ID `selectByNormalized: { sourceWidgetId }` when the source widget resolves exactly;
- existing column select-by links additionally expose stable `sourceColumnId` / `targetColumnId` values when expanded table metadata resolves every numeric reference exactly, while `selectByNormalizationIncomplete` marks unresolved/unsupported raw state and no partial normalized link is guessed;
- select-by normalization is bounded to 5,000 columns and retains raw v1 numeric `selectBy` metadata for compatibility.

Integrated normalized relation slice:

- `Ref` / `RefList` relationships keep their stable forward table/column IDs and, when Grist declares a two-way `reverseCol`, expose additive stable-ID `reverse: { table, column, kind }` metadata only after exact bidirectional verification;
- reverse normalization requires the reverse column to belong to the target table, point semantically back to the source table and have a `reverseCol` that points back to the source `colRef`;
- unresolved or inconsistent declared reverse links expose only `reverseResolutionIncomplete: true`; numeric `colRef` / `reverseCol` values stay internal and no additional upstream read is performed.

Integrated progressive-discovery slice:

- `grist_help` keeps the historical complete-catalog default while adding compact per-category operation counts and an optional category filter that is mutually exclusive with explicit operation-name filtering;
- opt-in `includeWorkflows` returns common discover/read/create+verify/schema-change+verify/UI-configure+verify sequences, with every step title/capability/destructive flag resolved from the normative registry rather than duplicated;
- workflows are descriptive only, execute no operation and duplicate no tool input payload schema.

Exit criteria:

- semantic context exposes stable normalized schema/relation/UI state only when it can be resolved exactly, with explicit incompleteness otherwise;
- discovery remains compact/progressive and does not duplicate unsafe payload schemas;
- user-table rows are not indiscriminately loaded into context;
- principal-derived caches/context remain isolated;
- tests/documentation cover the integrated behavior and no committed P3 slice remains.

Committed next P3 slices: **none**.

Deferred P3 candidates — not autonomously eligible unless explicitly promoted:

- further relation-graph enrichment;
- more compact large-schema summaries;
- additional normalized UI/select-by context;
- new cache/invalidation behavior;
- optional MCP resource forms such as `grist://documents/{id}/context`.

### P4 — compact MCP surface

**Status: ELIGIBLE**  
**Priority: medium**

Goal: evaluate whether the public surface should converge from many narrow tools toward a smaller user-intent surface such as records/schema/pages managers while preserving:

```text
1 invocation = 1 bounded semantic intention
```

Do not create a broad multi-action super-tool or pseudo-transaction that obscures partial success and risk annotations.

The existing public v1 operations remain the stable compatibility surface until a migration contract is explicitly designed and tested.

Exit criteria:

- the exact current v1 operation set is inventoried by category, capability and risk semantics, including read/write/destructive and partial/ambiguous-write behavior where material;
- plausible compaction patterns are evaluated against per-operation MCP risk metadata, stable bounded intent, authorization capability boundaries, partial-success/replay semantics, progressive discovery and compatibility/data-minimization constraints;
- one explicit decision is recorded: **KEEP** the current narrow v1 surface, or **MIGRATE** toward a precisely bounded alternative;
- the evaluation itself changes no runtime behavior, public tool schema, OAuth scope or compatibility contract;
- if the decision is MIGRATE, no implementation becomes eligible until a separate reviewed roadmap slice defines the exact migration/deprecation contract and tests; if the decision is KEEP, no speculative compaction work remains.

Committed next P4 slices:

1. **P4-E1 — bounded compact-surface evaluation** — document the exact current 23-operation surface, evaluate concrete grouping alternatives, and record a KEEP/MIGRATE decision with rationale. Documentation/evaluation only; no public tool or runtime change.

No P4 implementation slice is committed by this setup decision.

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

**Status: ACTIVE — final eligibility is an external OpenAI review decision; no separate pre-review blocker**  
**Priority: highest only for public OpenAI directory publication**

Issue #58 records the 2026-09-20 clarification attempt using a real MCP-only draft. Durable non-secret evidence now includes:

- creation of a real MCP-only submission draft;
- successful verification of `grist-chatgpt.loeildumaitre.fr`;
- successful portal Tool Scan for that draft;
- OpenAI AI-assisted support declining to pre-confirm public eligibility outside actual review;
- support describing the bounded architecture as materially different from a generic relay/proxy while noting that final reviewers may still apply the guideline's primary-function test.

This evidence is **not approval**. It establishes instead that no available pre-review mechanism can durably mark S0 PASS. Actual OpenAI app/plugin review is the decision point.

Operational consequences:

- S0 no longer blocks C7 reviewer-environment preparation or C8 package preparation as a circular prerequisite;
- public approval must still never be described as guaranteed;
- preserve the independent/non-official positioning;
- describe the submission as a specific bounded workflow/product with explicit authorization and safety constraints rather than a generic relay/connector;
- keep any Grist Labs / DINUM permission or branding evidence separate and factual; do not invent affiliation;
- if actual review rejects the primary-function classification or requires materially different rights/product behavior, that outcome becomes new external evidence for an explicit human/product roadmap decision.

S0 is resolved only by the actual OpenAI review outcome or a later explicit product decision based on that outcome. There is no further autonomous pre-approval task under S0.

### S1 — low-risk OpenAI submission protocol preparation

**Status: ELIGIBLE (partially completed)**

Completed:

- annotation semantics and per-tool justifications;
- submission artifact generation;
- draft `chatgpt-app-submission.json` with 23 tools, five positive and three negative routing scenarios;
- canonical reviewer-test specification for exactly five positive and three negative submission cases, with explicit prompts, expected behavior/result structure and synthetic fixture requirements; repository tests lock the tracked artifact's 5+3 shape while live fixture execution remains a C7 concern;
- real ChatGPT CIMD/OIDC connection proving `openid` / `email` compatibility after enabling the corresponding Dynamic app permissions;
- document discovery now explicitly projects only the public org/workspace/document identifiers, names and access metadata needed by the bridge contract instead of forwarding arbitrary upstream extension fields;
- table/column discovery now projects only stable functional schema metadata while keeping Grist engine references and arbitrary upstream extension fields server-side for internal bridge use;
- fixed internal `RenameColumn` / `RemoveTable` operations now discard raw Grist `/apply` engine responses and return only bounded semantic acknowledgements with stable target identifiers;
- success-only record/schema update and delete operations discard upstream success bodies and return bounded acknowledgements containing only the exact requested stable targets; create operations project successful upstream results to functional table/column/record IDs and mark successful but unexpectedly shaped responses with `resultNormalizationIncomplete: true` instead of forwarding arbitrary engine fields;
- safe optional `/.well-known/openai-apps-challenge` deployment path: absent by default, exact plain-text token response only when `OPENAI_APPS_CHALLENGE_TOKEN` is explicitly supplied, with ambiguous whitespace/newline values rejected;
- bounded current-surface public-output minimization audit recorded in `docs/PUBLIC-OUTPUT-MINIMIZATION-AUDIT.md`; its only concrete finding, `S1-OUT-1`, explicitly dispositions raw UI v1 compatibility fields to the future P4 migration contract rather than silently breaking the public contract;
- real MCP-only submission draft created, with successful domain verification and portal Tool Scan recorded in issue #58.

Exit criteria:

- the final reviewer-compatible identity path has durable evidence that UserInfo returns `email` with `email_verified: true`;
- one bounded audit of the current public operation outputs against the repository's data-minimization contract is completed, with concrete unnecessary-field findings fixed or explicitly dispositioned;
- the tracked submission preparation artifacts remain coherent with the current public contract.

Committed remaining S1 work:

1. prove and record UserInfo `email` with `email_verified: true` on the final reviewer-compatible path.

Domain verification and Tool Scan have already succeeded for the current real draft as recorded in issue #58. Repeat or refresh those portal checks only if the final endpoint/contract or portal requires it; do not treat them as recurring S1 work.

### C7 — reviewer environment

**Status: BLOCKED by C5; final auth path also depends on production C4**

C7 no longer waits for a separate S0 pre-approval. Once C4/C5 permit a production-safe reviewer path, provision synthetic data and ready-to-use reviewer credentials without MFA/SMS/email-confirmation/private-network dependencies, while not weakening normal production authentication.

C7 must also execute the canonical reviewer cases against the isolated fixture and record the final reviewer-compatible UserInfo evidence required by S1.

### C8 — publisher/submission package

**Status: BLOCKED by C6 and C7**

C8 no longer waits for a separate S0 pre-approval. The actual submission/review is how the remaining S0 eligibility question is resolved.

Final package includes the current production MCP URL, current Tool Scan/domain state, publisher/legal metadata, annotations and justifications, reviewer credentials/instructions, demo recording and the exact current review-test package. Issue #58 already records successful Tool Scan and domain verification for the current draft; refresh them only as needed for the exact final endpoint/contract.

Initial submission remains MCP-only. Custom UI and skills are not required.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

Preferred steady state after P1 completion:

```text
Worker A: P4-E1 bounded compact-surface evaluation
Worker B: platform/security operational evidence (C4) when the intended environment/operator is available
Controller: integration, review/dependency control, S1/C7/C8 coordination and human gates
```

Do not deploy a product-feature branch onto the shared POC/production endpoint merely to test code if that would destroy an active authentication/security experiment. Use isolated test evidence when needed.

## Controller integration order

When multiple actions are eligible, prefer:

1. close a ready existing dependency or prior-execution review-required PR;
2. progress P4-E1's bounded evaluation-only slice without changing the public v1 contract;
3. progress independent C4 operational evidence when the required intended environment/operator support is available;
4. progress low-risk S1 evidence when the required external identity evidence is available;
5. after C4/C5 permit it, progress C7 reviewer-environment evidence without waiting for a separate S0 pre-approval;
6. after C6/C7, finalize C8 and use actual OpenAI review as the S0 decision point;
7. stop at human gates rather than embedding unapproved persistence, scope, destructive-surface, institutional or branding decisions.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current external requirements.
