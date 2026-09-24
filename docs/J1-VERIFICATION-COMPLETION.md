# J1 verification-completion contract

Status: **review-required implementation sub-slice**.

PR #136 made contextual property evidence durable but deliberately refused to invent a runtime-selected set of properties that would be sufficient to mark a step `VERIFIED`. This slice closes that specific safety gap with a companion immutable verification contract for the controlled J1 environment.

## Frozen requirements

`FileVerificationContractStore` accepts a contract only while the execution journal is still pristine (`revision === 0`, execution `PENDING`, every step `PENDING`, no evidence). The contract:

- repeats the exact immutable execution/plan identity and must match it exactly;
- binds every immutable step exactly once and in plan order;
- requires a non-empty bounded set of existing property IDs for every step;
- rejects duplicate or unknown property IDs;
- requires every plan property marked `CRITICAL` to be required by at least one step;
- is create-once and conflict-detecting: the same execution ID cannot later replace the contract with weaker criteria.

The companion file is part of the accepted J1 plan package even though it is physically separate from the execution journal. Changing its criteria therefore requires a new execution/plan identity; it cannot be changed after execution starts.

## Completion transition

`VerificationCompletionLifecycle.markStepVerified()`:

1. requires the durable step to be `EFFECT_RECORDED` (or returns an already `VERIFIED` step idempotently);
2. loads and revalidates the frozen companion contract against the current immutable execution identity and step set;
3. resolves only evidence IDs durably linked to that exact step;
4. for every required property, uses the latest linked observation rather than accepting any historical positive observation;
5. refuses completion when evidence is missing or the latest verdict is `VIOLATED`, `UNKNOWN` or `NOT_APPLICABLE`;
6. CAS-transitions the step to `VERIFIED` only when every frozen requirement is currently `VERIFIED`;
7. marks the execution `COMPLETED` only when every plan step is `VERIFIED`.

Because every `CRITICAL` plan property must be covered by at least one frozen step requirement, a completed execution cannot silently omit a critical property.

## Scope boundaries

This slice does not:

- dispatch an external effect;
- invent or weaken authority/precondition checks;
- make suspended/uncertain work replayable;
- implement capability-specific recovery;
- choose production persistence or multi-writer semantics;
- expose a generic Grist operation, arbitrary UserAction or public scope.

The filesystem store has the same controlled-environment character as the J1 `FileExecutionJournal`; it is not claimed as a production multi-writer store.

## Evidence

Focused tests cover durable restart, exact immutable binding, critical-property coverage, unknown-property refusal, conflict against later weakening, refusal to freeze criteria after execution starts, latest-verdict semantics, safe `EFFECT_RECORDED -> VERIFIED`, idempotent verified replay and whole-execution completion only after every step verifies.

## Provenance

Implementation provenance: **REIMPLEMENT** from this repository's frozen J1 specification and Product Vision. No third-party implementation code is copied or adapted.
