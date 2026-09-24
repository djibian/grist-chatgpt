# Roadmap

This roadmap is the authoritative dependency map for autonomous development. It separates product/platform work from public-directory distribution so useful engineering can continue while final publication eligibility remains review-dependent.

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
P4 compact MCP surface            DONE
Q0 retrospective code assurance  DONE
J0 engine stabilization           DONE
J1 contractual execution          DONE
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam, per-principal Grist context/cache isolation, compact semantic document inspection, audit-aware risk metadata and a bounded document-UI surface. `main` contains bounded direct and Ref/RefList column select-by option discovery/configuration, bounded widget saved-sort configuration through stable column IDs, bounded normalized page-layout inspection and mutation through stable widget IDs, bounded normalized existing-custom-widget access/mapping inspection and mutation through stable column IDs, bounded table/grid display-option inspection and mutation while preserving unrelated widget options, bounded advisory formula-reference and one-hop reference-field inspection with explicit unavailable-target incompleteness, a non-secret OAuth deployment smoke command/runbook, explicit minimization of public discovery metadata and success-only mutation results while preserving functional creation IDs, a documented production observability/audit contract, bounded widget-description mutation with post-write verification, bounded native chart-type configuration for explicitly identified chart widgets, and the completed Q0 repairs that enforce the internal metadata-table boundary, close schema-mutation metadata allowlists and fail closed on potentially truncated UI metadata snapshots.

The frozen Product Vision now defines `grist-chatgpt` as an agentic Grist application builder and lifecycle maintainer above the existing bounded execution substrate. The Builder / Execution Engine / Connector separation, contractual execution semantics and stage-tracking BehavioralContract are specified in `docs/PRODUCT_VISION.md`, `docs/EXECUTION-ENGINE-J0-J1.md` and `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md`.

The C4 architecture decision is fixed: ProConnect is the upstream institutional identity source, Logto OSS is the reference MCP-facing authorization server, and `grist-chatgpt` remains a provider-neutral standards-based OAuth resource server. Auth0 EU and Curity Standard remain documented fallbacks.

The project advances on three product/platform/distribution axes. Q0 remains recorded below as the completed retrospective trust-baseline tranche:

```text
QUALITY ASSURANCE         PLATFORM / SECURITY      PRODUCT / BUILDER            PUBLIC DISTRIBUTION
Q0 DONE                   C4 -> C5 -> C6           P1 / P2 / P3 / P4 DONE       S0 ACTIVE + S1
                                                   -> J0 DONE -> J1 DONE -> J2      -> C7 -> C8 -> review
                                                                    -> J3 -> J4 -> J5 -> J6
```

Q0 established the post-audit runtime trust baseline. The frozen Agentic Builder vision is integrated, J0 and J1 have both passed exact-main integrated completion reviews, and J1's finite contractual-execution proof is exhausted. J2 is now the next product dependency. Its Stage follow-up business semantics are accepted, and a partial reference schema/page binding is recorded; critical LinkKey ACL and teacher-specific UI behavior remain unverified, although the owner reports adding the date to the follow-up sheet and confirms that teacher links in `Enseignants` use LinkKeys with ACL-based filtering. J2 implementation is blocked on those observations and a controlled fixture, not on a choice to create a separate Visit entity. The Builder may not invent missing bindings. J3-J6 remain dependency-gated exactly as defined below; old deferred P5/P6 ideas do not become eligible merely because the Builder program exists.

OpenAI does not provide a pre-review eligibility determination for this case. Public-directory approval therefore remains review-dependent, but that review-time classification no longer blocks bounded reviewer/submission preparation. It does not block private ChatGPT Developer Mode use, Codex use, product-capability development or production-quality platform engineering that is independently useful.

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
- P4's former P1/Q0/P2/P3 dependency chain was satisfied; P4-E1 has now passed its integrated completion review and P4 is DONE with KEEP as the v1 decision;
- J0 and J1 have passed their required integrated reviews and are DONE; J2 is blocked on the remaining stage-tracking access/UI binding gate;
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

## Axis B — product capabilities and Agentic Builder

