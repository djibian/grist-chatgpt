# J2 stage-tracking accepted business semantics

Status: **human-accepted J2 business decisions**.

This document records the business decisions accepted for the J2 stage-tracking reference scenario. It resolves the human-choice part of section 19 of `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md` without binding the product to one Grist file layout.

The reference application remains a **test case**, not the product model. Exact tables, columns, formulas, pages, widgets and access-rule implementation are fixture/application bindings that must be observed from the tested Grist document rather than invented from this document.

## 1. Visit/follow-up editing semantics

A teacher does not need a distinct "create Visit" workflow as a business requirement.

The accepted teacher behavior is:

- the teacher reaches the follow-up information for a Stage for which `responsible(Teacher, Stage)` is currently true;
- the teacher may complete the visit/follow-up fields to which that teacher is authorized;
- the teacher may later correct the visit date and observation/content;
- the teacher may clear those fields when the entry was made for the wrong student/stage or is otherwise erroneous.

The contract therefore does **not** require a physical Grist `Visit` table, a new Visit row, or a row-delete operation. `Visit` is a logical business capability attached to Stage follow-up. The tested application's physical representation must be discovered during binding.

If the bound application represents one visit as a separate record, the implementation may map the accepted correction/clearing behavior onto that representation only when the mapping is explicit, authorization-preserving and verified. The Builder must not introduce a separate Visit entity merely because the earlier draft contract used that logical name.

## 2. Reassignment and visibility

Visibility follows **current responsibility**.

When responsibility for a Stage changes from teacher A to teacher B:

- teacher A loses the protected teacher-facing access that was derived from being responsible for that Stage;
- teacher B gains only the access granted by the accepted current-responsibility policy;
- existing visit/follow-up information is preserved and is not deleted merely because responsibility changes.

Historical access is therefore not retained for a former responsible teacher solely because that teacher previously had responsibility.

## 3. Author identity

The application must preserve the identity of the author/person who performed the visit or follow-up entry when that information is part of the existing business model.

For the current reference application, author identity is already represented in the Stage application state. J2 must **bind to and preserve the existing representation** rather than create a duplicate author model by default.

The exact Grist column/formula/relation carrying that identity remains an observational binding fact and must be verified from the tested document.

## 4. Teacher-facing UI intent

The accepted UI intent is:

> A teacher can consult the visits/follow-up information for the stages currently assigned to that teacher and complete or correct the follow-up sheet within the fields that teacher is authorized to edit.

J2 does not require a dedicated Visit table page, a custom widget, or a specific layout. The Builder must inspect the current teacher-facing flow and preserve legitimate existing layout/behavior while making the accepted capability reachable through that flow.

## 5. Consequence for the logical contract

The logical `Visit` concept in `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md` must be interpreted as a **business follow-up capability**, not as a mandated physical entity.

Accordingly, J2 must not assume in advance that it should:

- create a table named `Visit`;
- create one row per visit;
- add a new author column;
- create a dedicated Visit page;
- replace the existing responsibility or LinkKey model.

Those would be implementation choices and require evidence from the bound application and the accepted transformation plan.

## 6. Remaining binding facts — observation, not human product choices

The following remain unresolved until the real reference application is inspected:

1. exact Grist table/column identities needed by the scenario;
2. exact representation of `responsible(Teacher, Stage)`;
3. exact `user.LinkKey` attribute and current access rules;
4. exact fields/formulas/relations that represent visit date, observation/content and author identity;
5. exact teacher-facing page/view/widget/layout involved in the follow-up sheet;
6. which existing layout regions are `SHARED` rather than `MANAGED`;
7. whether any existing custom widget or integration is in the dependency closure of follow-up/responsibility/access behavior.

These are **fixture/application facts to discover and verify**. Their absence is not a request for the Builder to invent a convenient schema.

## 7. Minimum additional acceptance behavior implied by these decisions

The J2 reference evidence must include, in addition to the existing isolation/recovery criteria:

- an authorized responsible teacher can edit the accepted follow-up date/observation fields;
- the same teacher can correct and clear those fields;
- a non-responsible teacher cannot perform the same protected read/write operations on another teacher's assigned Stage;
- after reassignment, the former teacher loses the responsibility-derived protected access;
- follow-up data survives reassignment;
- existing author identity survives correction/reassignment according to the bound business representation;
- no duplicate author/responsibility/follow-up structure is introduced merely to satisfy the test.

## 8. Next J2 gate

The remaining gate is **read-only observation and binding of the real reference Grist application**.

That binding must come from current document evidence, not conversation memory. Once it records the exact responsibility relation, LinkKey policy, follow-up fields, author representation and relevant UI/dependencies, the J2 implementation plan can be evaluated without another business-design decision unless observation exposes a genuinely new ambiguity.
