# J2 stage-tracking accepted business semantics

Status: **human-accepted business behavior; application access/UI binding remains incomplete**.

The reference document is the existing Grist document named “suivi des stages chatgpt”. It is a test case for a generic Builder, not a template that other applications must copy. See [the observed binding](J2-STAGE-TRACKING-REFERENCE-BINDING.md) for the current fixture facts and remaining checks.

## 1. Follow-up responsibility and trace

`Stages.Suivi_par` designates the teacher assigned to contact the student's placement host, either by telephone or during a visit. When that teacher records the contact, the teacher is the attributed **business author** of the trace. The accepted workflow does not reassign the Stage. This attribution does not independently prove which person entered or last edited each cell.

The teacher's follow-up trace belongs to the **existing Stage record**. Its current fields are `Type_de_contact` (choices `Appel` and `Visite`), `Date_du_contact` (date of the call or visit), `Implication`, `Ponctuel`, and `Commentaire`. The date is a contact date, distinct from the start/end dates of the placement. Existing rows may have no date; no historical date may be fabricated. A completed new follow-up records the contact date together with the relevant trace fields.

The accepted behavior lets the assigned teacher complete, correct or clear authorized follow-up fields on the Stage. **One editable contact trace per Stage is sufficient**, as confirmed by the document owner. A correction or replacement updates those fields on the same Stage; clearing an erroneous entry leaves the Stage intact. The application need not keep a separate record of earlier contact values. A future requirement to preserve multiple contacts or audit actual editors requires a separate business decision.

No physical `Visit` table, row, relation or page is required for this reference case. In the generic product contract, “follow-up” is a logical capability that must be bound to the observed application representation.

## 2. Current responsibility and access

`responsible(T, S)` means that Stage S currently references teacher T through `Stages.Suivi_par`. Authorization for the teacher-facing flow must additionally be established from the real Grist LinkKey policy; this relation alone is not a proof of ACL enforcement.

Entering, correcting or clearing a contact and executing a J2 transformation must leave `Suivi_par` unchanged. There is no reassignment scenario in this accepted workflow. A teacher must not be able to change the assignment relation merely to acquire another Stage's protected information.

## 3. Teacher-facing behavior

The intended teacher can use the existing “Suivi des stages” flow for assigned Stages to view and edit the authorized fields. The date of the call or visit must be reachable there alongside the other trace fields. Preserve existing human-maintained layout unless the accepted transformation explicitly manages a specific part. The document owner reports having added the date to the visible follow-up sheet. Whether the same date is available to an assigned teacher through the LinkKey URL, and whether the ACL permits only the intended edits, still require a controlled browser test.

The teacher receives a specific follow-up URL from the `Enseignants` table. Its LinkKey and the application's ACL rules are intended to present an adapted interface containing only the Stages assigned to that teacher. J2 must preserve and verify this existing access path instead of replacing it with owner-level API access or a newly invented ACL.

## 4. Author attribution

The teacher assigned in `Suivi_par` is the business author when that teacher records the contact. Because the accepted workflow has no reassignment, J2 does not need to create an additional historical contact-author field. Do not claim knowledge of who recorded old traces when their provenance is unknown.

A teacher-specific LinkKey URL grants access to its holder under the observed ACLs; it does not prove which person actually typed in a cell. This business attribution is not a technical edit audit.

## 5. J2 evidence and remaining gate

The reference acceptance matrix must show, with controlled teacher identities and the supported LinkKey/browser path:

- an assigned teacher can enter, correct, replace and clear the single contact trace on the same Stage, including its date, without creating another Stage or a contact-history record;
- another teacher cannot read or write protected follow-up data outside their assignment or change `Suivi_par` to acquire access;
- contact entry, correction, clearing and J2 execution preserve `Suivi_par` and the same Stage; B's distinct teacher link cannot access A's protected Stage;
- missing, invalid and revoked LinkKeys deny the protected path according to the observed policy;
- the follow-up date appears in the teacher's actual LinkKey flow and is editable only with the intended permissions;
- repeating the accepted transformation does not duplicate fields, widgets, rules or records;
- the J1 execution engine handles protected effects, interruption, uncertainty and recovery.

Schema and page/widget IDs are partly observed, and the document owner reports that the date is now visible in the follow-up sheet. The actual ACL rule source, teacher browser permissions, resolved widget field mapping and dependency closure are not yet independently verified. These are fixture observations, not permission to invent a new policy or declare J2 complete. A controlled browser session using the teacher-specific URLs and an isolated test fixture are required before those critical verdicts can pass. Direct maintenance of the reference document's date column is **not** a J2 execution-engine proof.