P0-P4 remain the historical bounded-bridge product baseline. The new product program is the distinct J0-J6 Agentic Builder sequence. The existing narrow v1 MCP operations remain a compatibility/execution substrate; J0-J6 do not imply a generic super-tool or arbitrary `/apply` surface.

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
- existing `type === "custom"` widgets expose additive bounded `customWidgetSettings` with normalized access, optional stable gallery/bundled `widgetId`, and single/list/null column mappings translated from Grist numeric refs to current stable column IDs; URLs, plugin identifiers and arbitrary widget-owned options are deliberately excluded from that normalized view;
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

Integrated tranche review: **PASS** against exact `main` `9aa5cc42edcf1306c2d14b742a1deefa40dfdf43`. The integrated UI/relation normalizers fail closed with explicit incompleteness markers, progressive help derives operation metadata from the normative registry, `inspect_document` does not load user-table rows, and credential-derived contexts/caches remain principal-isolated. No committed P3 slice remains.

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

**Status: DONE**  
**Priority: completed product-capability evaluation**

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

Integrated tranche review: **PASS** against exact `main` `2e2a9a6457a709fce630d7c1e21a0e12eb5a58d8`. PR #119 integrated the P4-E1 evaluation from exact head `aaef06427d6464af5d85933d6a06fdb52830ee04` after exact-head CI success and an independent exact-head PASS. The integrated change is documentation-only: `src/operations/registry.ts` on the reviewed `main` still exposes exactly the 23 operations inventoried by P4-E1, with the same category/capability/risk split and operation-specific partial/ambiguous-write semantics. The recorded KEEP decision preserves the stable v1 tool schemas, OAuth scopes, authorization boundaries and runtime behavior; no implementation or migration slice follows from P4-E1, and no committed P4 work remains.

Completed P4 slice:

1. **P4-E1 — bounded compact-surface evaluation** — exact 23-operation inventory and concrete grouping alternatives evaluated; decision **KEEP** the current narrow v1 execution surface. Documentation/evaluation only; no public tool or runtime change.

Committed next P4 slices: **none**.

Any future compaction or v2 surface requires a new explicit roadmap decision; it is not continuation of P4-E1.

## Agentic Builder sequence

The sequence below is the authoritative continuation of the product axis after P4. `docs/AGENTIC-BUILDER-ROADMAP-DELTA.md` records the proposal that led to this integration; this roadmap controls eligibility.

```text
P0-P4 bounded bridge baseline  DONE
             |
             v
J0 engine stabilization       DONE
             |
             v
J1 contractual execution      DONE
             |
             v
J2 stage-tracking reference application  BLOCKED — LinkKey/UI binding and controlled fixture
             |
             v
J3 second independent reference application
             |
             v
J4 native Builder generalization
             |
             v
J5 code + integrations
             |
             v
J6 durable lifecycle maintenance
```

### J0 — engine stabilization

**Status: DONE**  
**Priority: completed product-runtime stabilization**

Goal: make current mutation outcomes safe inputs for a future orchestrator by correcting the four reproduced audit fragilities without implementing the Builder itself.

Authoritative specification: `docs/EXECUTION-ENGINE-J0-J1.md`, J0 sections.

Committed J0 slices were finite:

1. explicit uncertain-write semantics including first-batch ambiguity;
2. preserve confirmed partial results/stable IDs across later failure or uncertainty;
3. safe audit target normalization so rejected secret-bearing URLs are not logged raw;
4. concurrency classification/protection for overwrite-sensitive current mutations, with refusal where an effective protected mode is unavailable;
5. focused regression tests reproducing the four audit findings;
6. integrated J0 completion review.

J0 exit criteria:

- required tests T0-T3 pass;
- uncertain first writes are structurally distinguishable from proven no-effect failure;
- successful earlier batch results survive later failure/uncertainty;
- supported contractual concurrency claims are backed by an effective tested mechanism, otherwise the capability refuses that mode;
- rejected raw resource URLs cannot leak query secrets into audit;
- existing non-replay safety is preserved;
- public/runtime documentation states the exact guarantee boundaries;
- a fresh integrated J0 completion review records PASS against exact `main`.

Integrated tranche review: **PASS** against exact `main` `70d6e918219189b1aed82a209afc3049df9f10ec`. PR #125 integrated explicit uncertain/partial-write effect knowledge and T0/T1 evidence after independent exact-head review; PR #127 integrated fail-closed contractual concurrency classification/refusal and T2 evidence after independent exact-head review; PR #126 integrated fail-closed audit-target handling and T3 evidence after independent exact-head review. Exact `main` is tree-identical to the exact tested #126 head `98dac82cb3a4731183de531e1c52e2701a06d775`, whose CI passed production dependency audit, TypeScript check, the complete test suite and build with the earlier J0 slices already integrated. The integrated review found no new blocking correctness, authorization/security, data-integrity, replay or contract finding; the committed J0 set is exhausted.

