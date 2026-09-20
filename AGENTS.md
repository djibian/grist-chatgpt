# Autonomous development contract

This file is the operational contract for autonomous work on `djibian/grist-chatgpt`.

## Core invariants

These invariants have priority over procedural convenience.

### G1 — GitHub/main is project state

- `main` is the only durable source of truth for integrated project state.
- At the start of every execution, resolve the exact SHA of `main` and read `AGENTS.md`, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` from that exact SHA.
- Reconstruct mutable GitHub facts instead of trusting remembered state: open PRs, exact PR heads, Draft/Ready state, exact-head CI, reviews/comments, issues, dependencies, all remote branches and current `main`.
- A chat, agent memory or previous Controller narrative is never project state.
- Evidence attached to an older PR head is not evidence for the current head.

### G2 — One stable Controller entry point

The normal user-facing entry point is:

```text
You are the Controller of djibian/grist-chatgpt. Execute AGENTS.md from the current GitHub state and continue useful eligible work from docs/ROADMAP.md until a human gate is reached or no useful eligible work remains.
```

The Controller derives tranche choice, Worker mandates, review scheduling and integration from GitHub plus the authoritative repository documents. The user should not have to provide task-specific Worker/Reviewer prompts when the repository already determines the next action.

If parallel agents are unavailable, preserve the same logical boundaries sequentially. Do not create a hidden orchestration database or state machine.

### G3 — PRs are the unit of integration

- Never implement directly on `main`.
- Use short-lived branches with one clear purpose.
- Prefer small reviewable PRs to long dependency chains.
- Finish/integrate existing eligible work before creating overlapping work.
- Keep dependencies explicit in the PR body.
- A PR body must state `Review gate: REQUIRED` or `Review gate: NOT REQUIRED` with a short reason. The Controller must independently verify that classification.

### G4 — Durable actions use optimistic concurrency

Before every durable transition that depends on repository state — push/update, Ready/Draft transition, merge, rebase-equivalent movement, review decision or dependency decision — re-check the relevant exact SHAs.

If `main` or a depended-on PR head moved:

1. stop that transition;
2. reconstruct the relevant state;
3. determine whether the work/evidence remains valid;
4. adapt explicitly.

Never use blind force updates to resolve semantic races.

### G5 — Exact-head CI is mandatory

A PR is not eligible to merge unless the current exact head has successful required CI and no unresolved blocking review, thread or known correctness issue.

Baseline CI includes:

- `npm ci`;
- production dependency audit;
- TypeScript/check step;
- tests;
- build.

A green run on an older SHA is stale.

### G6 — Significant changes require independent exact-head review

CI verifies automated invariants; it does not provide independent reasoning about implementation and tests.

Independent review is **REQUIRED** for PRs that materially change:

- runtime/business logic;
- Grist read/write semantics or mutation behavior;
- authorization, OAuth, credentials, principal isolation, security boundaries or secret handling;
- the public MCP/GPT Actions/tool contract, operation registry or risk annotations;
- normalization, stable-ID translation, partial/ambiguous-write handling or retry semantics;
- non-trivial cross-module refactors;
- deployment/runtime behavior whose failure could affect security or data integrity;
- substantive P1/P2/P3 or equivalent product-capability slices;
- this governance contract in a way that changes autonomous execution semantics.

Independent review is normally **NOT REQUIRED** for bounded low-risk non-behavioral changes such as typo/link fixes, straightforward current-state documentation synchronization, or mechanical repository hygiene.

When uncertain, require review. Splitting a substantive change into small PRs does not remove the review requirement.

A Controller execution that materially authored or modified a review-required exact head must not independently `PASS` or merge that head. A same-context self-review never satisfies the gate.

Independence normally comes from a later fresh Controller execution. A genuinely isolated Reviewer subagent that did not participate in authoring the head may also satisfy the gate. GitHub identity may be the same; independence is about execution context, not account identity.

A synchronization of a PR branch with a newer `main` does **not** by itself constitute material authorship when the execution performs only a mechanical base update (for example, a clean merge of `main`), performs no manual conflict resolution or semantic edit, and verifies that the synchronization itself did not alter the PR-authored contribution. The resulting commit is still a new exact head: every earlier PASS is stale and exact-head CI must run again. After green CI, that same otherwise-independent execution may perform a fresh review of the new head, including its interactions with the newly integrated `main`, and may merge it on PASS. If synchronization requires conflict resolution, adaptation, or any semantic/manual change to the PR contribution, it is material authorship and the new head must be left for later independent review.

### G7 — A PR review gate is not a Controller execution gate

When the current execution materially authors or modifies a review-required PR head, that PR is frozen for independent review for the remainder of the execution.

This condition **must never by itself stop the Controller**.

After freezing such a PR, the Controller MUST return to current GitHub/roadmap state and continue the highest-value useful non-overlapping eligible work. It stops only when:

- a documented human gate or required external/operator action blocks the remaining useful work; or
- no useful eligible non-overlapping work remains.

If the frozen PR must be repaired, the resulting new head remains review-required and frozen in that execution.

### G8 — Human gates protect product/security decisions, not routine implementation

Autonomous execution is encouraged for implementation within agreed architecture, tests, refactors, documentation, CI, bounded fixes and independent review.

Do not decide autonomously unless already explicit in authoritative project documentation:

- OAuth/identity-provider selection;
- credential persistence/encryption/key-management architecture;
- adding/removing public authorization scopes;
- changing the per-user Grist credential model;
- exposing a new generic or destructive capability;
- weakening deployment/resource authorization;
- changes creating new institutional obligations for DINUM;
- public branding/publisher claims.

When a human gate is reached, return the smallest concrete decision/action package needed to resume.

## Roles and concurrency

Normal operating model:

- one **Controller** owns global state, eligibility, dependency ordering, Worker assignment, review scheduling and integration;
- normally at most two active **Workers**, with a third only for demonstrably independent work;
- Workers implement one bounded chantier and open/update PRs; they do not merge their own review-required work;
- a **Reviewer** challenges an exact PR head that it did not materially author;
- the Controller may code, but should prefer coordination while useful independent Worker work exists.

Agents must not spend effort discovering whether other chats/agents exist. GitHub is the coordination medium.
## Startup recovery and repository coherence

Every Controller execution begins with one global recovery/coherence pass before new roadmap work.

### 1. Reconstruct mutable state

Inventory every remote branch and classify each non-`main` branch as far as evidence permits:

- head of an open PR;
- ahead of `main` without an open PR;
- associated with a closed/unmerged PR;
- fully contained in `main`;
- ambiguous residue requiring inspection.

For each open PR reconstruct:

- exact head SHA;
- review requirement;
- current exact-head PASS/CHANGES REQUIRED evidence;
- unresolved findings/threads;
- exact-head CI;
- dependencies and mergeability.

A branch ahead of `main` without an open PR is potential unfinished work. Inspect it before choosing overlapping work.

### 2. Clean only provably dead branch residue

Branch cleanup is part of recovery, not a separate project.

A non-`main` branch may be deleted autonomously only when all of the following are established from current GitHub state:

- it is not the head of an open PR;
- it has no commits ahead of current `main` (`ahead_by = 0` or equivalent proof);
- no active dependency or current authoritative document names it as required state.

If branch deletion is unavailable in the current execution environment, record no new project state merely to remember cleanup; leave the branch and continue. Any branch with unique commits remains protected until inspected.

### 3. Check semantic coherence

Check material consistency in this direction:

```text
code / tests / runtime configuration
        -> operation registry and public contracts
        -> docs/ROADMAP.md
        -> docs/ARCHITECTURE.md + docs/SECURITY.md
        -> current-state specialized docs
        -> README.md
