# Stage-tracking BehavioralContract

Status: **accepted follow-up semantics; partially observed reference binding; critical access/UI evidence pending**.

Purpose: define the first end-to-end business scenario that the future Builder must satisfy after J0/J1 execution semantics exist.

This contract deliberately uses **logical identities** rather than assuming current Grist table/column IDs. Before J2 implementation, a fixture/application binding must map these logical identities to the exact tested Grist document and record any unresolved semantics.

## 1. Scenario objective

Starting from the existing stage-tracking application, make the call/visit contact date available within the Stage follow-up trace, while preserving:

- existing Stage/Student/Teacher/Period business data and current follow-up fields;
- legitimate human changes;
- the application's LinkKey-based teacher isolation;
- the existing teacher-facing follow-up flow;
- safe interruption/recovery semantics inherited from J0/J1.

The reference document “suivi des stages chatgpt” has already received a `Date_du_contact` column through direct maintenance. That manual edit is fixture state, **not** evidence that J2 has built or executed a safe cross-cutting Builder transformation. A controlled J2 fixture/run must still prove schema, access, UI, human-change preservation, concurrency and recovery as applicable. This scenario must not hardcode stage tracking into the generic product.

## 2. Contract authority

Business semantics accepted by the user are recorded in [J2 accepted semantics](J2-STAGE-TRACKING-ACCEPTED-SEMANTICS.md). Observed physical facts and unverified ACL/UI bindings are recorded in [J2 reference binding](J2-STAGE-TRACKING-REFERENCE-BINDING.md).

Each property is classified as:

- **ACCEPTED BASELINE** — accepted behavior and product invariants;
- **OBSERVED BINDING** — a fact read from the current fixture, not a universal Grist model;
- **UNKNOWN** — a required fact or outcome that still needs direct evidence.

The Builder cannot turn an `UNKNOWN` into an accepted policy on its own. The exact accepted contract version remains immutable for a J2 run.

## 3. Logical application identities

Actors: `ApplicationOwner`, `Teacher`, `AnonymousOrInvalidLinkVisitor`, and `BuilderPrincipal`. The privileged BuilderPrincipal cannot stand in for a teacher in LinkKey access tests.

Existing logical entities: `Student`, `Stage`, `Teacher`, `Period`.

The J2 follow-up trace is **part of Stage**, not a separate logical/physical Visit record. The trace has a contact type (call/visit), actual contact date, implication, punctuality and comments. The contact date is distinct from placement start/end dates. One Stage currently holds one editable set of follow-up values; no independent per-contact history is established.

On the reference fixture the observed columns are `Stages.Type_de_contact`, `Stages.Date_du_contact`, `Stages.Implication`, `Stages.Ponctuel`, `Stages.Commentaire`. These IDs are binding facts only. The optionality of historical rows must be preserved; J2 must not invent dates.

`Stages.Suivi_par` is the teacher **assigned** to conduct the call/visit. It is not the identity of the author or last editor. No author identity is proven by the observed Stage schema. A separate author audit or multiple contacts require a distinct accepted decision.

## 4. Responsibility predicate

`responsible(T, S)` means the current assignment: Stage S references teacher T in the observed `Stages.Suivi_par` relation.

This establishes business responsibility, not effective browser authorization by itself. The owner reports that a teacher-specific URL from `Enseignants` passes a LinkKey and that Grist ACLs restrict the teacher's adapted interface to assigned Stages. The exact LinkKey attribute, rule source and negative/reassignment behavior still require controlled observation. The Builder must bind the predicate to each tested application's real model and must not invent another responsibility relation merely for the test.

## 5. Managed scope

Proposed scope for the controlled J2 transformation; exact targets require a pre-run binding and accepted plan:

| Property | Mode | Rationale |
|---|---|---|
| required contact-date field and any narrowly targeted follow-up schema delta | `MANAGED` | explicit Builder change in an isolated fixture |
| exact access rule change, only if the bound policy needs it | `MANAGED` | preserve current-responsibility isolation |
| exact teacher-facing UI element needed to expose the date | `MANAGED` or `SHARED`, as accepted | prevent unintended layout overwrite |
| other existing Stage/Student/Teacher/Period schema | `OBSERVED` | preserve unrelated structure |
| business rows, including old follow-up traces | `OBSERVED` | business evolution is not configuration drift |
| human-maintained page layout | `SHARED` | reconcile/preserve unrelated edits |
| untargeted widgets and integrations | `OBSERVED` or `SHARED` after dependency analysis | no silent rewrite |