Completed J0 slices:

1. **J0-F1/F2 — uncertain and partial writes** — PR #125 preserves confirmed effects/stable IDs, represents first/later ambiguous write outcomes explicitly and forbids whole-operation replay.
2. **J0-F3 — concurrency classification** — PR #127 classifies every current operation and refuses overwrite-sensitive contractual direct execution where no proven effective concurrency protection exists.
3. **J0-F4 — safe audit targets** — PR #126 prevents unresolved/rejected raw document targets from reaching audit output while retaining normalized non-URL IDs for successful events.
4. **integrated J0 completion review** — PASS recorded above against exact post-repair `main` `70d6e918219189b1aed82a209afc3049df9f10ec`.

Committed next J0 slices: **none**.

J0 runtime changes required independent exact-head review. J1 may be developed and tested against an isolated synthetic/controlled environment before C5, but that does not make the system ready for real multi-user production.

### J1 — first contractual transformation

**Status: DONE**  
**Priority: completed product-runtime tranche**

Goal: prove one bounded synthetic multi-step transformation using immutable execution contracts, cumulative plan budgets, a durable write-ahead journal, multidimensional state, contextual evidence and recovery/suspension after injected failures.

Authoritative specification: `docs/EXECUTION-ENGINE-J0-J1.md`, J1 sections.

Integrated J1 foundation:

1. **immutable execution/plan/contract identity** — PR #130, integrated on exact `main` `54f742ccd97bb0c53994d4d4b36414a0616c40d1`;
2. **`ExecutionJournal` abstraction plus one durable controlled-environment implementation** — PR #130, including restart persistence, bounded contractual state vocabulary, same-process CAS protection and explicit one-writer-process filesystem limitation;
3. **write-ahead step lifecycle and restart uncertainty** — PR #133, independently reviewed and integrated on exact `main` `8568a8cbca55d0da7b15dcca5c4e48c65fb57c68`, including immutable bounded effect-intent identity, durable `RUNNING` preparation before any dispatch, retained confirmed effect evidence and pessimistic `UNCERTAIN` + `SUSPENDED` restart semantics without blind replay;
4. **cumulative per-plan budget enforcement** — PR #135, integrated before exact `main` `6d42b731415f25ce1d67a2c61cc7c2931aae97dd`, with durable reservation/consumption accounting and refusal before dispatch when the plan budget would be exceeded;
5. **durable contextual property evidence** — PR #136, integrated before exact `main` `6d42b731415f25ce1d67a2c61cc7c2931aae97dd`, with immutable step/property linkage and append-only evidence revisions;
6. **point-in-time current-authority gate** — PR #137, integrated on exact `main` `aaea89f08d1a58d6d81e9fdd6ef2e9c451e1b359`, with principal/mandate/target/capability re-resolution and no cached positive authorization;
7. **verification requirements and safe completion transition** — PR #138, independently reviewed and integrated before exact `main` `6d42b731415f25ce1d67a2c61cc7c2931aae97dd`, freezing bounded verification criteria before execution and requiring latest `VERIFIED` evidence for every required property;
8. **capability-specific deterministic `update_records` recovery** — PR #139, independently reviewed and integrated before exact `main` `6d42b731415f25ce1d67a2c61cc7c2931aae97dd`, distinguishing frozen before/after states, safe explicit retry and fail-closed suspension on ambiguity;
9. **bounded synthetic `update_records` effect boundary** — PR #140, independently reviewed and integrated on exact `main` `6d42b731415f25ce1d67a2c61cc7c2931aae97dd`, enforcing fresh isolated-state precondition observation, current authority, durable budget/write-ahead preparation and pessimistic response-loss handling before any recovery decision;
10. **integrated deterministic synthetic transformation and crash matrix** — PR #142, independently exact-head reviewed and integrated on `main` `afd5e1ef2a1ea26c939cfa0ae2792210ed3b7205`, exercising the two-step `update_records` contract across every required J1 interruption boundary, exact-before safe retry, exact-after confirmation without replay, ambiguity suspension, retained prior confirmed effects, latest-verdict verification and cumulative-budget refusal.

