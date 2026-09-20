# Retrospective code assurance — Q0

This document is the evidence protocol for roadmap tranche **Q0 — retrospective code assurance**. `docs/ROADMAP.md` remains authoritative for Q0 status, eligibility, committed repair slices and completion.

## Purpose

Q0 exists because part of the current runtime was created before the repository's present independent-review discipline was fully established. Code age or lack of historical review is not itself a defect. Q0 uses those facts only as prioritization signals for a one-time retrospective assurance pass under the standards that now govern new work.

The objective is to establish a trustworthy integrated baseline without turning cleanup into an open-ended rewrite.

## Baseline

Initial runtime baseline for the read-only inventory:

```text
main: 2f811ee34cbeb32c9c945aeb217de34fba5065f2
```

This baseline includes the independently reviewed P2 dereference-incompleteness repair from PR #106 and the bounded grid-display work from PR #102. Documentation-only Q0 setup commits do not change the runtime baseline.

No new product-surface expansion should be mixed into this inventory. Q0 repairs, once explicitly promoted by the roadmap, become part of the baseline that the final integrated Q0 review evaluates.

## Audit method

The first Q0 slice is read-only with respect to runtime behavior. It reviews the complete current runtime and its tests against current repository invariants before proposing refactors.

Review fixed domains in this order:

1. **Identity and isolation** — configuration, server boundary, OAuth/authentication, `Principal`, authorization, credential-provider seams, per-principal clients/discovery/caches and secret handling.
2. **Grist effects** — Grist transport/client behavior, records/schema mutations, stable identifiers, bounds, destructive targeting, partial/non-atomic writes, ambiguity, retry/replay and post-write verification.
3. **Public contracts** — operation registry, MCP server, GPT Actions/OpenAPI compatibility adapters, schemas, risk annotations, typed errors and public-output minimization.
4. **Semantic document behavior** — document context, formula/schema advisory logic, relations, page/widget normalization and mutations, select-by/sort/layout/custom-widget semantics and fail-closed incompleteness handling.
5. **Cross-cutting assurance** — tests, module/dependency boundaries, duplicated invariants/limits, error propagation, audit/observability boundaries and configuration/deployment assumptions that can affect correctness or security.

Git history may be used to identify code that predates independent review, has high churn or sits on critical boundaries, but findings must be based on current code and current behavior.

## Finding classes

Every concrete finding must be placed in exactly one class:

- **BLOCKING** — correctness, authorization/security, privacy, data-integrity, contract or replay/ambiguity defect that prevents trusting the current baseline. It must become a bounded committed repair slice.
- **REQUIRED** — a material missing test or architectural/maintainability defect that materially weakens assurance of a critical behavior. It becomes a bounded committed repair slice.
- **DEFERRED** — style, cosmetic cleanup, speculative abstraction, broad rewrite, tooling idea or low-value maintainability improvement that is not necessary to satisfy Q0 exit criteria. It is not eligible Q0 work unless explicitly promoted later.

Do not create a numerical quality score. Do not promote a finding merely because code is old, large or stylistically inconsistent.

## Repair rules

- Characterize uncertain existing behavior with tests before refactoring it.
- Prefer the smallest repair that restores an invariant over broad redesign.
- Each substantive runtime repair follows the normal exact-head CI and independent-review gate.
- Do not bundle unrelated findings into a generic cleanup PR.
- Do not add lint, coverage, complexity or mutation-testing gates merely because they are available. The audit may recommend a bounded tooling change only when evidence shows it protects a concrete invariant or recurring failure mode.
- Cosmetic debt remaining after material findings are resolved is explicitly deferred rather than used to keep Q0 open.

## Evidence produced by the inventory

The inventory should extend this document with:

- exact audited `main` SHA;
- per-domain files/components reviewed;
- concrete findings with evidence and classification;
- existing tests that establish confidence;
- missing characterization/negative/failure tests where material;
- the finite repair list promoted into `docs/ROADMAP.md`.

The inventory itself does not modify runtime code.

## Read-only inventory result — 2026-09-20

The complete fixed-domain inventory was performed against the exact runtime baseline:

```text
2f811ee34cbeb32c9c945aeb217de34fba5065f2
```

Current `main` at inventory completion was `b8cf5cf9066dabcb9a6c7bc22f16a6f21b33ee75`; the commits between the runtime baseline and that `main` are documentation-only Q0 setup changes, so the audited runtime is unchanged.

The inventory found **three concrete BLOCKING findings, no separate REQUIRED finding, and no reason for a broad cleanup rewrite**. Existing focused tests already cover most critical identity, authorization, batching/replay, normalization and output-minimization boundaries. The missing tests map directly to the three findings below and are part of their bounded repair slices.

