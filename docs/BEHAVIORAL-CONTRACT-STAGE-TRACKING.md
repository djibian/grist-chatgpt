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

The accepted application properties remain broader than the proof obligation for one bounded transformation. A J2 run must verify every `CRITICAL` property reached by the transformation's confirmed/possible dependency closure; an accepted property outside that closure remains an application expectation and must not be reported as `VERIFIED` merely because the transformation passed.

## 3. Logical application identities

Actors: `ApplicationOwner`, `Teacher`, `AnonymousOrInvalidLinkVisitor`, and `BuilderPrincipal`. The privileged BuilderPrincipal cannot stand in for a teacher in LinkKey access tests.

Existing logical entities: `Student`, `Stage`, `Teacher`, `Period`.

The J2 follow-up trace is **part of Stage**, not a separate logical/physical Visit record. The trace has a contact type (call/visit), actual contact date, implication, punctuality and comments. The contact date is distinct from placement start/end dates. One editable set of follow-up values per Stage is sufficient for the accepted workflow; no independent per-contact history is required.

On the reference fixture the observed columns are `Stages.Type_de_contact`, `Stages.Date_du_contact`, `Stages.Implication`, `Stages.Ponctuel`, `Stages.Commentaire`. These IDs are binding facts only. The optionality of historical rows must be preserved; J2 must not invent dates.

`Stages.Suivi_par` is the teacher **assigned** to conduct the call/visit. When this teacher records a contact, that teacher is its business author. The accepted workflow has no reassignment, so it does not require an additional historical-author field. Do not infer authors for existing rows of unknown provenance or claim a technical audit of the person who edited a cell. One mutable contact trace per Stage remains sufficient.

## 4. Responsibility predicate

`responsible(T, S)` means the current assignment: Stage S references teacher T in the observed `Stages.Suivi_par` relation.

This establishes business responsibility, not effective browser authorization by itself. The owner reports that a teacher-specific URL from `Enseignants` passes a LinkKey and that Grist ACLs restrict the teacher's adapted interface to assigned Stages. The exact LinkKey attribute, rule source and negative access behavior still require controlled observation. The Builder must bind the predicate to each tested application's real model and must not invent another responsibility relation merely for the test.

## 5. Managed scope

Proposed scope for the controlled J2 transformation; exact targets require a pre-run binding and accepted plan:

| Property | Mode | Rationale |
|---|---|---|
| required contact-date field | `MANAGED` where needed | explicit Builder change in an isolated fixture; no historical-author migration |
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

Exactly one mutable call/visit trace is held in the existing Stage row. Entering, replacing, correcting or clearing its fields must not create a second Stage or a separate contact-history record, or orphan/delete the Stage. The previous values need not be retained as an application-level contact history.

### STAGE-B2 — responsible teacher can record a contact

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

For `responsible(T, S)`, the supported teacher-facing path must allow T to enter, correct and clear the authorized Stage follow-up fields: contact type (`Appel`/`Visite`), contact date, implication, punctuality and comments. A completed new contact records its actual date; historic blank dates are not fabricated. This must be proven through the supported LinkKey/browser path when that policy applies.

### STAGE-B3 — other teachers cannot access protected follow-up

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

With teacher B's distinct valid LinkKey, B cannot read or edit protected follow-up data for Stage S assigned to A through any reachable teacher browser page or Raw Data view. The exact protected fields and link mapping are determined by the observed AccessModel, not by owner API calls. This tests isolation between links, not the real-world identity of whoever holds A's URL.

### STAGE-B4 — invalid LinkKey follows accepted denial

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A missing/invalid LinkKey must not expose protected Stage follow-up data.

### STAGE-B5 — revoked LinkKey loses access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A revoked key cannot retain protected access previously granted by that key. This remains an accepted application property. The contact-date transformation must execute a revocation transition only when its impact analysis reaches LinkKey lifecycle/revocation behavior; otherwise J2 records that property as outside the tested transformation closure rather than claiming it `VERIFIED`.

