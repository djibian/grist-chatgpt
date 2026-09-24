# J0/J1 execution-engine specification

Status: **target specification; no runtime implementation is implied by this document**.

Baseline audited for this specification: `main` `4582828f637717b5a8414debc9429f800b67104a`.

This document translates the frozen product vision into the first executable contract. J0 stabilizes the current mutation engine. J1 introduces the smallest durable contractual execution path. It deliberately does not implement the higher-level Builder or the stage-tracking business scenario.

## 1. Goals

J0 and J1 establish the minimum trustworthy substrate on which later agentic planning can depend.

The engine must be able to answer, without inventing certainty:

1. what was intended;
2. what authority and budget allowed it;
3. what effect was attempted;
4. which effects are confirmed;
5. which effects are uncertain;
6. which verification properties passed, failed or remain unknown;
7. whether automatic continuation/replay is safe;
8. what evidence is needed to resume.

## 2. Current baseline and concrete gaps

The existing code is retained as the operation substrate.

Useful current properties include:

- named bounded data/schema/UI operations;
- authorization before operations;
- per-principal contexts;
- write batching with `PartialBatchError`;
- creation-result projection that preserves created IDs on successful calls;
- post-write UI re-read verification;
- explicit `write_verification_failed` results;
- bounded audit events.

The audit identified four blocking J0 gaps.

### J0-F1 — ambiguous first failed write is flattened

`GristService.executeBatches()` and `executeBatchesForAcknowledgement()` rethrow the original error when the first batch fails. The MCP result layer then commonly maps an unrecognized transport failure to `operation_failed`.

A request may nevertheless have reached Grist and applied before its response was lost. The result therefore needs an explicit **uncertain effect** state whenever non-application cannot be proven.

### J0-F2 — partial results lose confirmed identities

`PartialBatchError` currently retains counts but not the successful batch results. For create operations this discards the confirmed created record IDs that are required for precise recovery.

Confirmed results must survive later batch failure.

### J0-F3 — post-write verification does not protect concurrent human work

Several UI operations perform read -> derive complete replacement value -> write -> re-read. Re-reading can prove the resulting value equals the bridge's expected value, but cannot prove that an intervening human modification was not overwritten.

Contractual execution must never claim concurrent-change preservation unless an effective protection exists.

### J0-F4 — unresolved document URLs may leak secrets to audit

`AuthorizedGristService.execute()` initializes the audit document target with the raw `documentIdOrUrl`. If authorization rejects before replacing it with a normalized document ID, an error audit event may contain the original URL, including LinkKey-like query parameters.

Audit must contain only normalized safe resource identifiers.

## 3. Terminology

### Execution status

```text
PENDING
RUNNING
SUSPENDED
COMPLETED
```

### Effect state

```text
NOT_APPLIED
PARTIALLY_APPLIED
APPLIED
UNCERTAIN
COMPENSATED
```

### Verification verdict

```text
VERIFIED
VIOLATED
UNKNOWN
NOT_APPLICABLE
```

These dimensions are independent. Do not collapse them into one enum.

### Step

A `Step` is one effectful or verification unit in an immutable execution plan.

Every step has a stable `stepId` within its plan.

### Confirmed effect

An effect is confirmed only when the engine has positive evidence sufficient for that capability's effect contract.

For example, a successful create response normalized to record IDs can confirm those created IDs. A timed-out request does not.

### Uncertain effect

An effect is `UNCERTAIN` when an upstream call may have produced an effect but the engine cannot prove either application or non-application.

`UNCERTAIN` is not an error-message synonym. It is durable knowledge about effect state.

## 4. J0 scope

J0 changes the current execution semantics only as needed to make mutation outcomes safe inputs for a future orchestrator.

J0 does **not** yet provide:

- a general multi-step Builder plan language;
- durable scheduled jobs;
- business contracts;
- ACL/LinkKey maintenance;
- a universal conflict-control mechanism;
- production multi-user credential storage.

## 5. J0 result contract

### 5.1 Mutation outcome envelope

