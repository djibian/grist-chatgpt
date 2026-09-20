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

## Completion

Q0 is complete only when the roadmap exit criteria are satisfied and a fresh integrated tranche review records `PASS` against an exact `main` SHA after all committed Q0 repairs are integrated.

That PASS establishes the post-Q0 `main` runtime as the project's new retrospective trust baseline. It does not imply that the code is perfect or that deferred cosmetic debt must be eliminated.