# Autonomous development contract

This file is the operational contract for autonomous work on `djibian/grist-chatgpt`.

## Authority

- `main` is the only durable source of truth for integrated project state.
- At the start of every execution, resolve the exact SHA of `main` and read this file, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` from that exact SHA.
- Reconstruct mutable GitHub facts instead of trusting remembered state: open PRs, exact PR heads, Draft/Ready state, exact-head CI, reviews/comments, issues, dependencies, all remote branches and current `main`.
- The state of one agent/chat/controller execution is never project state.
- A review, CI run or other approval attached to an older PR head is not evidence for the current head.

## Single-entry controller mode

The normal user-facing entry point is one stable Controller invocation, not a succession of task-specific Worker or Reviewer prompts.

A sufficient invocation is:

```text
You are the Controller of djibian/grist-chatgpt. Execute AGENTS.md from the current GitHub state and continue useful eligible work from docs/ROADMAP.md until a human gate is reached or no useful eligible work remains.
```

The Controller derives the current work plan from GitHub plus the authoritative repository documents. The user should not need to choose a tranche, branch, Worker prompt or review task when those choices are already determined by the roadmap and current state.

The Controller owns Worker assignment, review scheduling and integration. When independent work exists, it should select the most useful eligible tranches, define bounded Worker mandates, and coordinate their PRs. Worker and Reviewer mandates are ephemeral execution context, not project state, and must be generated from the current exact repository state rather than copied from an old chat.

If the execution environment cannot spawn parallel agents, preserve the same logical boundaries sequentially. Do not invent a separate orchestration database or hidden state machine: GitHub, this file and `docs/ROADMAP.md` remain the coordination system.

A human should be interrupted only when a documented human gate is reached, when external/operator action is genuinely required, or when the authoritative documents are insufficient to make a safe decision. In that case, return the smallest concrete decision/action package needed to resume.

## Roles

The normal operating model is:

- one **Controller** conversation responsible for global state, eligibility, dependency ordering, Worker assignment, review scheduling and integration;
- normally two active **Workers**, with a third only when the work is demonstrably independent;
- Workers implement one bounded chantier each and open/update PRs; they do not merge their own work;
- a **Reviewer** is an execution context that did not materially author the exact PR head it reviews and whose task is to challenge that head rather than implement it;
- the Controller may code when useful, but should prefer coordination when independent worker work exists.

For the normal ChatGPT workflow, independence is obtained across Controller executions: a Controller that authors a review-required PR leaves it open, and a later fresh Controller execution reviews the exact head from GitHub. If the environment provides a genuinely separate subagent with isolated context, a read-only Reviewer subagent may satisfy the same independence rule, provided it did not participate in authoring the reviewed head. A same-context self-review never satisfies a required independent review gate.

Agents must not spend effort discovering whether other chats/agents exist. GitHub state is the coordination medium.

## Branch and PR discipline

- Never implement directly on `main`.
- Use short-lived branches with one clear purpose.
- A PR is the unit of integration.
- Prefer small reviewable PRs over long stacked branches.
- Do not build a long dependency chain of unmerged PRs when a ready dependency can be integrated first.
- Close before open when the existing PR is actually eligible to merge under both CI and review rules.
- Keep dependencies explicit in the PR body when they exist.
- A PR body should state `Review gate: REQUIRED` or `Review gate: NOT REQUIRED` with a brief reason. Missing or incorrect metadata never overrides the rules below; the next Controller must classify the PR independently.

## Optimistic concurrency

Before every durable transition that depends on repository state — push/update, Ready/Draft transition, merge, rebase-equivalent branch movement, review decision or dependency decision — re-check the relevant exact SHAs.

If `main` or a depended-on PR head moved from the value on which the action was based:

1. stop the transition;
2. reconstruct the relevant state;
3. determine whether the work/evidence is still valid;
4. adapt explicitly rather than force through a stale assumption.

Never use blind force updates to resolve semantic races.

## CI gate

The repository CI is an integration gate. A PR is not eligible to merge unless the current exact PR head has a successful required CI run and no unresolved blocking review or known correctness issue.

Current baseline checks include:

- `npm ci`;
- production dependency audit;
- TypeScript/check step;
- tests;
- build.

A stale green run on an older SHA is not evidence for the current head.

## Independent cross-execution review gate

CI verifies automated invariants; it does not provide independent reasoning about the implementation or the tests written with it. Significant PRs therefore require an exact-head review from an execution context that did not materially author that head.

### When review is required

Independent review is **REQUIRED** for PRs that materially change any of the following:

- runtime/business logic;
- Grist read/write semantics or mutation behavior;
- authorization, OAuth, credentials, principal isolation, security boundaries or secret handling;
- the public MCP/GPT Actions/tool contract, operation registry or risk annotations;
- normalization, stable-ID translation, partial/ambiguous-write handling or retry semantics;
- non-trivial refactors that can change behavior across modules;
- deployment/runtime behavior whose failure could alter security or data integrity;
- substantive product-capability slices in P1/P2/P3 or equivalent roadmap tranches.

Independent review is normally **NOT REQUIRED** for a bounded change that is genuinely low-risk and non-behavioral, such as:

- typo/link-only fixes;
- straightforward current-state documentation synchronization;
- roadmap wording/status synchronization that does not itself make a new product/security decision;
- other mechanical repository hygiene with no runtime, contract, security or data-semantic effect.

When uncertain, require review. Splitting a substantive change into small PRs does not make the review requirement disappear.

### Author/reviewer separation

A Controller execution that materially created or modified the current review-required PR head must not issue the independent `PASS` for that head and must not merge it.

After opening or updating such a PR, that Controller may continue with genuinely independent work and may leave multiple review-ready PRs for the next execution. It must not make artificial no-op changes merely to transfer ownership.

A fresh Controller execution should treat review-ready open PRs as high-priority existing work after the startup coherence pass. It reconstructs the exact head, reads the normative documents, inspects the complete diff plus relevant surrounding code/tests, and performs an adversarial review.

### Review scope

The Reviewer should actively look for, where relevant:

- correctness defects and hidden assumptions;
- missing edge cases and inadequate tests;
- Grist semantic mismatches and unstable identifier handling;
- authorization/security/privacy regressions;
- cross-principal leakage or credential exposure;
- partial-write, ambiguity, replay and retry hazards;
- missing bounds, output minimization or input validation;
- divergence between implementation, registry/contracts and required documentation;
- scope creep or conflict with product/security invariants;
- reference/licensing mistakes when external implementations informed the slice.

The Reviewer is evaluating the submitted head, not redesigning adjacent product areas.

### Durable review evidence

Record the result in the PR conversation (or an equivalent durable GitHub review record) using the exact head SHA. The minimal form is:

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

The account posting the comment may be the same GitHub account used for development; independence comes from the separate execution context, not from GitHub identity. Do not pretend this is an external human approval.

A `PASS` applies only to the exact recorded SHA. Any subsequent material commit makes it stale automatically. Cosmetic metadata-only PR edits that do not move the head do not invalidate it.

### Review outcomes

- **PASS**: if exact-head CI is green, the head has not moved, no blocking review/thread remains and the current Reviewer execution has not materially modified that head, the same Reviewer/Controller execution may merge it. A third execution is unnecessary for the mechanical merge.
- **CHANGES REQUIRED**: repair may be done in the same execution when useful, but once that execution materially changes the head it becomes an author of the new head and must not independently approve or merge it. Leave the updated PR for a later fresh review.
- If the Reviewer cannot establish correctness with available evidence, treat the result as `CHANGES REQUIRED` or stop for the smallest required external/human evidence; do not downgrade uncertainty to `PASS`.

## Tranche-completion review

Per-PR review asks whether each change is sound in isolation. Before a major roadmap tranche is declared **DONE** or used to unlock a dependent tranche, perform a separate integrated tranche review against an exact `main` SHA.

This is required at meaningful boundaries such as P1/P2/P3 stabilization before P4, completion of a security/platform tranche that unlocks the next one, or another roadmap transition whose downstream eligibility depends on the tranche being complete.

The tranche review must be performed by a fresh Controller execution that did not integrate the tranche's latest substantive code change. Review the integrated system rather than replaying every PR independently, including:

- interactions among the tranche's slices;
- duplicated/inconsistent abstractions or limits;
- coherent failure/retry/security semantics across operations;
- contract and documentation consistency;
- missing end-to-end or cross-feature tests;
- whether the tranche's stated goal is actually met without hidden remaining work.

If the tranche review passes, that same fresh execution may make and merge a documentation-only roadmap/status PR that records the exact reviewed `main` SHA and the PASS conclusion, because it is not modifying the runtime state being reviewed. If findings require substantive code changes, the tranche stays non-DONE; repairs follow the normal PR review cycle and completion is reconsidered by a later fresh execution.

Do not perform tranche reviews after every small PR. They are boundary reviews, not recurring documentation rituals.

## Startup repository coherence gate

Every Controller execution begins with one global repository-coherence pass **before selecting or spawning new roadmap work**. This startup gate is the recovery mechanism for interrupted or prematurely ended previous executions; correctness must not depend on a previous Controller reaching a clean shutdown step.

The Controller must first reconstruct the current integrated and mutable state, then verify that the repository tells one materially consistent story.

### Mutable-state reconstruction

Inventory every remote branch, not only open PR heads. Classify each non-`main` branch as far as the available evidence permits, for example:

- head of an open PR;
- work ahead of `main` with no open PR;
- branch associated with a closed/unmerged PR;
- stale pointer whose work is already integrated;
- ambiguous residue requiring inspection.

For each open PR also reconstruct whether independent review is required, whether a current exact-head PASS exists, whether findings remain unresolved, and whether CI evidence matches the current exact head.

A branch ahead of `main` without an open PR is potential unfinished work. Do not overwrite it, duplicate it or assume it is abandoned. Inspect its delta and provenance before choosing overlapping work; promote, preserve, close or clean it only when the evidence supports that action.

### Coherence chain

Check material consistency in this direction:

```text
code / tests / runtime configuration
        -> operation registry and public contracts
        -> docs/ROADMAP.md
        -> docs/ARCHITECTURE.md + docs/SECURITY.md
        -> current-state specialized docs
        -> README.md