J1 exit criteria are the complete criteria in `docs/EXECUTION-ENGINE-J0-J1.md`: persistent write-ahead execution, cumulative budgets, authority re-check, multidimensional effect knowledge, retained partial results, uncertainty after crash, capability-specific recovery, suspension on unsafe ambiguity, durable contextual evidence, convergence without duplicate effect where supported, and no new generic Grist escape hatch.

Integrated tranche review: **PASS** against exact `main` `afd5e1ef2a1ea26c939cfa0ae2792210ed3b7205`. That merge tree is content-identical to exact tested PR #142 head `9ed9706d660023e03eb9cef013c2523ff74d2f6d`, whose CI run #480 passed `npm ci`, the production dependency audit, TypeScript/check, the complete test suite and build. The review found no new blocking correctness, authorization/security, replay, data-integrity or contract issue: all five required crash boundaries derive restart behavior from durable journal/evidence state; cumulative budgets cannot be evaded by splitting the plan; every new or explicitly retried effect crosses the fresh current-authority gate; response-loss after an upstream effect becomes durable `UNCERTAIN` and is confirmed without replay only from the capability-specific exact-postcondition plus stable-effect evidence; exact-before recovery merely returns the step to `PENDING` so authority/precondition/budget/write-ahead gates run again; observational ambiguity remains suspended; contextual verification uses the frozen requirement contract and latest linked durable verdict; and the controlled synthetic evidence does not claim Grist multi-writer CAS or introduce a generic dispatcher, `/apply`, UserAction, ACL-authoring or scheduler surface. The committed J1 set is exhausted.

Committed next J1 slices: **none**.

No generalized Builder planner, ACL authoring, browser LinkKey suite or durable scheduler is part of J1.

### J2 — stage-tracking reference application

**Status: BLOCKED by unverified teacher LinkKey/ACL behavior and controlled fixture**

Goal: demonstrate one realistic cross-cutting application transformation covering schema, access policy, UI, human-change preservation, concurrency and recovery.

Authoritative behavioral specification: `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md`. Accepted business decisions: `docs/J2-STAGE-TRACKING-ACCEPTED-SEMANTICS.md`. Partial observed fixture binding: `docs/J2-STAGE-TRACKING-REFERENCE-BINDING.md`.

The teacher assigned in `Stages.Suivi_par` makes an `Appel` or `Visite` and leaves the contact date, implication, punctuality and comments in the single editable trace on that Stage. The owner confirms one trace per Stage is sufficient; J2 does not require a contact history. There is no reassignment in this workflow: `Suivi_par` is the attributed business author, not a technical editor audit. The reference document now has editable `Stages.Date_du_contact`, added through direct maintenance; this is not a J2 engine proof. J2 requires no new Visit table. Before effectful J2 implementation, verify the real LinkKey access rules, date visibility and edit permissions through the teacher-specific URLs, dependency closure and a controlled synthetic fixture. The owner confirms that the date is now visible in the follow-up sheet; this is not yet a controlled teacher/ACL verdict. The Builder cannot turn unobserved ACL/UI facts into accepted policy.

Exit requires all impacted critical properties to be contextually `VERIFIED`, including real supported browser-path LinkKey tests where the policy depends on `user.LinkKey`.

Application-level access-policy work in J2 is limited to the accepted BehavioralContract and ManagedScope. It does not authorize generic user/org/ACL administration or a generic permission-management tool.

### J3 — second independent reference application

**Status: BLOCKED by J2**

Goal: demonstrate that the architecture is not accidentally specialized for stage tracking.

The reference case should be materially different, with a candidate shape such as:

```text
file/data import
-> structural transformation
-> formulas/calculations
-> analysis
-> restitution
```

The exact J3 BehavioralContract requires an explicit roadmap/specification decision after J2 evidence exists; do not invent its detailed scope early.

### J4 — native Builder generalization

**Status: BLOCKED by J3**

Goal: generalize capabilities proven by reference scenarios into explicitly versioned `SUPPORTED` native-Builder capabilities.

Every promoted capability must declare preconditions, effects, permissions, supported Grist versions/environments, verification, concurrency protection, recovery and known limitations.

