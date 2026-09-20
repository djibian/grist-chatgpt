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
```

The repository already contains the bounded Grist business surface, registry-driven MCP contract, credential-provider seam, per-principal Grist context/cache isolation, compact semantic document inspection, audit-aware risk metadata and a first bounded document-UI tranche. Since that baseline, `main` also contains bounded direct and Ref/RefList column select-by option discovery/configuration, bounded widget saved-sort configuration through stable column IDs, bounded normalized page-layout inspection through stable widget IDs, bounded normalized existing-custom-widget access/mapping inspection and mutation through stable column IDs, bounded table/grid display-option inspection and mutation while preserving unrelated widget options, bounded advisory formula-reference and one-hop reference-field inspection, a non-secret OAuth deployment smoke command/runbook, explicit minimization of public discovery metadata and success-only mutation results while preserving functional creation IDs, a documented production observability/audit contract, bounded widget-description mutation with post-write verification, and bounded native chart-type configuration for explicitly identified chart widgets.

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

Goal: provide the useful bounded subset of Grist document-design semantics needed for realistic page/widget work without exposing arbitrary UserActions.

Current baseline:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
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

- the current bounded UI baseline plus the committed slices below are integrated with stable-ID inputs, bounded semantics and exact post-write verification for mutations;
- document-UI contracts, tests and current-state documentation are coherent;
- no arbitrary UserAction, generic `/apply`, arbitrary custom-option payload or newly destructive UI surface is exposed;
- no other non-destructive UI slice is required to satisfy the stated P1 goal.

Committed next P1 slices:

1. **bounded layout mutation** — add only layout changes that can be expressed with stable current widget IDs, validated against the current page, bounded in size/depth and exactly verified by re-read.

Deferred P1 candidates — not autonomously eligible unless explicitly promoted:

- additional safe widget configuration beyond the committed slices;
- further select-by variants beyond the currently supported direct and Ref/RefList semantics;
- widget-owned custom options, which first require a separate bounded JSON size/depth/value contract;
- page deletion;
- widget deletion;
- any operation that can remove/overwrite broader document UI state.

The destructive candidates remain human-gated. Bounded adapters may internally emit known Grist UserActions, but no arbitrary `/apply` or UserAction payload may be exposed to the model.

### P2 — formula and schema safety

**Status: ACTIVE — tranche review repair pending**  
**Priority: high**

Goal: provide a bounded non-executing `FormulaInspector`-style layer that detects likely schema/formula mistakes before mutation while leaving Grist authoritative for actual formula evaluation.

Integrated advisory slices:

- `inspect_document` detects referenced `$Column` identifiers without executing formulas;
- references in quoted strings/comments are ignored and analysis is bounded/deduplicated;
- exact matches, unique case mismatches and missing columns are distinguished;
- up to three deterministic close existing-column suggestions are surfaced without rewriting user intent;
- matching/suggested Ref/RefList columns expose their target table;
- when expanded document schema is already available, exact one-hop `$Ref.Field` and `$RefList.Field` lookups are checked against the referenced table with the same exact/case-mismatch/missing semantics and suggestions;
- one-hop dereference inspection is independently capped at 100, ignores method-like/deeper-chain Python expressions and implicit `id`, performs no extra upstream read, and never invents a warning when target-table metadata is unavailable;
- document context summarizes local formula references, checked dereferences, dereference warnings and aggregate formula warnings.

Exit criteria:

- local and one-hop reference diagnostics remain bounded, advisory and non-executing;
- unavailable metadata yields explicit incompleteness rather than invented conclusions;
- no Python interpreter, raw SQL or generic code-execution surface is introduced;
- tests/documentation cover the integrated advisory behavior and no committed P2 slice remains.

Integrated tranche review against exact `main` `9aa5cc42edcf1306c2d14b742a1deefa40dfdf43`: **CHANGES REQUIRED**. A one-hop `$Ref.Field` whose Ref target table metadata is unavailable is currently omitted from `dereferences` without an explicit incompleteness marker, so the second exit criterion is not yet satisfied.

Committed next P2 slices:

1. **explicit unavailable-target dereference incompleteness** — when a one-hop source resolves to `Ref`/`RefList` but its target-table metadata is unavailable, expose bounded explicit incompleteness without inventing a missing-field warning or performing another upstream read.

Further formula/schema ideas are deferred until an explicit roadmap decision demonstrates additional value and promotes a bounded slice. No additional P2 feature work is committed beyond the repair above.

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

**Status: BLOCKED until P1, P2 and P3 each pass integrated tranche review and are marked DONE**  
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
- canonical reviewer-test specification for exactly five positive and three negative submission cases, with explicit prompts, expected behavior/result structure and synthetic fixture requirements; repository tests lock the tracked artifact's 5+3 shape while live fixture execution remains a C7 concern;
- real ChatGPT CIMD/OIDC connection proving `openid` / `email` compatibility after enabling the corresponding Dynamic app permissions;
- document discovery now explicitly projects only the public org/workspace/document identifiers, names and access metadata needed by the bridge contract instead of forwarding arbitrary upstream extension fields;
- table/column discovery now projects only stable functional schema metadata while keeping Grist engine references and arbitrary upstream extension fields server-side for internal bridge use;
- fixed internal `RenameColumn` / `RemoveTable` operations now discard raw Grist `/apply` engine responses and return only bounded semantic acknowledgements with stable target identifiers;
- success-only record/schema update and delete operations discard upstream success bodies and return bounded acknowledgements containing only the exact requested stable targets; create operations project successful upstream results to functional table/column/record IDs and mark successful but unexpectedly shaped responses with `resultNormalizationIncomplete: true` instead of forwarding arbitrary engine fields;
- safe optional `/.well-known/openai-apps-challenge` deployment path: absent by default, exact plain-text token response only when `OPENAI_APPS_CHALLENGE_TOKEN` is explicitly supplied, with ambiguous whitespace/newline values rejected;
- bounded current-surface public-output minimization audit recorded in `docs/PUBLIC-OUTPUT-MINIMIZATION-AUDIT.md`; its only concrete finding, `S1-OUT-1`, explicitly dispositions raw UI v1 compatibility fields to the future P4 migration contract rather than silently breaking the public contract.

Exit criteria:

- the final reviewer-compatible identity path has durable evidence that UserInfo returns `email` with `email_verified: true`;
- one bounded audit of the current public operation outputs against the repository's data-minimization contract is completed, with concrete unnecessary-field findings fixed or explicitly dispositioned;
- the tracked submission preparation artifacts remain coherent with the current public contract.

Committed remaining S1 work:

1. prove and record UserInfo `email` with `email_verified: true` on the final reviewer-compatible path.

The production OpenAI domain token does not yet exist. Activating the already-prepared challenge endpoint with that future exact token is an external-triggered C8/submission action, not recurring S1 work.

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
Worker B: product capability (P1 first; P2/P3 tranche reviews when eligible)
Controller: integration, dependency control, human gates, S0/S1 coordination
```

Do not deploy a product-feature branch onto the shared POC/production endpoint merely to test code if that would destroy an active authentication/security experiment. Use isolated test evidence when needed.

## Controller integration order

When multiple PRs are open, prefer:

1. close a ready existing dependency;
2. integrate small platform/security slices that keep the proven OAuth contract stable;
3. integrate independent bounded product slices or required tranche reviews;
4. progress low-risk S1 preparation while S0 remains unresolved;
5. stop at human gates rather than embedding unapproved persistence, scope, destructive-surface, institutional or branding decisions.

After every durable transition, resolve the new exact `main` SHA and re-evaluate this roadmap against current code and current external requirements.