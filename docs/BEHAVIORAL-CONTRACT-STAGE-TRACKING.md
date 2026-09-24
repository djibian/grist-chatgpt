# Stage-tracking BehavioralContract

Status: **first business reference contract; proposed logical contract, not proof of the current Grist document**.

Purpose: define the first end-to-end business scenario that the future Builder must satisfy after J0/J1 execution semantics exist.

This contract deliberately uses **logical identities** rather than assuming current Grist table/column IDs. Before J2 implementation, a fixture/application binding must map these logical identities to the exact tested Grist document and record any unresolved semantics.

## 1. Scenario objective

Starting from an existing stage-tracking application, add a new capability for recording stage visits while preserving:

- existing stage/student/teacher/period business data;
- existing observations and legitimate human changes;
- the application's LinkKey-based teacher isolation policy;
- existing relevant UI behavior;
- safe interruption/recovery semantics inherited from J0/J1.

The reference transformation is intentionally cross-cutting: it changes schema, relations, access behavior and UI, and therefore exercises the Builder as an application transformer rather than a table editor.

## 2. Contract authority

Until individually accepted, business rules in this document are classified as either:

- **ACCEPTED BASELINE** — directly established by the validated product vision / audit scenario;
- **PROPOSED** — a precise interpretation needed for an executable fixture but requiring confirmation before it becomes an immutable J2 criterion;
- **UNKNOWN** — must not be guessed.

The Builder may propose resolutions for `PROPOSED` or `UNKNOWN` items. It may not mark them accepted by itself.

Once accepted for a J2 run, the exact contract version is immutable for that run.

## 3. Logical application identities

### Actors

```text
ApplicationOwner
Teacher
AnonymousOrInvalidLinkVisitor
BuilderPrincipal
```

The `BuilderPrincipal` is the privileged identity used to transform the application. It is not an application user and must not be used as evidence that Teacher LinkKey isolation works.

### Existing logical entities

```text
Student
Stage
Teacher
Period
```

The exact current Grist IDs are fixture/application bindings, not part of the logical contract.

### New logical entity for J2

```text
Visit
```

Minimum intended semantics:

```text
Visit
  -> belongs to exactly one Stage
  -> records a visit date or equivalent temporal fact
  -> records an observation/content field
```

Whether additional fields such as author, visit type or status are needed is outside the minimum J2 contract unless explicitly accepted.

## 4. Responsibility predicate

The contract uses a logical predicate:

```text
responsible(Teacher, Stage)
```

It means that the teacher is currently authorized by the stage-tracking business model to manage/record visits for that stage.

J2 must bind this predicate to the real existing model rather than inventing a duplicate responsibility model merely for the test.

The binding may be a direct relation, a set/list relation, an assignment table or another supported representation. If the current application state cannot establish the predicate exactly, the related critical guarantees remain `UNKNOWN` and J2 cannot claim readiness.

## 5. Managed scope

Initial proposed management modes for J2:

| Property | Mode | Rationale |
|---|---|---|
| `Visit` schema introduced by J2 | `MANAGED` | Builder-created capability |
| relation from `Visit` to `Stage` | `MANAGED` | required semantic link |
| access rules required for `Visit` | `MANAGED` | confidentiality invariant |
| new Visit UI/widgets introduced by J2 | `MANAGED` | Builder-created UI |
| layout of existing human-maintained pages | `SHARED` | human adjustments must be reconciled/preserved |
| existing Stage/Student/Teacher/Period schema not targeted by plan | `OBSERVED` | preserve unless explicit migration accepted |
| existing business records | `OBSERVED` | normal business evolution, not configuration to reconverge |
| existing widget code/integrations not targeted by plan | `OBSERVED` or `SHARED` after dependency analysis | do not silently rewrite |

The final J2 binding may refine this table but may not silently broaden `MANAGED` scope.

## 6. Criticality vocabulary

### CRITICAL

A failure or unknown verdict blocks delivery of the J2 change when the property is impacted.

### IMPORTANT

A violation blocks normal delivery; an `UNKNOWN` may permit only an explicitly degraded/test-only result if the accepted contract allows it.

### INFORMATIONAL

May be delivered with notice if unrelated to safety/correctness of the requested change.

The Builder cannot downgrade criticality by itself.

## 7. Business behavioral properties

### STAGE-B1 — visit belongs to a stage

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE for the reference scenario.

Every J2-created `Visit` record must reference exactly one existing `Stage` according to the supported logical model.