Every mutation path entering the new execution semantics must be representable internally by an outcome containing at least:

```text
operation
executionStatus
effectState
confirmedEffects[]
uncertainEffect? 
remainingEffects[] or remainingCount
retryWholeOperation
recoveryHint
```

The exact public MCP schema may remain operation-specific in J0, but no public result may erase information required to recover safely.

### 5.2 Confirmed effects

Confirmed effects retain stable identifiers whenever the upstream operation provides them.

For `create_records`, confirmed effects include the created record IDs for each successful batch.

For update/delete operations whose target IDs are known before execution, confirmed effects retain the exact target IDs of batches positively acknowledged as successful.

Counters may be added for convenience but are never a substitute for those identifiers.

### 5.3 Uncertain batch

When batch N is sent and its effect cannot be determined, the outcome records:

```text
confirmed batches before N
confirmed stable identifiers/results
uncertain batch index N
uncertain intended targets/payload identity sufficient for recovery
not-yet-started batches after N
```

The original secret/business payload does not need to be copied into model-visible errors. Durable internal recovery data and public minimized output are separate concerns.

### 5.4 First-batch uncertainty

A first-batch transport ambiguity must produce the same `UNCERTAIN` semantics as a later uncertain batch, with zero confirmed prior effects.

It must not degrade to generic `operation_failed` merely because there was no earlier completed batch.

## 6. Upstream-error classification

The implementation must classify failures according to what can be known about effect application.

Minimum rule:

> If the engine cannot prove that an effect was not applied, it must not report `NOT_APPLIED`.

Examples:

- local input validation before dispatch -> `NOT_APPLIED`;
- authorization rejection before dispatch -> `NOT_APPLIED`;
- connection/setup failure proven before request dispatch -> `NOT_APPLIED` if the transport can prove that fact;
- timeout, reset or lost response after possible dispatch -> `UNCERTAIN`;
- upstream error responses are classified according to documented endpoint semantics; if the endpoint cannot prove no effect, use `UNCERTAIN` rather than guessing.

The Grist client boundary should expose enough structured transport/effect knowledge for service code to make this classification without parsing human-readable error strings.

## 7. J0 error/public result vocabulary

The MCP result layer must distinguish at least:

```text
partial_write
uncertain_write
write_verification_failed
grist_upstream
operation_failed
```

`uncertain_write` means replay is forbidden until reconciliation establishes what happened.

`partial_write` includes confirmed prior results and may also identify an uncertain failed batch when appropriate.

`operation_failed` is reserved for failures where effect ambiguity is not the material issue.

## 8. J0 concurrency contract

### 8.1 No false guarantee

Post-write equality does not prove preservation of concurrent human changes.

Operations must declare their concurrency protection for contractual use, for example:

```text
PROTECTED
ISOLATED
UNPROTECTED
```

The names may change in implementation; the distinction may not.

### 8.2 J0 acceptance rule

For a mutation that can overwrite state read earlier:

> The contractual mode must have an effective tested protection, or it must refuse the mutation in that mode.

A narrower operation that changes only an explicitly targeted field without overwriting untargeted state may have a different concurrency risk from an operation that read-modify-writes a complete options object.

### 8.3 Current UI read-modify-write operations

`update_page_widget` custom-widget/grid option changes and comparable complete-value rewrites must be treated as concurrent-overwrite-sensitive.

J0 implementation must either:

1. introduce an effective condition/revision protection supported by the actual Grist path; or
2. mark the capability unavailable for protected contractual execution and require an isolated/coordinated execution mode.

An immediate extra re-read before writing may narrow a race window but is not sufficient by itself to claim `PROTECTED`.

### 8.4 Legacy compatibility surface

J0 may preserve existing public operations for compatibility while the contractual engine is introduced, but documentation must not claim that a legacy path provides guarantees it does not provide.

Once a capability is declared part of the contractual Builder surface, every model-visible route to that capability must pass the same engine controls.

## 9. J0 audit contract

### 9.1 Safe resource target

Audit events may include a normalized authorized Grist document ID after successful resolution.

