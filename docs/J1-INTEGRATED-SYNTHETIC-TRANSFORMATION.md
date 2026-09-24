# J1 integrated synthetic transformation

This document records the finite end-to-end evidence scenario required by J1. It is a controlled synthetic proof of execution semantics, not a new public Builder capability and not a claim of production multi-writer safety.

## Scope

The scenario composes the already-integrated J1 primitives without adding another dispatcher or model-visible surface:

- immutable execution / plan / mandate identity;
- two deterministic bounded `update_records` steps;
- one cumulative `records` plan budget shared by both steps;
- immutable per-step effect-intent identity and exact before/after state tokens;
- durable `FileExecutionJournal` write-ahead state;
- point-in-time authority re-resolution before every new or explicitly retried effect;
- capability-specific deterministic `update_records` recovery;
- immutable verification requirements;
- contextual durable evidence and latest-verdict completion semantics.

The fixture has only three canonical states:

```text
fixture:phase-0:v1
  -- set-phase-a -->
fixture:phase-1:v1
  -- set-phase-b -->
fixture:phase-2:v1
```

The two upstream effects have stable synthetic IDs `701` and `702`. The default plan budget is exactly two record mutations, one per step.

## Crash / fault matrix

`test/j1-integrated-synthetic-transformation.test.ts` exercises the same bounded transformation across the required J1 interruption boundaries.

| Boundary | Durable state after interruption | Restart decision / evidence | Required outcome |
| --- | --- | --- | --- |
| before effect dispatch | pristine `PENDING`, no reservation | retry from durable plan after fresh authority resolution | exactly one eventual effect |
| after write-ahead, before upstream effect | `RUNNING`, reserved budget, no effect knowledge | restart -> `SUSPENDED + UNCERTAIN`; exact frozen precondition proves no effect | explicit `SAFE_TO_RETRY`, reservation released, fresh authority check before retry |
| after upstream effect, before result persistence | `RUNNING`, reserved budget; prior verified step retained | restart -> `SUSPENDED + UNCERTAIN`; exact frozen postcondition plus stable effect ID proves application | `EFFECT_CONFIRMED`, no replay, budget consumed once |
| after result persistence, before verification | `EFFECT_RECORDED + APPLIED` with stable ID | restart reads durable effect knowledge | verification only; no redispatch |
| during verification | `EFFECT_RECORDED` plus durable contextual `UNKNOWN` evidence | restart uses latest linked verdict | completion refused until later `VERIFIED` evidence is durably appended |

Additional end-to-end cases prove:

- the two-step happy path consumes the cumulative budget exactly once per applied step and reaches `COMPLETED` only after both frozen verification requirements are satisfied;
- re-opening the same completed immutable execution does not create a new execution and an attempted repeat cannot redispatch the already-satisfied first effect;
- a response-lost second step retains the first step's confirmed stable ID and verified state across restart;
- an independently diverged state that matches neither frozen before nor frozen after remains durably `SUSPENDED + UNCERTAIN`, with its reservation retained and no blind replay;
- a plan budget of one allows the first one-record effect but refuses the second before dispatch, so splitting the transformation across steps cannot evade the cumulative limit.

## Guarantee boundary

The exact-state observations in this fixture are trusted controlled-environment observations. They make deterministic reconciliation possible only because the synthetic target is isolated/coordinated and the plan freezes distinct exact before/after tokens.

This evidence does **not** turn an ordinary Grist read-before-write into compare-and-set and does not broaden J1 to general production multi-writer execution. The existing concurrency classification/refusal contract remains authoritative outside this isolated scenario.

Likewise, recovery is deliberately capability-specific. The scenario proves only the deterministic `update_records` rule already implemented for J1:

```text
exact frozen after state + stable effect evidence -> confirm, do not replay
exact frozen before state + no contradictory effect evidence -> explicit safe retry
anything observationally ambiguous -> suspend
```

No generic Grist `/apply`, UserAction, HTTP forwarding, planner, ACL authoring, browser verification or scheduler is introduced.

## Reference disposition

No external implementation is reused for this slice. The authoritative behavior is the repository's frozen `docs/EXECUTION-ENGINE-J0-J1.md` contract and the already-reviewed J1 runtime primitives. Grist-specific production semantics are intentionally outside this synthetic proof, so copying or adapting an upstream implementation would add unrelated uncertainty rather than reduce it.

## Completion boundary

This scenario is the last committed implementation/evidence slice in J1. After this exact-head test evidence is independently reviewed and integrated, J1 has no implementation slice left: the next roadmap action is the fresh integrated J1 tranche-completion review against an exact `main` SHA.