A Visit must not silently become orphaned because of a Builder migration.

### STAGE-B2 — responsible teacher can record a visit

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE from the reference scenario.

Given teacher `T` and stage `S` where `responsible(T, S)` is true, the teacher-facing application path must allow `T` to record the minimum Visit information required by the accepted UI/behavior contract.

The proof must exercise the same user-facing LinkKey/browser path relied on in production when LinkKey is part of the policy.

### STAGE-B3 — non-responsible teacher cannot access another teacher's protected visit data

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

Given distinct teachers `A` and `B`, and stage `SA` for which `responsible(A, SA)` is true and `responsible(B, SA)` is false, the LinkKey/browser path for B must not expose Visit information protected for A/SA.

The exact protected fields are determined by the bound AccessModel. The test must not use a privileged owner account as a substitute for B.

### STAGE-B4 — invalid LinkKey follows the accepted denial policy

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A missing/invalid LinkKey must produce the application's accepted denied/limited behavior and must not expose protected Visit/Stage information.

### STAGE-B5 — revoked LinkKey loses corresponding access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

After a LinkKey is revoked according to the application's supported policy, the corresponding browser path must no longer provide the protected access previously granted by that key.

### STAGE-B6 — relationship tampering cannot broaden access

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

A teacher must not be able to gain access to another protected Stage/Visit domain merely by changing a writable relation or crafted request available through the application path.

The fixture must include at least one attempted reassignment/tampering case relevant to the actual model.

### STAGE-B7 — adding Visit preserves existing business records

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

The J2 transformation must not delete, duplicate or rewrite existing Stage, Student, Teacher, Period or observation records except for a migration explicitly listed in the accepted plan.

Counts alone are insufficient evidence when stable identities can be compared.

### STAGE-B8 — repeated transformation does not duplicate structural objects

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

After J2 has successfully reached its accepted desired state, running the same accepted intent again against an unchanged environment must not create a second Visit table, duplicate managed columns, duplicate managed access rules or duplicate managed UI widgets.

### STAGE-B9 — new periods do not create duplicate stages

**Criticality:** IMPORTANT (candidate CRITICAL if period generation is touched by J2)  
**Authority:** ACCEPTED baseline business example, but its direct relevance to the first Visit-only J2 change depends on the bound impact graph.

If J2 does not affect period/stage generation and the ImpactGraph confirms no dependency, this property need not block the Visit change. If affected, it must be verified according to the existing application rule.

### STAGE-B10 — reassignment preserves existing observations/visits

**Criticality:** CRITICAL if reassignment logic is affected by the change; otherwise IMPORTANT regression property.  
**Authority:** ACCEPTED BASELINE for preservation of existing observations.

Reassigning responsibility for a Stage must not delete the Stage's existing observations or Visit records merely because the responsible teacher changes.

**Open semantic decision:** whether the previous teacher retains historical visibility after reassignment or visibility immediately follows current responsibility. J2 must not guess this. The AccessModel must resolve it before any corresponding guarantee is marked `VERIFIED`.

## 8. AccessModel properties

### STAGE-A1 — Visit inherits the required protection domain

**Criticality:** CRITICAL  
**Authority:** ACCEPTED BASELINE.

Adding the Visit entity must not create an unprotected table outside the existing LinkKey isolation model.

The exact Grist access-rule implementation may differ from other tables, but the effective tested policy must be equivalent to the accepted application behavior.

### STAGE-A2 — protected intermediate states are forbidden

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

The transformation must not populate sensitive Visit data into a state that is temporarily exposed before required access protection exists.

If the actual Grist primitives cannot make the in-place sequence safe, J2 must use an effectively isolated preparation path or refuse the unsafe in-place mode.

### STAGE-A3 — builder privilege is not user-policy proof

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

Successful API calls made with the Builder/owner identity do not prove LinkKey user isolation.

### STAGE-A4 — browser verification is required for LinkKey guarantees

**Criticality:** CRITICAL  
**Authority:** fixed product vision.

Where `user.LinkKey` behavior depends on the Grist web client and is unavailable in ordinary API evaluation, critical isolation verdicts require controlled browser scenarios with the relevant links/identities.

## 9. UI behavioral properties

### STAGE-U1 — teacher can reach the Visit function through the intended UI

**Criticality:** IMPORTANT  
**Authority:** ACCEPTED BASELINE in principle; exact UI is PROPOSED until bound.