Before successful resolution, the raw `documentIdOrUrl` must not be copied to audit.

If useful, record only a non-secret classification such as `targetResolution: "failed"`.

### 9.2 Secret prohibition

Audit never records:

- query strings from document URLs;
- LinkKeys;
- API/OAuth/bearer tokens;
- webhook secrets;
- encryption keys;
- full row payloads.

### 9.3 Outcome awareness

Mutation audit must eventually distinguish ordinary failure, partial confirmed effect and uncertain effect. J0 must at minimum avoid recording an uncertain effect simply as a clean no-effect error.

## 10. J0 tests required

J0 is not complete until automated tests reproduce the four audit findings and prove the corrected behavior.

### T0 — first batch response lost

Given a simulated write whose upstream effect may have occurred but whose first response is lost:

- public/domain result is `UNCERTAIN` / `uncertain_write`;
- zero prior effects are falsely claimed;
- `retryWholeOperation` is false;
- audit contains no secret payload.

### T1 — later batch uncertain after confirmed create

Given batch 1 returns created record IDs 701 and 702 and batch 2 becomes uncertain:

- IDs 701 and 702 remain present in confirmed effects;
- batch 2 is explicitly uncertain;
- later batches are identifiable as not started;
- whole-operation replay is false.

### T2 — concurrent human UI modification

Inject a human/independent modification between the operation's observation and write.

The supported protected mode must either:

- detect/prevent the overwrite; or
- refuse execution because adequate protection is unavailable.

A test that merely proves the bridge's value wins after overwriting the human change does not pass.

### T3 — secret-bearing document URL rejected

Pass a rejected document URL containing a synthetic LinkKey/query secret.

- no audit event contains the original URL or synthetic secret;
- no model-visible result echoes it unless explicitly required and separately scrubbed.

## 11. J0 exit criteria

J0 is complete only when:

- T0-T3 pass;
- uncertain first writes are structurally distinguishable from proven no-effect failure;
- successful earlier batch results survive later failure/uncertainty;
- supported contractual concurrency claims are backed by an effective tested mechanism, otherwise the capability refuses that mode;
- rejected raw resource URLs cannot leak query secrets into audit;
- existing non-replay safety is preserved;
- public/runtime documentation states the exact guarantee boundaries.

J0 runtime changes are review-required under `AGENTS.md`.

## 12. J1 scope — first contractual transformation

J1 adds the smallest durable execution contract around existing bounded operations. It is intentionally not yet the full Builder.

The purpose is to prove that a multi-step transformation can survive interruption without losing authoritative knowledge about what has happened.

## 13. Immutable plan and contract identity

An execution has immutable identifiers for:

```text
executionId
executionContractVersion
planId / planVersion
applicationId or exact target
principal
mandateVersion
```

After execution begins, changing steps, critical criteria, budgets or authority creates a new contract/plan version. Existing journal entries remain attached to the version actually executed.

A content hash may be used as an additional integrity mechanism, but identifier design is an implementation choice as long as immutability is demonstrable.

## 14. J1 persistent journal semantics

J1 introduces an `ExecutionJournal` abstraction with a durable implementation suitable for the controlled J1 environment.

The specification intentionally does not choose the storage technology here.

The journal must survive process restart and must record at least:

- execution/plan/contract identity;
- exact target and principal identity reference;
- step order and step IDs;
- intended capability/operation;
- preconditions and relevant expected state tokens;
- budget reservations/consumption needed for correct continuation;
- pre-effect step record;
- confirmed effects including stable IDs;
- uncertain effects;
- verification evidence references;
- suspension/completion status.

Secrets and unnecessary business payloads are not journaled merely for convenience.

## 15. Write-ahead rule

Before an effectful call:

1. validate current mandate/preconditions/budget;
2. durably mark the step `RUNNING` with its intended effect identity;
3. only then dispatch the effect;
4. durably record the resulting effect knowledge;
5. perform required verification;
6. durably record the verification verdict.

If the process restarts and a step is found `RUNNING` without a recorded result, its effect state is treated as `UNCERTAIN` unless capability-specific evidence proves otherwise.