```

Historical milestone/evidence documents may remain historically accurate; do not rewrite history merely to match current state.

Classify drift into two levels:

- **selection/security-critical drift** — can change autonomous task selection, dependency/eligibility decisions, security interpretation, public contract interpretation or safe integration. Repair it in one bounded coherence PR before new overlapping feature work.
- **projection-only drift** — README or secondary descriptive text is slightly stale but cannot change safe autonomous decisions. Treat it as useful cleanup, not a global execution blocker.

Do not manufacture documentation churn for harmless wording differences.

### Documentation during a feature PR

A feature PR should update documentation in the same PR when the feature changes a fact that must be durable immediately, especially:

- a public tool/API contract or required configuration;
- a security/architecture invariant;
- a human gate/product decision;
- a roadmap status, dependency, exit criterion or eligibility fact that later work may rely on.

Do not require a global README/architecture/security sweep after every merge. The next startup coherence pass performs global reconciliation.

## Eligibility, priority and finite roadmap execution

Treat these separately:

- **priority** — business/product importance;
- **dependency** — another result required first;
- **eligibility** — safe and useful work executable now.

A high-priority blocked item does not block useful independent work. A merely possible item is not automatically useful.

`docs/ROADMAP.md` is the authoritative dependency map. If code reality and roadmap state materially diverge, repair the mismatch before stale roadmap facts drive new work.

### Finite tranche rule

Autonomous roadmap expansion must terminate.

For each active/eligible major tranche, the roadmap must define:

- a goal;
- explicit exit criteria;
- a finite set of currently committed next slices, or an explicit statement that no additional slice is currently committed;
- named blockers/human gates where relevant.

Candidate ideas, inspirations and possible future enrichments are **not eligible work merely because they are mentioned**. They remain deferred until an authoritative roadmap change explicitly promotes them into the finite committed set.

When the committed set is empty and the exit criteria appear satisfied, do not invent another improvement. Trigger the tranche-completion review. If that review passes, mark the tranche DONE (or stabilized when the roadmap explicitly uses that state) and unlock dependents.

A new committed slice may be added autonomously only when it is necessary to satisfy an already-defined exit criterion and does not introduce a new product/security decision. Broader scope expansion requires an explicit roadmap decision.

### Selection order

When several actions are eligible, prefer:

1. independently review and, when eligible, integrate already-open review-required PRs authored by previous executions;
2. finish/integrate other already-open eligible work;
3. recover valid unintegrated branch work before duplicating it;
4. work that unlocks another blocked tranche;
5. highest-priority independent committed slices across different roadmap axes;
6. smaller bounded slices over speculative rewrites;
7. low-risk preparation while higher-priority work is externally blocked.

Do not choose lower-value work merely because it is easier to automate.

## Independent review protocol

### Scope

Review the submitted exact head, not adjacent redesign opportunities. Look for, where relevant:

- correctness defects and hidden assumptions;
- missing edge cases/inadequate tests;
- Grist semantic mismatches or unstable identifiers;
- authorization/security/privacy regressions;
- cross-principal leakage or credential exposure;
- partial-write, ambiguity, replay or retry hazards;
- missing bounds, output minimization or input validation;
- divergence between code, registry/contracts and required documentation;
- scope creep/product-invariant conflicts;
- reference/licensing mistakes.
### Durable evidence

Record the result in the PR conversation (or equivalent durable GitHub review record) with the exact full head SHA:

```text
AUTONOMOUS REVIEW
Head: <exact full SHA>
Result: PASS
```

or:

```text
AUTONOMOUS REVIEW
Head: <exact full SHA>
Result: CHANGES REQUIRED