The new Visit capability must be reachable through an intentional teacher-facing UI flow rather than existing only as a table reachable by owners.

The Builder may choose a native Grist UI or, in later product versions, a custom widget only after applying the product's maintainability/ergonomics/security decision process.

### STAGE-U2 — unrelated human layout changes are preserved

**Criticality:** IMPORTANT  
**Authority:** fixed product vision.

If an existing `SHARED` page layout is changed by a human after the Builder's last accepted state, J2 must not silently restore the earlier Builder layout while adding the Visit capability.

The system must preserve, reconcile or suspend according to the accepted conflict policy.

### STAGE-U3 — new managed UI is convergent

**Criticality:** IMPORTANT  
**Authority:** fixed product vision.

Reapplying the same desired Visit UI to an unchanged managed state does not duplicate widgets/pages.

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

New ordinary Stage/Visit/observation rows created by application users are not automatically reverted because they differ from a previously accepted snapshot.

### STAGE-H2 — untargeted schema/configuration is preserved

J2 does not remove or rewrite existing structures outside its managed transformation merely because they are absent from its DesiredState.

### STAGE-H3 — changed MANAGED state is reconciled, not silently reset

A human edit to a managed property produces a reconciliation/conflict decision according to the property's conflict policy.

## 13. Logical identity and binding requirements

Before J2 runs against a fixture/application, record bindings for at least:

```text
Student logical identity -> Grist table/column IDs needed by scenario
Stage -> exact table ID and stable relevant columns
Teacher -> exact table ID / identity relation
Period -> exact table ID if relevant
Visit -> desired stable logical identity and proposed Grist ID
responsible(T, S) -> exact relation/formula/table semantics
LinkKey attribute/policy -> exact tested rule source
teacher-facing page/widget -> exact current IDs when pre-existing
```

A rename between accepted states updates mappings rather than automatically creating a new logical component.

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

The exact fixture names are synthetic.

| Test | Context | Expected result |
|---|---|---|
| BROW-A | Teacher A valid link, Stage A assigned to A | A can access the allowed Stage/Visit flow |
| BROW-B | Teacher B valid link, Stage A not assigned to B | B cannot see A-protected Visit data |
| BROW-C | invalid/missing key | denied/limited according to accepted policy; no protected data |
| BROW-D | revoked key | previously granted protected access is gone |
| BROW-E | Teacher B attempts relation tampering toward Stage A | no unintended access expansion |
| BROW-F | new Visit table/views after transformation | same required isolation as accepted application model |

These tests prove only their contextualized scenarios, not all possible ACL properties.

## 17. Minimum transformation acceptance sequence

A J2 reference run should demonstrate:

1. observe and bind the existing synthetic stage application;
2. propose the managed scope and exact Visit transformation;
3. build an ImpactGraph sufficient for the touched elements;
4. establish/validate the required safe execution mode;
5. execute schema/access/UI steps through J1 execution semantics;
6. inject at least one controlled interruption and resume/suspend correctly;
7. perform browser LinkKey acceptance scenarios;
8. verify preservation of pre-existing business identities/data;
9. inject a relevant concurrent human UI/configuration change and prove preservation/conflict handling;
10. re-run the same accepted intent and demonstrate convergence without structural duplication.

## 18. Critical delivery gate

The J2 change cannot be declared ready when an impacted `CRITICAL` property is `UNKNOWN` or `VIOLATED`.

A critical unknown outside the dependency closure of the J2 change does not automatically block J2.

## 19. Explicit open decisions before executable J2

The following are intentionally not invented by this document and must be bound/accepted before the corresponding tests become normative:

1. exact existing Grist table/column identities;
2. exact representation of `responsible(Teacher, Stage)`;
3. exact LinkKey attribute and current access rules;
4. whether a teacher may edit/delete an existing Visit after creation;
5. whether historical visibility remains with a former teacher after reassignment or follows current responsibility immediately;
6. whether Visit author identity must be stored independently of current responsibility;
7. exact teacher-facing UI flow and which existing layout regions are `SHARED`;
8. whether any existing custom widget is in the dependency closure of Visit/responsibility/access behavior.

Until resolved, these items remain `PROPOSED` or `UNKNOWN`; the Builder cannot silently choose the convenient answer.

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

Passing this contract proves that the architecture can transform one realistic application across schema, access, UI and recovery boundaries.

It does **not** prove generality of the Builder. A second materially different reference application (for example import + calculations + analysis + restitution) remains required before broad native-Builder generalization.