### STAGE-B6 — relation tampering cannot broaden access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A teacher cannot acquire another protected Stage's follow-up by changing `Suivi_par` or another writable relation, or by crafting requests available through the application. The accepted workflow contains no reassignment. A dedicated tampering probe is required for J2 when the affected teacher flow exposes that relation or the transformation's access-impact closure reaches it; otherwise the run must preserve the assignment and make no broader tampering claim.

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

### STAGE-B10 — follow-up preserves the teacher assignment

**Criticality:** CRITICAL when assignment or access logic is affected.
**Authority:** ACCEPTED BASELINE.

Contact entry, correction, clearing and the J2 transformation leave `Suivi_par` unchanged. They keep the single trace on its existing Stage. The accepted workflow has no reassignment path; teacher relation tampering is denied by STAGE-B6.

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

When an impacted guarantee depends on the Grist web client's `user.LinkKey`, controlled non-owner browser evidence is required; schema/API observations alone cannot establish that verdict. For the contact-date transformation the minimum access smoke uses a responsible teacher, a distinct unassigned teacher and a no-key session, including a Raw Data negative for the unassigned teacher. Invalid-key, revocation, relation-tampering or additional-view cases are added when the ImpactGraph reaches those properties; omitting an unimpacted case never converts that broader application property to `VERIFIED`.

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

Inspect the dependency closure reached from the exact schema/UI elements J2 will touch. Consider, where present:

- formulas;
- access rules and sharing/link generation;
- reverse relations;
- native pages/widgets/select-by/filter behavior;
- custom-widget mappings;
- known external integrations;
- behavioral tests/evidence.

Each dependency is `CONFIRMED`, `POSSIBLE` or `UNKNOWN`.

A critical unknown dependency reached by the proposed change blocks the affected change until resolved or explicitly placed into a safe degraded/suspended path. Unknown application areas outside that closure remain reported but do not create unrelated J2 test obligations.

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

## 16. Minimum browser acceptance matrix for this transformation

Tests use controlled fictional identities and no real student rows. The mandatory matrix is deliberately bounded to access/UI behavior affected by adding/exposing the contact date.

| Test | Context | Expected result |
|---|---|---|
| BROW-A | Teacher A valid link, Stage A assigned to A | A can reach the intended follow-up flow, enter/replace/correct/clear the authorized trace including contact date, and the same Stage and `Suivi_par` remain unchanged |
| BROW-B | Teacher B valid link, Stage A assigned to A | B cannot read or edit A's protected trace on the affected teacher page or Raw Data |
| BROW-C | no key | no protected Stage follow-up data is exposed |

An invalid-key control may accompany BROW-C when cheap to exercise. `STAGE-B5` revocation, `STAGE-B6` relation tampering and additional alternate-view probes remain accepted application properties but are conditional J2 tests: execute them when the actual transformation or observed access dependency closure reaches them. Never report an unexecuted broader property as `VERIFIED`.

These tests establish contextual scenarios, not universal ACL correctness.

## 17. Minimum transformation acceptance sequence

A J2 reference run should demonstrate:

1. with owner authority, bind only the touched schema/UI, stable business identities and relevant access/share/link dependencies; prepare one sanitized controlled realistic application whose relevant policy/UI corresponds to the reference, or record reference-specific parity as `UNKNOWN`;
2. prepare two independent initial checkpoints of that controlled application: one without `Date_du_contact`, and one where a human has already created the date plus unrelated legitimate layout/data changes; neither checkpoint may be derived by treating a prior Builder-created date as the independent human-start state;
3. accept an exact managed scope and plan for the Stage follow-up date and teacher-facing placement, leaving `Suivi_par`, business rows and ACLs unchanged when the observed policy already protects the new field;
4. execute the date-absent schema/UI transformation through the J1 execution engine with durable preconditions, authority, write-ahead intent and exact postconditions; if the bound policy actually requires an ACL write, specify and review that necessary effect separately rather than installing a synthetic replacement policy;
5. verify stable business identities/data, relevant access/share/link facts and UI mapping, then run BROW-A/B/C before/after as needed to prove the impacted browser-only guarantees;
6. restore the independently prepared date-present/human-edited checkpoint and run the same intent as its first Builder run; adopt the existing field and preserve legitimate edits rather than duplicating or resetting them;
7. inject one lost-response/restart case and one relevant concurrent human layout/configuration edit; reconcile from durable J1 state or suspend on ambiguity/conflict without blind replay;
8. rerun the accepted intent on an already managed result and demonstrate convergence without duplicate field, widget, record or trace.

