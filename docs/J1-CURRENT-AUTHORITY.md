# J1 current authority re-check slice

Status: **review-required implementation sub-slice**.

This slice provides the bounded point-in-time authority boundary required by J1 §17 without choosing a production mandate store, Grist credential persistence design or new public authorization scope.

## Contract

`ExecutionAuthorityGate.assertCurrentAuthority()`:

- loads the current durable execution definition for the exact `executionId` and `stepId`;
- requires the step to carry an immutable effect-intent identity;
- derives execution/contract/plan identity, principal, mandate version, exact target, operation and capability from the immutable plan rather than caller-supplied authority fields;
- asks a trusted runtime `ExecutionAuthorityProvider` for **current** authority on every invocation;
- fails closed when current authority is unavailable, belongs to another principal, names another mandate version or exact target, or lacks the planned capability;
- keeps no positive authorization cache and therefore re-resolves authority after restart.

The provider is deliberately an environment seam. J1 may run in an isolated controlled environment before C5, while a later production binding must obtain current authority from the production identity/mandate path and must not weaken the per-user Grist credential requirements.

## Deliberate non-claims

A successful gate call is **not** a durable dispatch token and is not persisted as reusable authority. Authority can be revoked after any point-in-time check.

This sub-slice therefore does not yet claim the complete J1 §17 exit item by itself. The first J1 coordinator must invoke this gate at every new or capability-approved resumed effect boundary, together with the existing write-ahead/budget rules and the still-required frozen precondition checks. A `SUSPENDED`/`UNCERTAIN` step remains non-replayable merely because authority currently passes.

This slice does not add:

- a generic dispatcher or arbitrary Grist operation surface;
- automatic retry/replay or recovery policy;
- mandate persistence;
- production Grist credential persistence;
- new OAuth/public scopes;
- model-visible authority or credential material.

## Safety properties covered

Focused tests prove that:

- the provider request is constructed from immutable plan identity;
- a later mandate change invalidates an earlier positive result because the provider is called again;
- unavailable, wrong-principal, wrong-target and missing-capability authority fail closed without mutating the journal;
- restart does not preserve a positive authority decision;
- a step without immutable effect intent cannot cross this authority boundary.

## Provenance

Implementation provenance: **REIMPLEMENT** from this repository's frozen J1 specification and Product Vision. No third-party implementation code is copied or adapted.