J4 is not a mandate to expose 100% of the Grist REST API.

### J5 — code and integrations

**Status: BLOCKED by J4 and any capability-specific security/product gates**

Goal: add versioned custom-widget/GitHub/integration workflows under the same execution/evidence model.

This does **not** automatically authorize arbitrary generated code, generic HTTP, arbitrary network destinations or new public scopes. Those remain separately gated where required.

Exit direction includes exact artifact/version identity, declared Grist permissions, declared network destinations, document contract, tests, progressive deployment and compensation/recovery.

### J6 — durable lifecycle maintenance

**Status: BLOCKED by J5**

Goal: add persistent lifecycle operation rather than new basic mutation power.

Candidate committed categories once J6 is explicitly activated:

- durable scheduled/event-triggered jobs;
- dependency/version monitoring;
- evidence invalidation and re-verification;
- drift detection;
- KnownException review;
- widget/integration maintenance;
- bounded upstream Grist issue/PR/release tracking.

J6 must not use conversation memory as job state.

### P5 — attachments

**Status: DEFERRED**

Attachments are useful but not independently eligible. They may be promoted only when a committed Builder scenario requires them and exact read/write semantics, data minimization, size bounds, recovery behavior and any authorization-scope impact are defined. Adding/removing a public scope remains a human gate.

### P6 — webhooks

**Status: DEFERRED / HUMAN GATE BEFORE PUBLIC SCOPE CHANGES**

Webhooks/integrations are considered under J5 when a committed Builder scenario requires them, with effect-oriented authorization and explicit destinations. Do not add a `doc:webhooks`-style public scope or generic webhook-management surface without an explicit product/security decision.

### Later product experiments

Not independently eligible merely because the Builder program exists:

- companion Grist widget for visual confirmation/context selection;
- Apps SDK UI;
- distributed skills;
- generated executable custom widgets outside an activated, capability-gated J5 contract.

Generated executable code remains a materially higher-risk capability and requires the capability-specific security/product decisions required by J5.

## Permanent product/security non-goals

These are architectural boundaries, not deferred feature requests:

- generic HTTP forwarding;
- raw SQL model surface;
- arbitrary Grist `/apply`;
- arbitrary Grist UserActions;
- generic organization/user/ACL administration by the model outside an explicit bounded ApplicationContract and ManagedScope;
- model-visible credentials or secrets;
- deletion by broad filter when explicit stable identifiers can be required;
- blind automatic replay of partial/ambiguous writes;
- arbitrary multi-instance Grist routing in the initial product.

## Axis C — public distribution

### S0 — public-plugin eligibility

**Status: ACTIVE — final classification occurs during OpenAI review**  
**Priority: highest only for public OpenAI directory publication**

Goal: reach an actual OpenAI review with an accurate, defensible bounded-product submission and record the resulting eligibility decision without implying any unofficial affiliation.

Durable pre-review evidence now exists in issue #58:

- a real MCP-only draft submission was created in the OpenAI portal;
- the current MCP hostname was successfully domain-verified;
- Tool Scan completed successfully on the current draft endpoint;
- OpenAI AI-assisted support explicitly declined to pre-confirm eligibility outside review;
- after receiving the exact architecture, support described the fixed single-instance, finite semantic-tool design as materially different from a generic relay/proxy or usual pass-through intermediary, while warning that reviewers may still apply the guideline's primary-function test and view the product as primarily connecting ChatGPT to Grist;
- support stated that explicit Grist/operator permission can reduce policy risk but does not guarantee approval or override the primary-function test.

This is **not an approval**. It establishes that a separate written pre-approval is not an available prerequisite: the actual review is the decision point.

Submission positioning must therefore remain factual and product-oriented:

- describe the concrete workflow/value — inspecting, structuring and maintaining Grist documents through bounded semantic operations — rather than presenting a generic “Grist connector”;
- preserve the fixed single configured Grist instance boundary and the permanent non-goals above;
- maintain the explicit independent/non-official relationship unless durable authorization says otherwise;
- keep any Grist Labs / DINUM / operator permission or branding evidence separate, factual and no broader than what was actually granted.

Exit criteria:

- reviewer/submission prerequisites in C4-C8 are complete enough for a real review;
- the submitted listing and reviewer package accurately describe the bounded workflow, fixed deployment target and independent status;
- the actual OpenAI review returns an approval or a concrete eligibility finding that can be durably recorded and acted on.

