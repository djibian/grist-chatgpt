# J2 stage-tracking accepted business semantics

Status: **human-accepted business behavior; application access/UI binding remains incomplete**.

The reference document is the existing Grist document named “suivi des stages chatgpt”. It is a test case for a generic Builder, not a template that other applications must copy. See [the observed binding](J2-STAGE-TRACKING-REFERENCE-BINDING.md) for the current fixture facts and remaining checks.

## 1. Follow-up responsibility and trace

`Stages.Suivi_par` designates the teacher assigned to contact the student's placement host, either by telephone or during a visit. When that teacher records the contact, the teacher is the attributed **business author** of the trace. The author of that contact must remain the same if the Stage is later reassigned. This attribution does not independently prove which person entered or last edited each cell.

The teacher's follow-up trace belongs to the **existing Stage record**. Its current fields are `Type_de_contact` (choices `Appel` and `Visite`), `Date_du_contact` (date of the call or visit), `Implication`, `Ponctuel`, and `Commentaire`. The date is a contact date, distinct from the start/end dates of the placement. Existing rows may have no date; no historical date may be fabricated. A completed new follow-up records the contact date together with the relevant trace fields.

The accepted behavior lets the assigned teacher complete, correct or clear authorized follow-up fields on the Stage. **One editable contact trace per Stage is sufficient**, as confirmed by the document owner. A correction or replacement updates those fields on the same Stage; clearing an erroneous entry leaves the Stage intact. The application need not keep a separate record of earlier contact values. A future requirement to preserve multiple contacts or audit actual editors requires a separate business decision.

No physical `Visit` table, row, relation or page is required for this reference case. In the generic product contract, “follow-up” is a logical capability that must be bound to the observed application representation.

## 2. Current responsibility and access

`responsible(T, S)` means that Stage S currently references teacher T through `Stages.Suivi_par`. Authorization for the teacher-facing flow must additionally be established from the real Grist LinkKey policy; this relation alone is not a proof of ACL enforcement.

Entering or correcting a contact and executing a J2 transformation must not silently reassign `Suivi_par`. A later administrative reassignment from teacher A to B is a distinct event: A remains the historical author of the contact A performed, the single existing trace remains on the Stage, and current responsibility/teacher-facing access moves to B. A teacher must not be able to change the assignment relation merely to acquire another Stage's protected information. The authority permitted to initiate reassignment remains a separate open policy choice.

## 3. Teacher-facing behavior

The intended teacher can use the existing “Suivi des stages” flow for assigned Stages to view and edit the authorized fields. The date of the call or visit must be reachable there alongside the other trace fields. Preserve existing human-maintained layout unless the accepted transformation explicitly manages a specific part. The document owner reports having added the date to the visible follow-up sheet. Whether the same date is available to an assigned teacher through the LinkKey URL, and whether the ACL permits only the intended edits, still require a controlled browser test.

The teacher receives a specific follow-up URL from the `Enseignants` table. Its LinkKey and the application's ACL rules are intended to present an adapted interface containing only the Stages assigned to that teacher. J2 must preserve and verify this existing access path instead of replacing it with owner-level API access or a newly invented ACL.

## 4. Author attribution

At the time of a contact, its business author is the then-assigned teacher. Because `Suivi_par` is mutable current responsibility, it cannot alone retain the historical author A after reassignment to B. J2 must bind a durable historical contact-author identity on the same Stage record, creating a narrowly managed field only if the observed fixture has no equivalent. It must capture the assigned teacher at the actual contact event, preserve that identity through reassignment, and avoid inventing authors for old rows whose provenance is unknown. The exact Grist capture/ACL mechanism requires a safe accepted plan. The observed schema currently has no separate author field.

A teacher-specific LinkKey URL grants access to its holder under the observed ACLs; it does not prove which person actually typed in a cell. This business attribution is not a technical edit audit. How attribution changes if B later corrects or replaces A's trace is still an explicit open decision; no implementation may silently choose it.

## 5. J2 evidence and remaining gate

The reference acceptance matrix must show, with controlled teacher identities and the supported LinkKey/browser path:

- an assigned teacher can enter, correct, replace and clear the single contact trace on the same Stage, including its date, without creating another Stage or a contact-history record;
- another teacher cannot read or write protected follow-up data outside their assignment or change `Suivi_par` to acquire access;
- contact entry, correction, clearing and J2 execution do not themselves change `Suivi_par`; after a separate authorized reassignment A → B, A remains the historical author of A's existing contact and the trace survives;
- after reassignment A → B, A loses access derived solely from current responsibility and B gains only the permitted current-responsibility access; missing, invalid and revoked LinkKeys deny the protected path according to the observed policy;
- the follow-up date appears in the teacher's actual LinkKey flow and is editable only with the intended permissions;
- repeating the accepted transformation does not duplicate fields, widgets, rules or records;
- the J1 execution engine handles protected effects, interruption, uncertainty and recovery.

Schema and page/widget IDs are partly observed, and the document owner reports that the date is now visible in the follow-up sheet. The current Stage schema has no historical contact-author column, so author retention after reassignment is an unimplemented fixture/model gap, not a proven feature. The actual ACL rule source, teacher browser permissions, resolved widget field mapping and dependency closure are not yet independently verified. These are fixture observations, not permission to invent a new policy or declare J2 complete. A controlled browser session using the teacher-specific URLs and an isolated test fixture are required before those critical verdicts can pass. Direct maintenance of the reference document's date column is **not** a J2 execution-engine proof.
