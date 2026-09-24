# Agentic Builder roadmap delta

Status: **integrated roadmap rationale; `docs/ROADMAP.md` is authoritative**.

This file records the reviewed product-roadmap proposal that led to the Agentic Builder reconciliation in `docs/ROADMAP.md`. It is retained as design rationale so the transition from the historical P0-P4 program to J0-J6 remains explicit without rewriting historical roadmap evidence.

`docs/ROADMAP.md` remains the authoritative autonomous dependency map under `AGENTS.md`. Eligibility and current tranche status must be read from that file; this delta no longer independently controls implementation selection.

## 1. Preserve existing platform/security program

The Builder roadmap does not replace C4/C5/C6.

```text
C4 production OAuth MCP identity
  -> C5 secure per-user Grist credential lifecycle
  -> C6 production hardening
```

Rules preserved:

- J0/J1 may be developed and tested in an isolated controlled environment before C5;
- no second real production user may rely on the shared static Grist credential path as if it were per-user isolation;
- multi-user production Builder operation depends on the relevant C4/C5/C6 exit criteria;
- the existing human gates for credential persistence/encryption/key custody remain unchanged.

## 2. New product axis after P4

P0-P4 remain historical DONE tranches. The new product program starts a distinct Agentic Builder sequence rather than reopening those tranches.

```text
P0-P4 bounded bridge baseline  DONE
             |
             v
J0 engine stabilization
             |
             v
J1 contractual execution
             |
             v
J2 stage-tracking reference application
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

The public narrow v1 MCP operations remain a compatibility/execution substrate; J0-J6 do not imply a generic super-tool or arbitrary `/apply` surface.

## 3. J0 — engine stabilization

**Integrated roadmap status: ELIGIBLE**  
**Priority: highest product-runtime priority**

Goal: make current mutation outcomes safe inputs for a future orchestrator by correcting the four reproduced audit fragilities without implementing the Builder itself.

Authoritative specification: `docs/EXECUTION-ENGINE-J0-J1.md`, J0 sections.

Committed J0 slices are finite:

1. explicit uncertain-write semantics including first-batch ambiguity;
2. preserve confirmed partial results/stable IDs across later failure or uncertainty;
3. safe audit target normalization so rejected secret-bearing URLs are not logged raw;
4. concurrency classification/protection for overwrite-sensitive current mutations, with refusal where an effective protected mode is unavailable;
5. focused regression tests reproducing the four audit findings;
6. integrated J0 completion review.

Exit criteria are exactly the J0 exit criteria in `docs/EXECUTION-ENGINE-J0-J1.md`.

J0 runtime changes require independent exact-head review.

## 4. J1 — first contractual transformation

**Integrated roadmap status: BLOCKED by J0**  
**Priority: high**

Goal: prove one bounded synthetic multi-step transformation using immutable execution contracts, cumulative plan budgets, a durable write-ahead journal, multidimensional state, contextual evidence and recovery/suspension after injected failures.

Authoritative specification: `docs/EXECUTION-ENGINE-J0-J1.md`, J1 sections.

Finite committed J1 work after J0 completion:

1. immutable execution/plan/contract identity;
2. `ExecutionJournal` abstraction plus one durable controlled-environment implementation;
3. write-ahead step lifecycle and restart semantics;
4. cumulative per-plan budget enforcement;
5. authorization re-check before resumed/new effects;
6. contextualized property evidence;
7. one deterministic synthetic transformation with crash/fault injection at the specified boundaries;
8. integrated J1 completion review.

No generalized Builder planner, ACL authoring, browser LinkKey suite or durable scheduler is part of J1.

## 5. J2 — stage-tracking reference application

**Integrated roadmap status: BLOCKED by J1 and unresolved J2 business/application bindings**

Goal: demonstrate one realistic cross-cutting application transformation covering schema, access policy, UI, human-change preservation, concurrency and recovery.

Authoritative behavioral specification: `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md`.

Before J2 implementation, the explicitly listed `PROPOSED`/`UNKNOWN` business semantics and exact logical-to-Grist bindings that affect critical properties must be accepted/resolved. The Builder may not resolve them unilaterally.

Exit requires all impacted critical properties to be contextually `VERIFIED`, including real supported browser-path LinkKey tests where the policy depends on `user.LinkKey`.

## 6. J3 — second independent reference application

**Integrated roadmap status: BLOCKED by J2**

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

## 7. J4 — native Builder generalization

**Integrated roadmap status: BLOCKED by J3**

Goal: generalize capabilities proven by reference scenarios into explicitly versioned `SUPPORTED` native-Builder capabilities.

Every promoted capability must declare preconditions, effects, permissions, supported Grist versions/environments, verification, concurrency protection, recovery and known limitations.

J4 is not a mandate to expose 100% of the Grist REST API.

## 8. J5 — code and integrations

**Integrated roadmap status: BLOCKED by J4 and any capability-specific security/product gates**

Goal: add versioned custom-widget/GitHub/integration workflows under the same execution/evidence model.

This replaces the old idea of generated executable widgets as a vague later experiment. It does **not** automatically authorize arbitrary generated code, generic HTTP, arbitrary network destinations or new public scopes. Those remain separately gated where required.

Exit direction includes exact artifact/version identity, declared Grist permissions, declared network destinations, document contract, tests, progressive deployment and compensation/recovery.

## 9. J6 — durable lifecycle maintenance

**Integrated roadmap status: BLOCKED by J5**

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

## 10. Relationship to deferred P5/P6 and old experiments

The existing deferred `P5 attachments`, `P6 webhooks` and generated-widget ideas should be reconsidered only through a Builder scenario/capability need:

- attachments become eligible only when a committed Builder scenario requires them and their data-minimization/size/recovery contract is defined;
- webhooks/integrations are handled under J5 with effect-oriented authorization and explicit destinations; public-scope changes remain a human gate;
- custom widgets are handled under J5 with artifact/version/permission contracts rather than as an unbounded experiment.

Do not treat old deferred candidates as independently eligible merely because J0-J6 exist.

## 11. Parallelism after roadmap integration

While J0 is active, useful independent C4 operational evidence may continue when its intended environment/operator is available.

Recommended initial state:

```text
PRODUCT / EXECUTION       PLATFORM / SECURITY       DISTRIBUTION
J0 ACTIVE                 C4 ELIGIBLE               existing S0/S1 state unchanged
J1 blocked by J0          C5 blocked as documented
J2 blocked by J1          C6 blocked as documented
```

Do not use unfinished C5 multi-user credentials as a reason to block isolated J0/J1 engineering, and do not use isolated J0/J1 success as evidence that C5/C6 are complete.

## 12. Authoritative roadmap reconciliation

The reviewed product-decision was reconciled into `docs/ROADMAP.md` as one bounded coherence change that:

1. records the frozen Product Vision;
2. adds J0-J6 with the dependency/status rules above;
3. preserves C4/C5/C6 and the existing public-distribution axes;
4. makes J0 the finite committed next product-runtime tranche;
5. updates Controller integration order so J0 is selectable while independent C4/S1 work remains eligible under existing dependencies;
6. preserves historical P0-P4/Q0 evidence.

From that reconciliation onward, Controllers must use `docs/ROADMAP.md`, not this rationale file, to determine J0-J6 eligibility and current status.