Committed remaining S0 work:

1. keep submission copy aligned with the bounded-workflow positioning and issue #58 evidence;
2. obtain/document the minimum factual rights/permission basis needed to operate against the intended Grist deployment and use any submitted branding, without claiming partnership unless granted;
3. when C4-C8 permit review, submit the real draft and record the review outcome as the final S0 decision.

A rejection under the unofficial-connector/primary-function rule returns S0 to BLOCKED pending the smallest explicit authorization, product-boundary or submission-positioning change identified by the review. Do not guess around a rejection.

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
- bounded current-surface public-output minimization audit recorded in `docs/PUBLIC-OUTPUT-MINIMIZATION-AUDIT.md`; its only concrete finding, `S1-OUT-1`, remains accepted v1 compatibility debt after P4-E1 KEEP; any future removal requires a separate explicit versioned migration/deprecation contract and tests;
- real OpenAI submission draft created on 2026-09-20, with the current `grist-chatgpt.loeildumaitre.fr` domain successfully verified and Tool Scan completed successfully; formal `outputSchema` coverage gaps remain separately tracked as contract-quality follow-up.

Exit criteria:

- the final reviewer-compatible identity path has durable evidence that UserInfo returns `email` with `email_verified: true`;
- one bounded audit of the current public operation outputs against the repository's data-minimization contract is completed, with concrete unnecessary-field findings fixed or explicitly dispositioned;
- the tracked submission preparation artifacts remain coherent with the current public contract.

Committed remaining S1 work:

1. prove and record UserInfo `email` with `email_verified: true` on the final reviewer-compatible path.

A real portal challenge token has now been issued and verified against the current draft hostname. The token remains deployment-only secret-like configuration and must never be committed. If the final production MCP hostname changes, repeat portal domain verification against that final hostname rather than assuming the draft verification transfers.

### C7 — reviewer environment

**Status: BLOCKED by C5; final auth path also depends on production C4**

S0 no longer imposes a separate pre-approval dependency because OpenAI support states that final eligibility classification occurs during review. Once C4/C5 permit the reviewer identity path, provision a synthetic reviewer account/document and ready-to-use credentials without MFA/SMS/email-confirmation/private-network dependencies, while not weakening normal production authentication.

### C8 — publisher/submission package

**Status: BLOCKED by C6 and C7; final publication remains contingent on the S0 review outcome**

Final package includes the current production MCP URL, Tool Scan, domain challenge, publisher/legal metadata, annotations and justifications, reviewer credentials/instructions, demo recording and the exact current review-test package.

Initial submission remains MCP-only. Custom UI and skills are not required. The C8 submit-for-review transition is the mechanism that resolves S0's remaining primary-function classification; do not require a circular S0 pre-approval before reaching it.

## Parallelism policy

Normal maximum active development:

```text
1 Controller
+ 2 Workers
(+ 1 exceptional independent Worker)
```

Preferred steady state after J1 completion:

```text
Worker A: J2 only after critical LinkKey/UI binding and a controlled fixture are verified
Worker B: platform/security operational evidence (C4) when the intended environment/operator is available
Controller: integration/review/dependency control plus S0/S1/C7/C8 coordination
```

No autonomous J2 Builder runtime slice is currently eligible while the critical LinkKey/UI binding and controlled fixture remain unresolved. J1 isolated engineering is complete, and no second real user or production Builder deployment may rely on the shared static Grist credential path as if it provided per-user isolation.

Do not deploy a product-feature branch onto the shared POC/production endpoint merely to test code if that would destroy an active authentication/security experiment. Use isolated test evidence when needed.

## Controller integration order

When multiple actions are eligible, prefer:

1. close a ready existing dependency or prior-execution review-required PR;
2. progress J2 only after the critical LinkKey/UI binding is verified in a controlled fixture; do not invent missing access decisions;
3. progress independent C4 operational evidence when the required intended environment/operator support is available;
4. progress S1 and S0 submission evidence, and begin C7 reviewer preparation as soon as C4/C5 dependencies permit rather than waiting for unavailable pre-approval;
5. stop at remaining human gates rather than embedding unapproved persistence, scope, destructive-surface, institutional or branding decisions.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current external requirements.