External Grist semantics were checked against the current public REST API documentation and the public `grist-core` metadata schema. In particular, Grist's record/column APIs address tables by `tableId`, while `_grist_*` tables are engine-managed document metadata. Q0 therefore treats the model-facing bridge, not a possible upstream rejection, as responsible for enforcing the public/internal table boundary.

### Domain 1 — identity and isolation

Reviewed components include `src/config.ts`, `src/server.ts`, `src/auth/*`, `src/grist/accessPolicy.ts`, `src/grist/contextFactory.ts`, `src/grist/credentials.ts` and the authorization path in `src/grist/authorizedService.ts`.

Observed invariants:

- OAuth tokens are signature-verified before principal construction, with issuer, audience/resource, expiry and recognized-scope checks;
- principal IDs are derived from verified issuer/subject claims rather than model inputs;
- authorization combines principal capabilities, deployment resource policy and live Grist discovery;
- request contexts create principal-bound Grist clients/discovery/authorization/service graphs rather than sharing credential-bearing clients across principals;
- the structured audit event contains bounded identifiers/operation metadata and no raw bearer/API key;
- static bearer comparison uses constant-time equality after a length check.

Existing focused tests include configuration, static bearer, access policy, authorization service, OAuth access-token/principal/request-context/JWKS/security/protected-resource behavior, Grist credential providers and Grist context-factory isolation.

Result: **no new Q0 finding**. The current static Grist API-key provider remains the already-documented C5 production limitation and human-gated credential-lifecycle work; Q0 does not misclassify that known future architecture decision as a newly discovered runtime defect.

### Domain 2 — Grist effects

Reviewed components include `src/grist/client.ts`, `src/grist/service.ts`, `src/grist/authorizedService.ts`, `src/grist/uiActionsAdapter.ts` and record/schema mutation tests.

Observed invariants:

- upstream document URLs are normalized to the configured Grist origin;
- upstream requests are bounded by timeout and configured item limits;
- large record/schema operations expose partial completion through `PartialBatchError` and explicitly forbid blind whole-operation replay;
- success-only mutation results discard arbitrary upstream response bodies, while creation results retain only functional created IDs and explicit normalization incompleteness;
- internal UI `/apply` usage emits only fixed bridge-owned UserActions; no generic model-facing `/apply` or arbitrary UserAction payload is exposed;
- destructive record/table/column operations require explicit stable targets.

#### Q0-F1 — model-facing internal metadata table boundary is incomplete

**Class: BLOCKING**

`query_records` explicitly rejects table IDs beginning `_grist_`, but the same invariant is not enforced consistently for the other model-facing table-targeted operations. In particular, record creation/update/deletion, column inspection/mutation and table/schema mutation paths accept string table IDs without a common rejection of engine metadata tables. Table creation/rename targets can likewise attempt reserved `_grist_*` identifiers.

Because Grist's public REST APIs address tables by `tableId` and `_grist_*` names are engine-managed metadata, relying on a possible upstream rejection is not an acceptable bridge security/data-integrity boundary. Trusted bridge-internal semantic UI reads/writes may continue to use the required metadata tables; only model-facing public table identifiers must be rejected.

Required repair evidence:

- one shared fail-closed public table-ID invariant applied to every relevant model-facing record/schema/table target and rename/create target;
- trusted internal semantic metadata access remains functional;
- negative tests prove `_grist_*` model-facing targets never reach the upstream mutation/read primitive;
- positive tests preserve ordinary user-table behavior across the shared authorized layer and compatibility surfaces.

### Domain 3 — public contracts

Reviewed components include `src/operations/registry.ts`, `src/mcp/*`, `src/actions/api.ts`, `src/actions/schemaApi.ts`, `src/mcp/results.ts`, `src/grist/publicMetadata.ts` and contract/minimization/annotation tests.

Observed invariants:

- operation capabilities and MCP risk annotations derive from the normative registry;
- record limits and schema item-count limits are represented in MCP and GPT Actions compatibility schemas;
- typed partial-write and write-verification errors preserve non-retryable ambiguity information;
- discovery/schema outputs are deliberately projected to stable functional metadata rather than forwarding arbitrary upstream fields.

#### Q0-F2 — schema mutation inputs are open-ended despite the bounded public contract

**Class: BLOCKING**

The model-facing schema tools describe stable bounded schema operations, but `mcp/schemaTools.ts` and `actions/schemaApi.ts` currently define metadata fields as an arbitrary `Record<string, unknown>` / OpenAPI `additionalProperties: true`. The public descriptions even permit unspecified "other fields accepted by Grist". This allows model-visible schema mutations to reach arbitrary upstream table/column metadata keys, including unstable numeric-engine-reference style fields such as `visibleCol`, despite the product invariant that public mutations use stable bounded contracts.

Required repair evidence:

