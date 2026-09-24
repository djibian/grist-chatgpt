# J1 write-ahead lifecycle and cumulative-budget slice

Status: **implementation contract through the cumulative per-plan budget slice**.

This document records the executable lifecycle boundary implemented on top of the durable `ExecutionJournal` foundation. The authoritative J1 target remains `docs/EXECUTION-ENGINE-J0-J1.md`; `docs/ROADMAP.md` remains authoritative for tranche selection and integration status.

## Guarantees implemented through this slice

`ExecutionLifecycle.prepareEffect()` establishes the durable write-ahead prerequisite for an effectful step and couples it to cumulative per-plan budget reservation:

1. the execution and step are loaded from the durable journal;
2. the step must still be `PENDING` and every prior step must be `VERIFIED`;
3. the immutable plan must contain a bounded, non-secret `effectIntent` identity for the exact accepted effect;
4. when plan budgets are configured, each effectful step must carry a non-empty immutable `budgetCost` using only declared budget dimensions;
5. no other step may already be `RUNNING` through the lifecycle path;
6. for every charged dimension, cumulative `consumed + reserved + requested` must remain within the immutable plan limit;
7. the journal is durably advanced in one compare-and-set transition to execution `RUNNING` / step `RUNNING`, with the exact immutable effect identity retained in `preparedEffect` and the exact step cost added to durable reservations before any external dispatch can occur.

The intent identity contains a stable `intentId` plus a bounded `fingerprint`. It exists to distinguish the exact target/arguments accepted into the plan without persisting the business payload itself. Callers must not derive the fingerprint from secret material whose disclosure through an offline guess would be unsafe. The journal validates that a durable `preparedEffect` is exactly the immutable plan intent and rejects a forged/mismatched identity.

Budget accounting is derived from immutable step costs plus durable step/effect state and is validated on every journal update. A caller therefore cannot forge a lower reserved/consumed total through direct mutable-state writes. The budget is cumulative across steps: splitting otherwise valid work across multiple steps cannot exceed the accepted per-plan limit.

That durable marker and reservation are **necessary but not sufficient authorization to dispatch**. This slice still has no effect dispatcher. A future coordinator must enforce the frozen preconditions and re-check the current authorization/mandate for the exact principal and target before any external effect is invoked.

`ExecutionLifecycle.recordEffect()` durably records effect knowledge only for a `RUNNING` step that still carries its durable prepared-effect identity. Budget settlement is conservative:

- `APPLIED` consumes the full accepted step cost;
- `PARTIALLY_APPLIED` consumes the full accepted step cost and suspends;
- proven `NOT_APPLIED` releases the reservation without consuming it;
- `UNCERTAIN` retains the reservation and suspends, so ambiguity cannot silently restore capacity;
- compensation does not refund budget already consumed by an attempted effect.

`ExecutionLifecycle.recoverAfterRestart()` applies the J1 pessimistic restart rule: every durable `RUNNING` step without persisted result knowledge becomes `UNCERTAIN`, its step becomes `SUSPENDED`, and the execution becomes `SUSPENDED`. The exact prepared-effect identity, confirmed-effect evidence and budget reservation are retained for later capability-specific reconciliation.

If effect knowledge was durably recorded before interruption, restart does not rewrite it. All lifecycle mutations continue to use the journal's compare-and-set revision protection.

## Deliberate limitations

This implementation does **not** yet implement or claim:

- frozen-precondition execution as part of a dispatcher;
- authorization/mandate re-check before each new or resumed external effect;
- verification-evidence transitions;
- capability-specific reconciliation, compensation or resume decisions;
- a Grist effect dispatcher or integration with the existing public mutation surface;
- the deterministic synthetic J1 end-to-end transformation or crash matrix;
- a production multi-writer journal.

Those remain committed J1 work only where `docs/ROADMAP.md` currently lists them as remaining.

## Important caller contract

The lifecycle deliberately does not accept an effect callback. `prepareEffect()` persists the write-ahead barrier, the exact non-secret effect identity and the cumulative budget reservation; it does **not** grant permission to invoke an external effect. Until the precondition and current-authority checks are integrated into the contractual coordinator, callers must not treat its return value as dispatch authorization.

A crash after the durable `RUNNING` record but before actual dispatch is intentionally indistinguishable from a crash after dispatch but before result persistence. On restart both become `UNCERTAIN` unless a later capability-specific reconciliation mechanism can prove otherwise. The retained `preparedEffect` identifies the intended effect in doubt and the retained reservation prevents ambiguous work from regaining budget capacity; neither asserts that the effect happened. This is conservative by design and prevents blind replay.