The secret-bearing test application must remain unreachable from every model-facing bridge read path for the whole lifetime of test LinkKeys. Prefer a separate test origin with no bridge. A same-origin run is admissible only in a controlled exclusive window with stable access configuration, a strongest-path negative read before token creation, no move back into bridge reach while tokens exist, verified token cleanup, and a final negative read. A momentary denial, authentication failure or `UNKNOWN` probe is not isolation evidence. The currently bridge-readable fixture must not receive LinkKeys.

The date field manually added to the live reference is input fixture state. It does not count as the transformation effect or substitute for controlled engine evidence.

## 18. Critical delivery gate

The J2 change cannot be declared ready when an impacted `CRITICAL` property is `UNKNOWN` or `VIOLATED`.

A critical unknown outside the dependency closure of the J2 change does not automatically block J2.

## 19. Resolved choices and outstanding observations

Human-accepted choices: one modifiable follow-up trace on the existing Stage row is sufficient; the assigned teacher is the business author when recording a contact; there is no reassignment in this workflow. The trace has type, actual contact date, implication, punctuality and comments; entry, replacement, correction and clearing are allowed. No separate Visit table, historical-author field, contact history or technical edit audit is mandated.

Observed binding: the named reference Grist document has `Stages.Suivi_par` (`Ref:Enseignants`), `Type_de_contact` (`Appel`/`Visite`), `Implication`, `Ponctuel`, `Commentaire`, and the newly added editable Date `Date_du_contact`. The “Suivi des stages” page uses widgets 31 and 37 on `Stages`; `Enseignants.Lien_Stages` links there with `LinkKey_Token`. The owner reports that the date is now in the sheet and teacher-specific links filter the displayed Stages through Grist ACLs; those effects still need controlled tests.

Still `UNKNOWN` until direct controlled evidence: exact relevant Grist ACL rules and `user.LinkKey` attributes; teacher-specific date access; effective permissions on the affected teacher flow; managed/shared UI regions and dependency closure. Broader revocation or relation-tampering behavior remains `UNKNOWN` unless separately tested. No technical edit audit or per-contact history is established. These facts must not be fabricated from owner API access.

## 20. J2 exit criteria

The stage-tracking reference scenario is complete only when:

- all impacted critical properties are `VERIFIED` against contextualized evidence;
- no existing business record identity is unintentionally lost or duplicated;
- impacted LinkKey isolation is tested through the real supported browser path with the bounded A/B/no-key controls above;
- unsafe intermediate exposure is absent by construction/test;
- relevant human concurrent changes are protected, reconciled or cause suspension rather than silent overwrite;
- a controlled interruption demonstrates J1 recovery semantics;
- the independent date-present/human-edited first run and a true rerun preserve legitimate changes and create no duplicates;
- unknowns, untested broader application properties and evidence scope are reported explicitly rather than promoted to `VERIFIED`;
- the same execution engine used by J0/J1 is used rather than introducing business-specific replay logic.

## 21. Role in product validation

Passing this contract on a controlled fixture proves that the architecture can maintain one realistic application across schema, access, UI and recovery boundaries.

It does **not** prove generality of the Builder. A second materially different reference application (for example import + calculations + analysis + restitution) remains required before broad native-Builder generalization.