- table-update fields are replaced by an explicit finite supported set (currently the documented semantic needs are table rename and `onDemand`);
- column create/update fields are replaced by an explicit finite supported set of stable semantic metadata needed by the existing v1 contract;
- numeric Grist engine references and unknown metadata keys are not accepted as public inputs;
- MCP and GPT Actions/OpenAPI schemas share materially identical allowlists and reject unknown keys;
- tests cover accepted supported metadata plus negative unknown/unstable fields.

### Domain 4 — semantic document behavior

Reviewed components include `src/grist/documentContext.ts`, `src/grist/formulaInspector.ts`, `src/grist/documentUi.ts`, `src/grist/pageLayout.ts`, `src/grist/selectBy.ts`, saved-sort/custom-widget/grid-option normalizers and UI mutation adapters/tests.

Observed invariants:

- formula/reference inspection is bounded, advisory and non-executing;
- unavailable dereference target metadata produces explicit incompleteness rather than an invented warning;
- reverse relation normalization requires exact bidirectional evidence;
- page-layout normalization is bounded in node count/depth/widget IDs and marks malformed/stale state incomplete;
- custom-widget, saved-sort and select-by normalized inputs use stable current column/widget IDs and reject unresolved unsupported state;
- select-by discovery is candidate/response bounded and existing graph cycles are rejected when the graph is completely represented.

#### Q0-F3 — bounded UI metadata reads can be silently incomplete before safety-sensitive mutation

**Class: BLOCKING**

`AuthorizedGristService.loadDocumentUi()` reads `_grist_Pages`, `_grist_Views` and `_grist_Views_section` with a finite `metadataLimit` derived from `GRIST_MAX_READ_RECORDS` (or 5,000 when bridge-side reads are otherwise unbounded). The returned snapshot carries no explicit indication that one of those reads reached the bound. `DocumentUiService` consequently treats the supplied set as the available document graph.

This is not only a display-accuracy concern. Select-by cycle validation follows existing widget links through the loaded snapshot; if an intermediate section is absent because the metadata read was capped, traversal can stop at the missing node and safety-sensitive mutation can reason from a partial graph. Exact post-write verification can likewise be presented as if the document snapshot were complete.

Required repair evidence:

- reaching the metadata-read bound produces explicit snapshot incompleteness rather than silent completeness;
- read-only semantic output may expose the incompleteness conservatively;
- UI mutations whose validation/verification requires a complete page/widget snapshot fail closed while that snapshot is potentially truncated;
- focused tests cover the bound-hit marker and mutation rejection, including a topology/cycle-sensitive case.

### Domain 5 — cross-cutting assurance

Reviewed cross-cutting boundaries include `.github/workflows/ci.yml`, structured audit/error paths, existing runtime test distribution, public-output projection, dependency boundaries and duplicated contract definitions.

Observed assurance:

- pull requests run install, high-severity production dependency audit, TypeScript check, tests and build;
- critical boundaries have focused suites rather than relying only on end-to-end happy paths;
- output minimization and partial/ambiguous write semantics have dedicated regression tests;
- OAuth and authorization paths include negative/failure tests;
- normalized UI/formula/relation paths include malformed/unresolved-state tests.

No additional independent REQUIRED item was found beyond the missing regression tests already attached to Q0-F1 through Q0-F3.

The following are explicitly **DEFERRED**, not Q0 blockers:

- generic lint/coverage/complexity/mutation-testing gates without a demonstrated missing invariant;
- splitting large modules solely for size/style reasons;
- speculative abstraction of every duplicated Zod/OpenAPI fragment beyond what Q0-F2 needs to make the schema mutation allowlist coherent;
- broad rewrites of already bounded semantic normalizers whose current behavior has focused characterization.

## Finite Q0 repair list promoted to the roadmap

The inventory promotes exactly these runtime repairs, in order that minimizes overlapping edits:

1. **Q0-F1 — internal metadata table boundary**: centralize and test the `_grist_*` rejection for model-facing record/schema/table identifiers while preserving trusted bridge-internal metadata access.
2. **Q0-F2 — bounded schema mutation fields**: replace arbitrary table/column metadata mutation dictionaries with a finite shared semantic allowlist across MCP and GPT Actions/OpenAPI, with negative contract tests.
3. **Q0-F3 — fail-closed UI metadata completeness**: make bounded UI-metadata snapshot incompleteness explicit and reject safety-sensitive UI mutation/verification when the snapshot may be truncated.

After those three repairs are independently reviewed and integrated, Q0 must trigger its already-required fresh integrated exact-`main` tranche review. No fourth cleanup slice should be invented unless one of the repairs or that final review produces new concrete BLOCKING/REQUIRED evidence.

## Completion

Q0 is complete only when the roadmap exit criteria are satisfied and a fresh integrated tranche review records `PASS` against an exact `main` SHA after all committed Q0 repairs are integrated.

That PASS establishes the post-Q0 `main` runtime as the project's new retrospective trust baseline. It does not imply that the code is perfect or that deferred cosmetic debt must be eliminated.