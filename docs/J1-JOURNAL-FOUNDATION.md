# J1 execution journal foundation

This document describes the first bounded implementation slice of J1. The authoritative J1 contract remains `docs/EXECUTION-ENGINE-J0-J1.md`; this file records what the foundation implementation does and, equally importantly, what it does not yet claim.

## Scope of this slice

The foundation introduces:

- immutable execution / contract / plan identity;
- an `ExecutionJournal` abstraction;
- one durable filesystem-backed journal for the isolated J1 controlled environment;
- persistent multidimensional state shapes for execution status, step status, effect knowledge, cumulative-budget accounting and contextual verification evidence;
- optimistic revision checks for journal updates;
- focused restart, immutability, stale-write and corruption tests.

It does **not** yet implement the J1 execution state machine, effect dispatch, cumulative-budget enforcement, authorization re-check, recovery decisions or the synthetic crash-injection scenario. Those remain later committed J1 slices.

## Immutable definition

`ExecutionPlanDefinition` persists the identity that must not change after execution begins:

```text
executionId
executionContractVersion
planId
planVersion
applicationId (optional)
exact normalized target
principalId
mandateVersion
ordered step definitions
budget limits
critical property definitions
```

Re-initializing the same `executionId` with the byte-order-independent equivalent definition is idempotent. Reusing it with a different plan/contract definition fails with `ExecutionDefinitionConflictError`; callers must create a new execution/plan version instead.

The journal accepts a target identifier as part of this trusted internal definition. Callers must provide the already-resolved/normalized non-secret target identifier, never a raw resource URL, LinkKey-bearing URL or other secret-bearing locator. Target normalization remains the responsibility of the future execution-engine boundary in this foundation slice.

## Persisted state model

Each journal record contains:

- execution status: `PLANNED | RUNNING | SUSPENDED | COMPLETED`;
- one state entry for every immutable plan step, preserving exact order and IDs;
- per-step effect knowledge: `NOT_DISPATCHED | CONFIRMED | PARTIALLY_CONFIRMED | UNCERTAIN`;
- bounded confirmed-effect evidence containing only stable IDs and confirmed item counts;
- reserved/consumed counters for exactly the budget dimensions declared by the immutable plan;
- contextual verification evidence tied to an immutable property, execution ID, plan version and principal;
- monotonic journal revision plus creation/update timestamps.

This shape is intentionally multidimensional. It does not collapse execution/effect/verification knowledge into one `success` Boolean.

The foundation validates persisted enum values, stable effect identifiers, exact step/budget dimensions and evidence identity links. Corrupt or unsupported persisted state fails closed with `ExecutionJournalCorruptError`.

## Filesystem durability contract

`FileExecutionJournal` is deliberately a **controlled-environment** implementation, not a production persistence decision.

For each execution it stores one JSON file under a caller-supplied private journal directory. The execution ID is base64url-encoded before becoming a filename. Writes use a mode-`0600` temporary file, `fsync`, atomic publish/replace and directory `fsync` before the operation is reported complete.

Initial creation uses an atomic non-overwriting publish. Mutations use revisioned compare-and-set semantics. Mutations for one execution are serialized inside one process so two callers using the same journal instance and same expected revision cannot both succeed.

Exact limitation: the filesystem implementation assumes **one active writer process per journal directory**. It is not a distributed lock and does not claim safe multi-process/multi-host writers. J1 needs only one durable implementation for the isolated controlled scenario; choosing production persistence remains outside this slice and does not pre-empt the separate C5 persistence/encryption human decisions.

## Data-minimization boundary

The journal schema contains execution metadata, stable effect IDs/counts and evidence references/metadata. It does not provide a generic field for arbitrary Grist response bodies, cell contents, bearer/OAuth credentials or Grist API keys.

Callers must not place secrets or unnecessary business payloads into free textual identity/precondition/evidence fields merely for convenience. Future execution-engine APIs should continue to narrow those inputs as their semantics become executable rather than descriptive.

## Deliberately deferred J1 behavior

The following are **not** guarantees of this foundation and remain committed J1 work:

1. legal transition rules between `PENDING`, `RUNNING`, effect-recorded, verified and suspended states;
2. durable write-ahead `RUNNING` before effect dispatch;
3. restart rule that turns an unresolved persisted `RUNNING` effect into `UNCERTAIN` unless capability evidence proves otherwise;
4. cumulative budget reservation/enforcement against immutable limits;
5. current authorization/mandate re-check before each new or resumed effect;
6. capability-specific reconciliation and suspension instead of blind replay;
7. the deterministic synthetic transformation and required crash/fault injection matrix.

Those behaviors must build on this journal contract rather than infer process state from conversation memory.

## Provenance

Implementation provenance: **REIMPLEMENT** from this repository's frozen J1 specification. No third-party implementation code is copied or adapted in this slice, so no new licensing implication is introduced.