The J2 plan must not silently broaden `MANAGED` scope or recreate the already present date field on the live reference. A repeat run on unchanged managed state must converge without duplicate structural objects.

## 6. Criticality vocabulary

### CRITICAL

A failure or unknown verdict blocks delivery of the J2 change when the property is impacted.

### IMPORTANT

A violation blocks normal delivery; an `UNKNOWN` may permit only an explicitly degraded/test-only result if the accepted contract allows it.

### INFORMATIONAL

May be delivered with notice if unrelated to safety/correctness of the requested change.

The Builder cannot downgrade criticality by itself.

## 7. Business behavioral properties

### STAGE-B1 — follow-up belongs to its Stage

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A call or visit trace is recorded in the existing Stage row. Changing or clearing a trace must not orphan, delete or duplicate that Stage.

### STAGE-B2 — responsible teacher can record a contact

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

For `responsible(T, S)`, the supported teacher-facing path must allow T to enter, correct and clear the authorized Stage follow-up fields: contact type (`Appel`/`Visite`), contact date, implication, punctuality and comments. A completed new contact records its actual date; historic blank dates are not fabricated. This must be proven through the supported LinkKey/browser path when that policy applies.

### STAGE-B3 — other teachers cannot access protected follow-up

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A teacher not currently responsible for Stage S cannot read or edit S's protected follow-up data through the teacher-facing path. The exact protected fields and valid identity mapping are determined by the observed AccessModel, not by owner API calls.

### STAGE-B4 — invalid LinkKey follows accepted denial

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A missing/invalid LinkKey must not expose protected Stage follow-up data.

### STAGE-B5 — revoked LinkKey loses access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A revoked key cannot retain protected access previously granted by that key.

### STAGE-B6 — relation tampering cannot broaden access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A teacher cannot acquire another protected Stage's follow-up by changing `Suivi_par` or another writable relation, or by crafting requests available through the application.

### STAGE-B7 — transformation preserves business records

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

The J2 transformation must not delete, duplicate or rewrite existing Stage, Student, Teacher, Period or follow-up records except for a migration explicitly listed in the accepted plan. Compare stable identities where possible; counts alone are insufficient.

### STAGE-B8 — repeat transformation is convergent

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

Re-running the same accepted intent against unchanged managed state does not duplicate a contact-date field, access rule, UI widget, Stage row or follow-up trace.

### STAGE-B9 — new periods do not duplicate stages

**Criticality:** IMPORTANT, CRITICAL if period generation is touched.  
**Authority:** ACCEPTED baseline business example.

If period/stage generation is outside the confirmed impact graph, it need not block the follow-up change. If affected, verify against the existing application rule.

### STAGE-B10 — reassignment preserves traces and revokes former access

**Criticality:** CRITICAL if reassignment/access logic is affected; otherwise IMPORTANT regression property.  
**Authority:** ACCEPTED BASELINE.

Changing `Suivi_par` from A to B preserves the Stage's follow-up trace. A immediately loses responsibility-derived protected access; B gains only the access allowed by the accepted current-responsibility policy. Former assignment alone confers no historical access.

## 8. AccessModel properties

### STAGE-A1 — follow-up remains in the protected domain

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

The contact date and trace fields in `Stages` must follow the observed teacher LinkKey isolation. Adding or exposing a field must not bypass the protected Stage policy.

### STAGE-A2 — protected intermediate states are forbidden

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

The transformation cannot expose protected follow-up data in an intermediate schema/UI/access state. If in-place Grist primitives cannot establish the safety guarantee, use an effectively isolated preparation path or refuse that mode.

### STAGE-A3 — builder privilege is not user-policy proof

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

Successful owner/Builder API calls do not prove teacher access restrictions.

### STAGE-A4 — browser verification is required

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

When the effective policy depends on the Grist web client's `user.LinkKey`, controlled browser scenarios with valid, invalid, revoked and reassigned identities are required. Schema/API observations alone cannot establish those verdicts.

## 9. UI behavioral properties

### STAGE-U1 — teacher can reach the follow-up date