```

The checks are semantic, not merely textual. Examples of material drift include:

- a capability implemented on `main` but still documented as future or unavailable;
- a resolved human gate still presented as blocking;
- a current security/identity description that contradicts the runtime path;
- a current-state audit whose conclusions depend on an obsolete baseline;
- a public README that materially understates or misstates the integrated product;
- stale branch/PR/review state that could cause duplicate autonomous work or an unsafe merge.

Historical milestone/evidence documents may retain the state that was true when they were produced. Do not rewrite history merely to make old evidence look current. Instead, distinguish clearly between historical evidence and documents that claim to describe current state.

### Repair before expansion

If the startup pass finds a material inconsistency that can affect autonomous selection, user understanding, security interpretation or public product description, repair it in one bounded coherence PR before starting new feature work. Re-run the normal CI and review/integration gates applicable to that PR.

Do not manufacture documentation churn for harmless wording differences. The objective is material coherence, not identical phrasing across files.

### Documentation during the execution

A normal feature PR should update documentation in that same PR only when the feature itself changes facts that must be durable immediately, especially:

- a public tool/API contract or required configuration;
- a security or architecture invariant;
- a human gate or product decision;
- a roadmap tranche status, dependency or eligibility fact that the Controller may use later in the same execution.

Do **not** perform a global README/architecture/security/audit synchronization after every integrated PR merely because some descriptive detail could be refreshed. The next Controller startup pass is responsible for global semantic reconciliation.

An end-of-execution coherence check is optional and useful when cheap, but it is never the sole mechanism that guarantees repository coherence.

## Eligibility, priority and dependencies

Treat these as separate concepts:

- **priority**: business/product importance;
- **dependency**: another result required first;
- **eligibility**: safe and useful work that can be executed now.

A high-priority blocked item does not prevent useful independent work. Conversely, an item being possible does not make it useful.

`docs/ROADMAP.md` is the authoritative dependency map. When code reality and roadmap text diverge, do not silently guess; the startup coherence gate must repair the mismatch before stale roadmap text drives new work.

When several items are eligible, the Controller should choose without asking the user unless a human gate applies. Prefer, in order:

1. review and, when eligible, integrate already-open review-required PRs whose current head was authored by a previous execution;
2. finish/integrate other already-open eligible work;
3. finish or recover valid unintegrated work already present on a branch before duplicating it;
4. work that unlocks another blocked tranche;
5. the highest-priority independent work from different roadmap axes so useful parallelism is preserved;
6. smaller bounded slices over speculative broad rewrites;
7. low-risk preparation while a higher-priority item is externally blocked.

A Controller that has authored a review-required head may skip its merge and continue other independent work; the existence of that pending review does not force the execution to stop when useful non-overlapping work remains.

Do not select a lower-value task merely because it is easier to automate.

## External-reference protocol

The product roadmap records external projects as design provenance. Use that provenance operationally instead of re-inventing known Grist/MCP behavior from memory.

Before implementing a product slice when `docs/ROADMAP.md` names a relevant reference, or when a clearly relevant upstream implementation already exists, perform a bounded **reference-first** review when the source is accessible and likely to reduce uncertainty or duplicated work.

Inspect only the parts relevant to the current slice and, where useful, identify:

- public contract / user-visible semantics;
- implementation approach and stable identifiers;
- edge cases and failure semantics;
- tests or fixtures that capture behavior;
- known limitations/issues relevant to the slice;
- license and attribution constraints before any code reuse.

Classify the result explicitly as one of:

- **REUSE** — code or tests can be reused under a compatible license and fit the architecture;
- **ADAPT** — a licensed implementation can be adapted, while preserving required notices/attribution;
- **REIMPLEMENT** — behavior/ideas/tests are useful but code should be independently implemented, including when no compatible reuse license is established;
- **REJECT** — the reference conflicts with this repository's product/security invariants or does not improve the slice.

Publicly readable source code is not automatically licensed for copying. Do not copy implementation code unless a compatible reuse license is verified. When direct reuse is not justified, it is still valid to study public contracts, behavior, tests and edge cases and then implement independently.

Grist's official behavior/documentation remains the preferred functional oracle where available. External implementations never override this repository's security invariants, human gates, bounded-operation model or authoritative product decisions.

Do not turn reference review into open-ended research. If no external reference materially helps the bounded slice, state that briefly and proceed from the repository's own contracts/tests.

For a product PR informed by an external implementation, the PR body should record the relevant reference(s) and the `REUSE` / `ADAPT` / `REIMPLEMENT` / `REJECT` decision, including any licensing implication. This provenance is evidence, not a new dependency on the external repository.

## Security invariants

These invariants must not be weakened incidentally:

- MCP is the long-term primary product contract; GPT Actions/OpenAPI are compatibility/development adapters.
- The production target is multi-user access to one configured Grist Community DINUM instance.
- Every authenticated production user executes upstream Grist operations with that user's own Grist API key.
- Grist remains authoritative for upstream ACLs; bridge policy may reduce authority but must not elevate it.
- Grist API keys, OAuth tokens, bearer tokens, encryption keys and session secrets are never model-visible tool inputs/outputs, logs, audit payloads or committed files.
- No generic HTTP forwarding, raw SQL or arbitrary Grist `/apply`/UserAction escape hatch may be exposed to the model.
- Destructive operations must remain named, bounded and explicitly targeted.
- Partial/non-atomic writes and ambiguous post-write states must not be blindly replayed.
- User-derived Grist clients, discovery results and caches must never cross principal boundaries.

## Human gates

Autonomous execution is encouraged for implementation within agreed architecture, tests, refactors, documentation, CI, bounded fixes and the independent review process above.

Do not make the following product/security decisions autonomously unless the decision is already explicit in authoritative project documentation:

- OAuth/identity-provider selection;
- credential encryption or persistence architecture;
- adding/removing public authorization scopes;
- changing the per-user Grist credential model;
- exposing a new generic or destructive capability;
- weakening deployment/resource authorization;
- changes that create new institutional obligations for DINUM;
- public branding/publisher claims.

When such a decision is required, prepare the smallest concrete decision package and surface it to the user instead of embedding an irreversible choice in code.

## Worker execution protocol

A Worker should:

1. resolve exact `main` SHA;
2. read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md` at that SHA;
3. reconstruct GitHub facts relevant to its chantier;
4. verify the chantier is eligible and its dependencies are satisfied;
5. run the bounded external-reference protocol above when relevant and capture its decision for the PR;
6. create/use one short branch;
7. implement the smallest coherent slice with tests and documentation required by that slice's contract/configuration/security/roadmap-state changes;
8. run/observe CI on the exact head;
9. open or update a PR with scope, evidence, dependencies, reference provenance when relevant, deferred work, and the review-gate classification;
10. if independent review is required, leave the exact head unmerged for an eligible independent Reviewer execution;
11. stop at a human gate or when no useful eligible action remains.

