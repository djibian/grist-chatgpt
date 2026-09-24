# J1 deterministic `update_records` recovery

Status: **review-required implementation sub-slice**.

This slice implements one capability-specific recovery rule for the first isolated J1 synthetic scenario. It is deliberately narrower than a generic write-recovery engine.

## Accepted recovery contract

The immutable execution step must be an `update_records` step with:

- the normal immutable execution/plan/principal/mandate/target identity;
- a durable prepared effect identity;
- two distinct exact state tokens in `expectedStateTokens`:
  - `recovery.before` — the canonical state proving the intended effect is absent;
  - `recovery.after` — the canonical state proving the intended postcondition is present.

Recovery begins only after the existing restart rule has durably converted an unresolved `RUNNING` step to execution `SUSPENDED`, step `SUSPENDED`, effect state `UNCERTAIN`, while retaining the prepared effect identity and its cumulative-budget reservation.

A trusted capability-specific observer reads the exact synthetic target and returns only its current canonical state token plus stable confirmed-effect evidence when applicable. The observer does not decide whether to retry or continue: the engine compares the observation against the immutable tokens frozen in the plan.

## Recovery outcomes

### Frozen postcondition observed

When the current token equals `recovery.after` and stable confirmed-effect evidence is available:

- the uncertain effect is durably resolved as `APPLIED`;
- the step becomes `EFFECT_RECORDED`;
- its reserved plan budget becomes consumed;
- the execution returns to `RUNNING` so normal verification can continue;
- the mutation is **not replayed**.

### Frozen precondition observed

When the current token equals `recovery.before` and there is no contradictory confirmed-effect evidence:

- the effect is durably resolved as `NOT_APPLIED`;
- the reservation is released;
- the exact step is restored to `PENDING` with its prepared-effect marker cleared;
- the result is `SAFE_TO_RETRY`.

`SAFE_TO_RETRY` is not dispatch authorization and causes no automatic replay. A later attempt must go through the ordinary effect boundary again, including current authority, fresh preconditions, cumulative budget admission and durable write-ahead preparation.

### Any other observation

If the state is unknown, human-modified, malformed or otherwise different from both frozen states, the journal remains unchanged in `SUSPENDED` / `UNCERTAIN`. The engine does not guess whether the effect occurred and does not replay it.

Contradictory evidence also fails closed. In particular, the frozen precondition cannot be accepted together with a claimed confirmed effect, and the frozen postcondition cannot convert uncertainty to `APPLIED` without stable confirmed-effect evidence.

## Scope boundaries

This slice does **not**:

- dispatch or retry a Grist mutation;
- generalize recovery to `create_records`, deletion, schema/UI mutations or arbitrary operations;
- recover a step that already retains confirmed partial effects;
- weaken current authority or precondition requirements;
- implement compensation;
- claim protected multi-writer concurrency;
- choose production persistence, credentials or authorization storage;
- introduce a model-visible generic Grist escape hatch.

The observer is a controlled-environment capability seam. A later J1 coordinator/fixture must supply the actual deterministic observation for the chosen synthetic target and demonstrate the required crash matrix.

## Evidence

Focused tests cover:

- restart uncertainty followed by exact postcondition observation, with confirmed effect retention and no replay;
- exact precondition observation, reservation release and explicit later re-preparation rather than automatic retry;
- ambiguous/human-diverged state remaining durably suspended;
- contradictory precondition/effect evidence failing closed;
- refusal to apply this recovery contract to a different operation.

## Provenance

Implementation provenance: **REIMPLEMENT** from `docs/EXECUTION-ENGINE-J0-J1.md` sections 19–22 and the repository's frozen Product Vision. No third-party implementation code is copied or adapted.