**Criticality:** IMPORTANT for reachability; CRITICAL if its absence prevents an impacted access or business requirement.  
**Authority:** ACCEPTED BASELINE.

The assigned teacher can reach the existing “Suivi des stages” flow and see/edit the authorized follow-up trace, including the actual contact date. The owner reports that the date was added to the follow-up sheet. This does not prove that the assigned teacher sees or can edit it through the actual LinkKey URL.

### STAGE-U2 — unrelated human layout changes are preserved

**Criticality:** IMPORTANT  
**Authority:** fixed product vision.

If a human changes a `SHARED` layout after the Builder's last accepted state, J2 preserves or reconciles that change, or suspends under the accepted conflict policy rather than silently restoring old layout.

### STAGE-U3 — managed UI converges

**Criticality:** IMPORTANT  
**Authority:** fixed product vision.

Reapplying the accepted UI intent to unchanged managed state creates no duplicate fields, widgets or pages.

## 10. Concurrency properties

### STAGE-C1 — concurrent human change is never silently overwritten under a protected claim

**Criticality:** CRITICAL for any J2 step whose mutation can overwrite that human state.  
**Authority:** fixed product vision.

Inject an independent human modification between observation and the candidate write.

The J2-supported mode must either:

- protect/detect the conflict with an effective mechanism; or
- refuse/suspend the mutation and require an isolated/coordinated mode.

A final state equal to the Builder's intended value after overwriting the human change is a failing test, not successful verification.

## 11. Recovery properties inherited from J1

### STAGE-R1 — durable pre-effect intent

Every effectful J2 step uses the J1 journal-before-effect semantics.

### STAGE-R2 — uncertain effects remain uncertain

If a response is lost after possible Grist application, J2 records `UNCERTAIN` and follows the capability reconciliation rule. It never blindly replays.

### STAGE-R3 — confirmed partial identifiers survive

Created stable identifiers from completed batches/steps remain available after a later failure.

### STAGE-R4 — restart does not depend on conversation memory

A new process/execution context can inspect the durable execution state and decide to continue, verify, compensate or suspend.

### STAGE-R5 — unsafe ambiguity suspends

If current observable state cannot distinguish safe continuation from a duplicate/destructive replay, the execution suspends with evidence.

## 12. Human-change preservation properties

### STAGE-H1 — business evolution is not drift

New ordinary Stage rows and edits to follow-up traces by application users are not automatically reverted because they differ from a previous snapshot.

### STAGE-H2 — untargeted schema/configuration is preserved

J2 does not remove or rewrite existing structures outside its managed transformation merely because they are absent from DesiredState.

### STAGE-H3 — changed MANAGED state is reconciled, not silently reset

A human edit to a managed property produces reconciliation/conflict handling according to that property's policy.

## 13. Logical identity and binding requirements

Before J2 runs against a fixture/application, record at least:

```text
Student -> relevant table/column identities
Stage -> table identity and stable follow-up field identities
Teacher -> identity relation
Period -> table identity if relevant
responsible(T, S) -> actual current-assignment relation
LinkKey attribute/policy -> exact tested rule source and relevant identities
teacher-facing page/widget -> current IDs, visible field mapping and editor capabilities
```

In the current reference the partially observed mapping is `Stages.Suivi_par` → `Enseignants`, and `Stages.Date_du_contact` is an editable Date field. The accompanying binding document records page/widget observations, the owner's confirmation of the sheet display and outstanding teacher-specific ACL/UI evidence. A rename between accepted states updates mappings rather than creating a duplicate logical component.

## 14. Known/possible dependency graph required for J2

At minimum inspect dependencies from the elements J2 will touch into:

- formulas;
- access rules;
- reverse relations;
- native pages/widgets/select-by/filter behavior;
- custom-widget mappings;
- known external integrations;
- behavioral tests/evidence.

Each dependency is `CONFIRMED`, `POSSIBLE` or `UNKNOWN`.

A critical unknown dependency reached by the proposed change blocks the affected change until resolved or explicitly placed into a safe degraded/suspended path.

## 15. Evidence model

Every verdict used for J2 acceptance records:

```text
property ID
contract version
verdict
criticality
exact document / relevant revision marker
Grist version when observable
acting/tested identity or LinkKey scenario
verification method
time
dependencies/evidence inputs
```