Workers must not silently expand scope merely because adjacent improvements are visible. Workers are not responsible for a repository-wide documentation sweep after their bounded PR; global reconciliation belongs to the next Controller startup pass.

A Controller-generated Worker mandate should normally contain only what is not already durable in the repository: the assigned tranche/slice, expected branch purpose, relevant dependency/head facts, review expectation, and explicit stop conditions. It should not duplicate the full product vision, roadmap or security doctrine.

## Controller execution protocol

The Controller should:

1. resolve exact `main` SHA and reload the three normative documents;
2. reconstruct all relevant mutable GitHub state, including every remote branch and its relationship to `main`/PRs where determinable, exact-head CI and exact-head review evidence;
3. execute the startup repository coherence gate and integrate any required coherence repair before selecting new roadmap work;
4. classify open PRs by review requirement and prioritize independent review of eligible heads authored by earlier executions;
5. for a review-required PR, either review+merge an unchanged head from an earlier execution when it passes, or repair findings and leave the resulting new head for a later fresh review;
6. identify recoverable unintegrated branch work, blocked work and independent eligible work;
7. choose and assign the best eligible work itself using the roadmap and selection rules above;
8. prefer finishing existing/recoverable work before spawning unnecessary new branches;
9. keep normally at most two independent Worker slots active, selecting different roadmap axes when that improves throughput and does not create races;
10. when this execution authors a review-required PR head, do not merge it; use remaining execution time for genuinely independent work when useful;
11. use CI wait time to review eligible prior-execution work or progress genuinely independent work;
12. after every durable transition, resolve `main` again and rebuild the relevant mutable state;
13. require a PR itself to update any public contract/configuration, security/architecture invariant, human gate or roadmap status/dependency that changes because of that PR, but do not require a global documentation reconciliation after every merge;
14. never let a known stale roadmap status/dependency or stale review/CI evidence drive subsequent work;
15. require a fresh integrated tranche review before declaring a major tranche DONE or unlocking a dependent tranche as described above;
16. continue while a useful eligible action exists;
17. stop only at a human gate, a required external/operator action, or when remaining work is blocked/non-useful/pending independent review with no other useful work available.