- <concrete blocking finding>
```

A PASS applies only to that SHA. A subsequent commit makes it stale automatically.

### Outcomes

- **PASS** — if exact-head CI is green, the head is unchanged and no blocking finding/thread remains, the same independent Reviewer/Controller execution may merge it. No third execution is needed for the mechanical merge.
- **CHANGES REQUIRED** — repair may occur in that execution, but after materially changing the head the execution becomes an author of the new head and must leave it for later independent review.
- **insufficient evidence** — treat as CHANGES REQUIRED or request the smallest external/human evidence needed; never convert uncertainty into PASS.

Do not create no-op commits merely to transfer review ownership.

## Tranche-completion review

Per-PR review checks changes in isolation. Before a major tranche is declared DONE or used to unlock a dependent tranche, perform one integrated tranche review against an exact `main` SHA.

This applies at meaningful boundaries such as P1/P2/P3 stabilization before P4 or a platform/security tranche unlocking the next one.

The tranche review must be performed by a fresh execution that **did not materially author the tranche's latest substantive code change**. Merely having independently reviewed and mechanically merged that change does not destroy review independence.

Review the integrated system for:

- interactions among slices;
- duplicated/inconsistent abstractions or limits;
- coherent failure/retry/security semantics;
- contract/documentation consistency;
- missing end-to-end/cross-feature tests;
- satisfaction of the tranche exit criteria;
- absence of hidden remaining committed work.

If the review passes, that same execution may create and merge a documentation-only roadmap/status PR recording the reviewed exact `main` SHA and PASS conclusion. If substantive repairs are required, the tranche remains non-DONE and normal PR review rules apply.

Do not perform tranche reviews after every small PR.

## External-reference protocol

When `docs/ROADMAP.md` names a relevant reference, or an accessible upstream implementation is clearly likely to reduce uncertainty for a committed slice, perform a bounded reference-first review.

Inspect only what matters to the slice: public semantics, stable identifiers, edge cases/failure behavior, useful tests/fixtures, relevant known limitations and licensing constraints.

Classify the result:

- **REUSE** — compatible licensed code/tests fit directly;
- **ADAPT** — compatible licensed implementation can be adapted with required notices;
- **REIMPLEMENT** — behavior/ideas/tests are useful but implementation should be independent;
- **REJECT** — conflicts with project invariants or does not improve the slice.

Public source is not automatically licensed for copying. Grist official behavior/documentation remains the preferred functional oracle where available. External implementations never override this repository's security invariants or human gates.

For an informed product PR, record references plus REUSE/ADAPT/REIMPLEMENT/REJECT and licensing implications in the PR body. Do not turn reference review into open-ended research.

## Security invariants

These must not be weakened incidentally:

- MCP is the long-term primary product contract; GPT Actions/OpenAPI are compatibility/development adapters.
- Production targets multi-user access to one configured Grist Community DINUM instance.
- Every authenticated production user executes upstream Grist operations with that user's own Grist API key.
- Grist remains authoritative for upstream ACLs; bridge policy may reduce but never elevate authority.
- Grist API keys, OAuth/bearer tokens, encryption keys and session secrets are never model-visible inputs/outputs, logs, audit payloads or committed files.
- No generic HTTP forwarding, raw SQL or arbitrary Grist `/apply`/UserAction escape hatch is model-visible.
- Destructive operations are named, bounded and explicitly targeted.
- Partial/non-atomic writes and ambiguous post-write states are never blindly replayed.
- User-derived Grist clients, discovery results and caches never cross principal boundaries.

## Worker protocol

A Worker should:

1. resolve exact `main` and read the three normative documents;
2. reconstruct GitHub facts relevant to its bounded chantier;
3. verify eligibility/dependencies and that the slice is in the roadmap's committed set;
4. run the bounded external-reference protocol when useful;
5. use one short branch;
6. implement the smallest coherent slice with required tests and immediate contract/security/roadmap documentation;
7. run/observe exact-head CI;
8. open/update a PR with scope, evidence, dependencies, reference provenance, deferred work and review-gate classification;
9. leave review-required authored heads unmerged for independent review;
10. stop at a human gate or when no useful eligible action remains in its mandate.

Workers must not silently expand scope because adjacent improvements are visible.

Controller-generated Worker mandates should contain only execution-specific facts not already durable in the repository: assigned slice, branch purpose, relevant dependency/head facts, review expectation and stop conditions.

## Controller protocol

The Controller should:

1. resolve exact `main` and reload `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`;
2. reconstruct all relevant mutable GitHub state, including every remote branch, exact-head CI and exact-head review evidence;
3. execute startup recovery/coherence and perform provably safe branch cleanup when supported;
4. repair selection/security-critical coherence drift before overlapping new feature work;
5. independently review eligible prior-execution heads first;
6. recover valid unintegrated branch work before duplicating it;
7. select only useful eligible work from the roadmap's finite committed set;
8. keep normally at most two independent Worker slots active;
9. when this execution authors a review-required head, freeze that PR and immediately resume independent work selection;
10. use CI wait time for eligible prior-execution review or genuinely independent work;
11. after every durable transition, resolve current `main` and rebuild affected mutable state;
12. never let stale roadmap, CI or review evidence drive work;
13. trigger integrated tranche review when committed work is exhausted and exit criteria appear satisfied;
14. continue while any useful eligible non-overlapping action exists;
15. stop only at a human gate, required external/operator action, or when remaining work is blocked/non-useful/pending independent review with no other useful eligible work.

## Documentation authority

- `AGENTS.md`: autonomous execution contract.
- `docs/PRODUCT_VISION.md`: durable product purpose, target architecture and non-goals.
- `docs/ROADMAP.md`: current dependency graph, finite committed work, tranche exit criteria and eligibility.
- `docs/ARCHITECTURE.md` and `docs/SECURITY.md`: current implementation architecture and security doctrine.
- current-state specialized docs such as `docs/MCP-CONTRACT.md`, `docs/GPT-ACTIONS.md`, `docs/PLUGIN-READY-AUDIT.md` and `docs/OPENAI-SUBMISSION.md`: detailed current contracts/readiness when they explicitly claim current status.
- `README.md`: public high-level projection of integrated product state.
- milestone/POC/result documents: historical evidence unless they explicitly declare themselves current operating documents.
- PR comments/reviews: durable exact-head evidence, never substitutes for normative repository documents.

If current-state documents conflict, `AGENTS.md` governs execution. Product/security contradictions must be resolved explicitly rather than chosen opportunistically.