Evidence is invalidated when the ImpactGraph shows that a relevant dependency changed.

## 16. Minimum browser acceptance matrix

The exact fixture names are synthetic; tests must use controlled identities and no real student rows.

| Test | Context | Expected result |
|---|---|---|
| BROW-A | Teacher A valid link, Stage A assigned to A | A sees the Stage follow-up and can enter/correct/clear the authorized fields, including contact date |
| BROW-B | Teacher B valid link, Stage A not assigned to B | B cannot read or edit A's protected Stage trace |
| BROW-C | missing/invalid key | denied/limited according to policy; no protected data |
| BROW-D | revoked key | previously granted protected access gone |
| BROW-E | Teacher B attempts relation tampering | no access expansion |
| BROW-F | Stage reassigned A → B | A loses responsibility-derived access, B gains permitted access, trace remains |
| BROW-G | “Suivi des stages” page | contact date appears in the intended teacher-facing sheet and is editable where authorized |

These tests establish contextual scenarios, not universal ACL correctness.

## 17. Minimum transformation acceptance sequence

A J2 reference run should demonstrate:

1. observe and bind an isolated, synthetic copy of the stage application, including the LinkKey rule and UI field mapping;
2. accept an exact managed scope and plan for the Stage follow-up date/access/UI behavior;
3. build an ImpactGraph for touched elements;
4. establish the safe execution mode;
5. execute needed schema/access/UI effects through the J1 execution engine, without duplicating existing elements;
6. inject a controlled interruption and resume/suspend correctly;
7. perform the browser acceptance matrix with controlled identities;
8. verify preservation of pre-existing business identities/data;
9. inject a relevant concurrent human UI/configuration change and prove preservation/conflict handling;
10. rerun the accepted intent and demonstrate convergence without duplication.

The date field manually added to the live reference is input fixture state. It does not count as step 5 or substitute for controlled engine evidence.

## 18. Critical delivery gate

The J2 change cannot be declared ready when an impacted `CRITICAL` property is `UNKNOWN` or `VIOLATED`.

A critical unknown outside the dependency closure of the J2 change does not automatically block J2.

## 19. Resolved choices and outstanding observations

Human-accepted choices: follow-up on the existing Stage row; `Suivi_par` is the assigned teacher; a call or visit trace has type, actual contact date, implication, punctuality and comments; correction/clearing is allowed; former teachers lose responsibility-derived access on reassignment while the trace remains. No separate Visit table or author-audit field is mandated.

Observed binding: the named reference Grist document has `Stages.Suivi_par` (`Ref:Enseignants`), `Type_de_contact` (`Appel`/`Visite`), `Implication`, `Ponctuel`, `Commentaire`, and the newly added editable Date `Date_du_contact`. The “Suivi des stages” page uses widgets 31 and 37 on `Stages`; `Enseignants.Lien_Stages` links there with `LinkKey_Token`. The owner reports that the date is now in the sheet and teacher-specific links filter the displayed Stages through Grist ACLs; those effects still need controlled tests.

Still `UNKNOWN` until direct controlled evidence: exact Grist ACL rules and `user.LinkKey` attributes; the teacher-specific URL's resolved date field mapping; effective teacher read/write/clear permissions, invalid/revoked/reassigned behavior; managed/shared UI regions and dependency closure. No author identity field or per-contact history is established. These facts must not be fabricated from owner API access.

## 20. J2 exit criteria

The stage-tracking reference scenario is complete only when:

- all impacted critical properties are `VERIFIED` against contextualized evidence;
- no existing business record identity is unintentionally lost or duplicated;
- LinkKey isolation is tested through the real supported browser path;
- unsafe intermediate exposure is absent by construction/test;
- relevant human concurrent changes are protected, reconciled or cause suspension rather than silent overwrite;
- a controlled interruption demonstrates J1 recovery semantics;
- repeating the accepted transformation on unchanged managed state creates no duplicates;
- unknowns and evidence scope are reported explicitly;
- the same execution engine used by J0/J1 is used rather than introducing business-specific replay logic.

## 21. Role in product validation

Passing this contract on a controlled fixture proves that the architecture can maintain one realistic application across schema, access, UI and recovery boundaries.

It does **not** prove generality of the Builder. A second materially different reference application (for example import + calculations + analysis + restitution) remains required before broad native-Builder generalization.