## 16. J1 budget semantics

J1 proves at least cumulative **per-plan** budgeting in addition to current per-operation limits.

A plan cannot exceed its accepted budget by splitting work across steps.

Budget dimensions implemented in J1 should be the minimum needed by the first contractual scenario. The model must make adding later dimensions possible without changing the meaning of existing journal evidence.

## 17. J1 authority and revocation

Before each effectful step, the engine re-validates that the principal still holds the required authorization/mandate for the exact target.

J1 need not implement long-running scheduled revocation infrastructure, but it must not cache one initial authorization and blindly use it for all later effects after restart.

## 18. J1 verification evidence

Verification records are contextualized by property rather than represented as a global Boolean.

Minimum evidence metadata:

```text
propertyId
criticality
verdict
executionId / planVersion
target state/revision marker when observable
principal/identity used
verification method
timestamp
dependencies or evidence inputs sufficient for later invalidation
```

J1 may support only a small set of properties, but must use the final evidence model rather than a temporary global `success=true` flag.

## 19. J1 first transformation

The first J1 scenario should be deliberately small and synthetic. It exists to prove execution semantics, not business intelligence.

Recommended shape:

1. inspect a synthetic Grist fixture;
2. apply one or more bounded existing mutations whose targets are deterministic;
3. verify the requested postconditions;
4. inject a process/response failure at a defined point;
5. restart from the durable journal;
6. reconcile uncertain state using only capability-supported evidence;
7. either continue safely or suspend explicitly;
8. re-run the already completed intent and demonstrate no duplicate effect when the capability contract supports that conclusion.

The exact Grist mutation chosen should maximize test determinism and minimize unrelated UI/ACL complexity.

## 20. J1 recovery rule

Recovery is capability-specific.

The engine never applies this rule:

```text
if step failed then replay step
```

Instead:

```text
read journal effect knowledge
+ capability idempotence/reconciliation contract
+ current observable state
-> retry | continue | compensate | verify | suspend
```

If two states are observationally indistinguishable and replay could duplicate/destruct data, the required outcome is `SUSPENDED` with evidence for human reconciliation.

## 21. J1 crash-injection tests

At minimum test interruption:

- before an effect is dispatched;
- after the durable pre-effect record but before dispatch;
- after upstream effect but before result persistence;
- after result persistence but before verification;
- during verification.

The restart path must derive its next action from durable evidence, never from conversation memory or process-local variables.

## 22. J1 exit criteria

J1 is complete when one bounded synthetic transformation demonstrates all of the following:

- immutable execution/plan/contract identity;
- persistent write-ahead journal;
- cumulative plan budget enforcement;
- authorization re-check before resumed/new effects;
- multidimensional execution/effect/verification state;
- confirmed partial results retained;
- crash after effect/before result becomes `UNCERTAIN`, not presumed absent;
- recovery uses capability-specific idempotence/reconciliation rules;
- unsafe ambiguity suspends rather than replays;
- contextual verification evidence is durable;
- repeating the already satisfied contractual intent produces no duplicate effect where its capability contract supports convergence;
- no new generic Grist escape hatch is introduced.

## 23. Dependencies and non-dependencies

J0/J1 may be developed against an isolated synthetic environment before C5.

They do **not** make the system ready for real multi-user production.

Production multi-user use still depends on the authoritative C4/C5/C6 program, especially per-user Grist credentials and production hardening.

J1 is a prerequisite for the first business-level Builder scenario (`BehavioralContract` for stage tracking). The stage scenario must not invent separate execution/recovery semantics.

## 24. Deliberately deferred from J0/J1

- full three-way application reconciliation engine;
- generalized ManagedScope persistence;
- complete ImpactGraph;
- LinkKey/ACL authoring;
- browser-based LinkKey verification;
- document creation/copy/import breadth;
- custom widget generation;
- GitHub deployment orchestration;
- scheduled durable lifecycle jobs;
- upstream Grist maintenance automation.

Those capabilities build on the execution semantics proven here rather than redefining them.
