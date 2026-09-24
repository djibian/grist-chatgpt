# J1 contextual verification evidence slice

Status: **review-required implementation slice**.

This slice turns the contextual verification vocabulary already persisted by `ExecutionJournal` into a bounded executable API without introducing a global success flag or weakening critical criteria.

## Guarantees added by this slice

`VerificationEvidenceLifecycle.recordEvidence()` records evidence only after a step has durable `EFFECT_RECORDED` knowledge. It:

- accepts a bounded evidence identity plus property-scoped observation;
- requires the property to exist in the immutable plan;
- derives property criticality, execution identity, plan version and principal from that immutable plan rather than trusting caller-supplied identity fields;
- timestamps the observation at the execution boundary;
- appends the evidence to the durable journal and links its ID to the exact step in one compare-and-set transition;
- preserves prior observations instead of overwriting their verdicts;
- makes replay of the same `evidenceId` with the same contextual observation idempotent;
- rejects reuse of an existing `evidenceId` for different content or step linkage.

`latestEvidence()` is a read-only helper over the durable step linkage. It returns the most recently appended observation for one planned property without collapsing the rest of the evidence history.

This design makes a crash after evidence persistence but before the caller receives the result safe to retry: the deterministic evidence identity finds the already durable observation instead of appending a duplicate.

## Deliberate non-claim: step completion

This slice does **not** expose `EFFECT_RECORDED -> VERIFIED` or execution completion.

The current immutable plan defines critical properties globally but does not yet freeze which properties are mandatory evidence for a particular step. Treating a caller-provided subset as sufficient would let a runtime caller weaken verification criteria. Treating one `VERIFIED` observation as global success would collapse the multidimensional evidence model that J1 explicitly requires.

A later contractual slice must freeze the required step/property binding (or an equivalent immutable verification contract) before a step-completion transition can be safely exposed. Until then, contextual evidence remains durable, property-scoped knowledge only.

## Scope boundaries

This slice does not add:

- an effect dispatcher;
- authorization/mandate re-check;
- capability-specific recovery or replay;
- evidence invalidation after dependency changes;
- a generalized planner;
- a generic Grist escape hatch;
- production persistence or multi-writer guarantees.

Those remain governed by `docs/ROADMAP.md` and `docs/EXECUTION-ENGINE-J0-J1.md`.

## Data-minimization boundary

Evidence fields are descriptive metadata, not a generic payload channel. `method`, `targetStateToken` and `dependencies` must identify how/against-what verification was performed without embedding credentials, raw business datasets, LinkKey-bearing URLs or arbitrary Grist response bodies.

## Provenance

Implementation provenance: **REIMPLEMENT** from this repository's frozen J1 specification and Product Vision. No third-party implementation code is copied or adapted.