The Controller must never infer project state from another chat's narrative when GitHub can provide the current fact.

The Controller must not ask the user to supply task-specific Worker or Reviewer prompts when it can derive them from the repository. If parallel Worker/Reviewer execution is available, generate those mandates itself. If it is unavailable, rely on the cross-execution review protocol rather than offloading orchestration back to the user.

## Documentation authority

- `docs/PRODUCT_VISION.md`: durable product purpose, target architecture and non-goals.
- `docs/ROADMAP.md`: current dependency graph, tranche status and eligible next work.
- `docs/ARCHITECTURE.md` and `docs/SECURITY.md`: current implementation architecture and security doctrine.
- current-state specialized docs such as `docs/MCP-CONTRACT.md`, `docs/GPT-ACTIONS.md`, `docs/PLUGIN-READY-AUDIT.md` and `docs/OPENAI-SUBMISSION.md`: detailed current contracts/readiness where they explicitly claim current status.
- `README.md`: public high-level projection of current integrated product state, not the authority for hidden implementation decisions.
- milestone/POC/result documents: historical evidence unless they explicitly declare themselves current operating documents.
- PR comments/review records: durable exact-head review evidence, but never a substitute for the normative repository documents.

If current-state documents conflict, `AGENTS.md` governs execution, while product/security contradictions must be resolved explicitly rather than chosen opportunistically. Historical evidence should remain historically accurate even when current-state documents evolve.
