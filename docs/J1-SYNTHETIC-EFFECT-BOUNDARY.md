# J1 synthetic `update_records` effect boundary

Status: **review-required implementation sub-slice**.

This slice wires the already-integrated J1 authority gate, cumulative budget enforcement and write-ahead lifecycle into one bounded execution boundary for the first isolated synthetic `update_records` scenario.

It is intentionally not a generic Grist dispatcher.

## Boundary sequence

For one immutable `update_records` step, `SyntheticUpdateRecordsEffectBoundary.execute()` performs:

1. load the immutable execution/plan identity and exact step;
2. resolve a fresh current-state observation through a trusted synthetic precondition observer;
3. require an exact match with the frozen `precondition.current` state token;
4. re-resolve current principal/mandate/target/capability authority through `ExecutionAuthorityGate`;
5. call `ExecutionLifecycle.prepareEffect()`, which re-loads the journal, enforces prior-step ordering and cumulative plan budget, and durably records the `RUNNING` prepared-effect identity before dispatch;
6. invoke a preconfigured synthetic `update_records` adapter using only immutable execution/effect identity plus the durable journal revision;
7. durably record returned effect knowledge through `ExecutionLifecycle.recordEffect()`.

A concurrent journal transition between the earlier observations and write-ahead cannot silently dispatch from the stale snapshot: `prepareEffect()` re-loads and CAS-publishes the durable transition before the dispatcher is invoked.

## Current precondition guarantee

The precondition observer does not return a Boolean decision. It returns the current canonical token for the exact synthetic target, and the engine compares that token with the immutable `precondition.current` token accepted in the plan.

This proves only the **isolated/coordinated J1 environment** contract. It is not a general protected multi-writer concurrency mechanism. In particular, `update_records` remains overwrite-sensitive for direct contractual execution outside an effectively isolated mode, as documented by `concurrencyGuard.ts`.

The first J1 fixture must therefore keep this target effectively isolated while an effect attempt crosses this boundary. Any later production/generalized capability needs its own proven concurrency contract.

## Authority

Authority is re-resolved on every call through the already-integrated `ExecutionAuthorityGate`; no positive authorization result is cached by this boundary.

A denied/revoked attempt is rejected before the write-ahead transition and before dispatch. A later attempt performs the authority lookup again.

## Response loss / crash behavior

The dispatcher is called only after the durable `RUNNING` record exists.

If the dispatcher throws, the boundary intentionally does **not** write `NOT_APPLIED`: the upstream effect may have occurred before the response was lost. The durable step remains `RUNNING` with its prepared effect and reserved budget. Existing restart recovery then converts that unresolved state to `SUSPENDED` / `UNCERTAIN`, preserving the exact evidence needed by capability-specific reconciliation.

This preserves the J1 rule that response loss is never treated as proof of no effect.

## Dispatcher contract

The dispatcher is a controlled test/environment adapter, not a model-facing operation. Its request contains only:

- immutable execution/plan/principal/mandate/target identity;
- exact step ID and fixed operation `update_records`;
- immutable capability and effect-intent identity;
- durable journal revision created by write-ahead.

It receives no arbitrary Grist endpoint, UserAction, HTTP destination or free-form model payload.

For this first scenario its returned effect knowledge is restricted to `APPLIED`, `PARTIALLY_APPLIED` or `UNCERTAIN`; durable validation remains delegated to the existing execution lifecycle/journal.

## Scope boundaries

This slice does **not**:

- expose a new public tool or scope;
- generalize dispatch to arbitrary Grist operations;
- claim protected multi-writer concurrency;
- implement capability-specific uncertain-state reconciliation (separate slice);
- implement verification completion (separate slice);
- implement compensation;
- select credential persistence, encryption, OAuth provider or production authorization storage;
- make the controlled filesystem journal a production persistence choice.

## Evidence

Focused tests prove:

- exact frozen precondition and current authority are checked before write-ahead/dispatch;
- the dispatcher can observe the durable `RUNNING` prepared-effect state and budget reservation before any external effect;
- stale/current-state mismatch prevents authority lookup, reservation and dispatch;
- authority is re-resolved on later attempts and denial never dispatches;
- cumulative budget admission happens before dispatch;
- simulated response loss leaves durable `RUNNING`, and restart becomes `SUSPENDED` / `UNCERTAIN` with the reservation retained;
- successful dispatch records confirmed effects and settles budget consumption.

## Provenance

Implementation provenance: **REIMPLEMENT** from `docs/EXECUTION-ENGINE-J0-J1.md` §§15–22 and the repository's frozen Product Vision. No third-party implementation code is copied or adapted.
