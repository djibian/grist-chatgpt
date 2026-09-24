# J1 write-ahead lifecycle slice

Status: **implementation slice; pending independent exact-head review before merge**.

This slice builds on the durable `ExecutionJournal` foundation and implements only the first executable lifecycle boundary required by J1.

## Guarantees added by this slice

`ExecutionLifecycle.prepareEffect()` establishes the durable write-ahead prerequisite for an effectful step:

1. the execution and step are loaded from the durable journal;
2. the step must still be `PENDING` and every prior step must be `VERIFIED`;
3. no other step may already be `RUNNING` through the lifecycle path;
4. the journal is durably advanced to execution `RUNNING` / step `RUNNING`.

That durable marker is **necessary but not sufficient authorization to dispatch**. Before J1 has an executable dispatcher, a future coordinator must additionally enforce the frozen preconditions, cumulative plan-budget check/reservation and current authorization/mandate re-check. This slice deliberately leaves dispatch absent so the incomplete pre-effect guard set cannot be mistaken for a safe execution path.

`ExecutionLifecycle.recordEffect()` durably records effect knowledge. `UNCERTAIN` and `PARTIALLY_APPLIED` outcomes suspend the execution immediately; this slice contains no capability-specific automatic replay rule.

`ExecutionLifecycle.recoverAfterRestart()` applies the J1 pessimistic restart rule: every durable `RUNNING` step without a persisted result becomes `UNCERTAIN`, its step becomes `SUSPENDED`, and the execution becomes `SUSPENDED`. Confirmed effect evidence already attached to such a step is retained.

If effect knowledge was durably recorded before interruption, restart does not rewrite it.

All lifecycle mutations still use the journal's compare-and-set revision protection.

## Deliberate limitations

This slice does **not** yet implement or claim:

- cumulative per-plan budget reservation/enforcement;
- authorization/mandate re-check before each new/resumed effect;
- verification-evidence transitions;
- capability-specific reconciliation, compensation or resume decisions;
- a Grist effect dispatcher or integration with the existing public mutation surface;
- the deterministic synthetic J1 end-to-end transformation or crash matrix;
- a production multi-writer journal.

Those remain committed J1 work in `docs/ROADMAP.md`.

## Important caller contract

The lifecycle deliberately does not accept an effect callback. `prepareEffect()` persists one ordering prerequisite only. Until the budget and authority slices are integrated into a coordinator, no caller should treat its return value as permission to invoke an external effect.

A crash after the durable `RUNNING` record but before actual dispatch is intentionally indistinguishable from a crash after dispatch but before result persistence. On restart both become `UNCERTAIN` unless a later capability-specific reconciliation mechanism can prove otherwise. This is conservative by design and prevents blind replay.
