# Autonomous development contract

This file is the operational contract for autonomous work on `djibian/grist-chatgpt`.

## Authority

- `main` is the only durable source of truth for integrated project state.
- At the start of every execution, resolve the exact SHA of `main` and read this file, `docs/PRODUCT_VISION.md` and `docs/ROADMAP.md` from that exact SHA.
- Reconstruct mutable GitHub facts instead of trusting remembered state: open PRs, exact PR heads, Draft/Ready state, CI, reviews, issues, dependencies and current `main`.
- The state of one agent/chat/controller execution is never project state.

## Single-entry controller mode

The normal user-facing entry point is one stable Controller invocation, not a succession of task-specific Worker prompts.

A sufficient invocation is:

```text
You are the Controller of djibian/grist-chatgpt. Execute AGENTS.md from the current GitHub state and continue useful eligible work from docs/ROADMAP.md until a human gate is reached or no useful eligible work remains.
```

The Controller must derive the current work plan from GitHub plus the authoritative repository documents. The user should not need to choose a tranche, branch or Worker prompt when those choices are already determined by the roadmap and current state.

The Controller owns Worker assignment. When independent work exists, it should select the most useful eligible tranches, define bounded Worker mandates, and coordinate their PRs. A Worker mandate is ephemeral execution context, not project state, and should be generated from the current exact `main` rather than copied from an old chat.

If the execution environment cannot actually spawn parallel agents, the Controller should preserve the same logical Worker boundaries while progressing the selected tranches sequentially. Do not invent a separate orchestration database or hidden state machine: GitHub, this file and `docs/ROADMAP.md` remain the coordination system.

A human should be interrupted only when a documented human gate is reached, when external/operator action is genuinely required, or when the authoritative documents are insufficient to make a safe decision. In that case, return the smallest concrete decision/action package needed to resume.

## Roles

The normal operating model is:

- one **Controller** conversation responsible for global state, eligibility, dependency ordering, Worker assignment, review and integration;
- normally two active **Workers**, with a third only when the work is demonstrably independent;
- Workers implement one bounded chantier each and open/update PRs; they do not merge their own work;
- the Controller may code when useful, but should prefer coordination when independent Worker work exists.

Agents must not spend effort discovering whether other chats/agents exist. GitHub state is the coordination medium.

## Branch and PR discipline

- Never implement directly on `main`.
- Use short-lived branches with one clear purpose.
- A PR is the unit of integration.
- Prefer small reviewable PRs over long stacked branches.
- Do not build a long dependency chain of unmerged PRs when a ready dependency can be integrated first.
- Close before open: if a PR is safely integrable and leaving it open has no useful purpose, integrate it before opening dependent work.
- Keep dependencies explicit in the PR body when they exist.

## Optimistic concurrency

Before every durable transition that depends on repository state — push/update, Ready/Draft transition, merge, rebase-equivalent branch movement or dependency decision — re-check the relevant exact SHAs.

If `main` or a depended-on PR head moved from the value on which the action was based:

1. stop the transition;
2. reconstruct the relevant state;
3. determine whether the work is still valid;
4. adapt explicitly rather than force through a stale assumption.

Never use blind force updates to resolve semantic races.

## CI gate

The repository CI is the integration gate. A PR is not eligible to merge unless the current exact PR head has a successful required CI run and no unresolved blocking review or known correctness issue.

Current baseline checks include:

- `npm ci`;
- production dependency audit;
- TypeScript/check step;
- tests;
- build.

A stale green run on an older SHA is not evidence for the current head.

## Eligibility, priority and dependencies

Treat these as separate concepts:

- **priority**: business/product importance;
- **dependency**: another result required first;
- **eligibility**: safe and useful work that can be executed now.

A high-priority blocked item does not prevent useful independent work. Conversely, an item being possible does not make it useful.

`docs/ROADMAP.md` is the authoritative dependency map. When code reality and roadmap text diverge, do not silently guess; make the mismatch durable through an appropriate PR or human decision.

When several items are eligible, the Controller should choose without asking the user unless a human gate applies. Prefer, in order:

1. finishing or integrating already-open eligible work;
2. work that unlocks another blocked tranche;
3. the highest-priority independent work from different roadmap axes so useful parallelism is preserved;
4. smaller bounded slices over speculative broad rewrites;
5. low-risk preparation while a higher-priority item is externally blocked.

Do not select a lower-value task merely because it is easier to automate.

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

Autonomous execution is encouraged for implementation within agreed architecture, tests, refactors, documentation, CI and bounded fixes.

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
5. create/use one short branch;
6. implement the smallest coherent slice with tests and docs where needed;
7. run/observe CI on the exact head;
8. open or update a PR with scope, evidence, dependencies and deferred work;
9. stop at a human gate or when no useful eligible action remains.

Workers must not silently expand scope merely because adjacent improvements are visible.

A Controller-generated Worker mandate should normally contain only what is not already durable in the repository: the assigned tranche/slice, expected branch purpose, relevant dependency/head facts, and explicit stop conditions. It should not duplicate the full product vision, roadmap or security doctrine.

## Controller execution protocol

The Controller should:

1. resolve exact `main` SHA and reload the three normative documents;
2. reconstruct all relevant mutable GitHub state;
3. identify ready-to-integrate PRs, blocked work and independent eligible work;
4. choose and assign the best eligible work itself using the roadmap and selection rules above;
5. prefer finishing eligible existing work before spawning unnecessary new branches;
6. keep normally at most two independent Worker slots active, selecting different roadmap axes when that improves throughput and does not create races;
7. use CI wait time to review or progress genuinely independent work;
8. after every durable transition, resolve `main` again and rebuild the relevant state;
9. update roadmap/evidence documentation through normal PR discipline when durable project state changes;
10. continue while a useful eligible action exists;
11. stop only at a human gate, a required external/operator action, or when remaining work is blocked/non-useful.

The Controller must never infer project state from another chat's narrative when GitHub can provide the current fact.

The Controller must not ask the user to supply task-specific Worker prompts when it can derive those prompts from the repository. If parallel Worker execution is available, the Controller should generate those mandates itself. If it is unavailable, execute the same bounded work sequentially rather than offloading orchestration back to the user.

## Documentation authority

- `docs/PRODUCT_VISION.md`: durable product purpose, target architecture and non-goals.
- `docs/ROADMAP.md`: current dependency graph, tranche status and eligible next work.
- `docs/PLUGIN-READY-AUDIT.md`: detailed plugin-readiness analysis and submission gaps.
- `docs/ARCHITECTURE.md` and `docs/SECURITY.md`: implementation architecture and security doctrine.

If these documents conflict, `AGENTS.md` governs execution, while product/security contradictions must be resolved explicitly rather than chosen opportunistically.
