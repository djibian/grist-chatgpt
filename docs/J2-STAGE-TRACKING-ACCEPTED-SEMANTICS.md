# J2 stage-tracking accepted business semantics

Status: **human-accepted business behavior; application access/UI binding remains incomplete**.

The reference document is the existing Grist document named “suivi des stages chatgpt”. It is a test case for a generic Builder, not a template that other applications must copy. See [the observed binding](J2-STAGE-TRACKING-REFERENCE-BINDING.md) for the current fixture facts and remaining checks.

## 1. Follow-up responsibility and trace

`Stages.Suivi_par` designates the teacher assigned to contact the student's placement host, either by telephone or during a visit. It does **not** identify the person who entered or last edited a cell.

The teacher's follow-up trace belongs to the **existing Stage record**. Its current fields are `Type_de_contact` (choices `Appel` and `Visite`), `Date_du_contact` (date of the call or visit), `Implication`, `Ponctuel`, and `Commentaire`. The date is a contact date, distinct from the start/end dates of the placement. Existing rows may have no date; no historical date may be fabricated. A completed new follow-up records the contact date together with the relevant trace fields.

The accepted behavior lets the currently assigned teacher complete, correct or clear authorized follow-up fields on the Stage. Clearing an erroneous entry does not delete the Stage. The current structure contains one editable set of follow-up fields per Stage; it does not establish a per-contact history or a separate author audit. Any requirement for multiple independent contacts or an audit of the actual editor requires a separate business decision.

No physical `Visit` table, row, relation or page is required for this reference case. In the generic product contract, “follow-up” is a logical capability that must be bound to the observed application representation.

## 2. Current responsibility and access

`responsible(T, S)` means that Stage S currently references teacher T through `Stages.Suivi_par`. Authorization for the teacher-facing flow must additionally be established from the real Grist LinkKey policy; this relation alone is not a proof of ACL enforcement.

On reassignment from A to B, A loses access derived solely from current responsibility, B gains only the access granted by the accepted policy, and the existing follow-up trace remains on S. A former assignment does not grant historical visibility. A teacher must not be able to change the responsibility relation to acquire another Stage's protected information.

## 3. Teacher-facing behavior

The intended teacher can use the existing “Suivi des stages” flow for assigned Stages to view and edit the authorized fields. The date of the call or visit must be reachable there alongside the other trace fields. Preserve existing human-maintained layout unless the accepted transformation explicitly manages a specific part. The document owner reports having added the date to the visible follow-up sheet. Whether the same date is available to an assigned teacher through the LinkKey URL, and whether the ACL permits only the intended edits, still require a controlled browser test.

The teacher receives a specific follow-up URL from the `Enseignants` table. Its LinkKey and the application's ACL rules are intended to present an adapted interface containing only the Stages assigned to that teacher. J2 must preserve and verify this existing access path instead of replacing it with owner-level API access or a newly invented ACL.

## 4. Author attribution

`Suivi_par` is the *assigned teacher*, even if another authorized person edits the trace. The observed Stage schema does not establish a dedicated author or editor identity field. J2 must not claim that author identity is already stored or add an author column as if that had been requested. An actual author audit would need an explicit rule and verified implementation.

## 5. J2 evidence and remaining gate

The reference acceptance matrix must show, with controlled teacher identities and the supported LinkKey/browser path:

- an assigned teacher can enter, correct and clear the authorized contact date and trace fields on the Stage;
- another teacher cannot read or write protected follow-up data outside current responsibility;
- reassignment revokes the former teacher's responsibility-derived access while preserving the trace;
- missing, invalid and revoked LinkKeys deny the protected path according to the observed policy;
- the follow-up date appears in the teacher's actual LinkKey flow and is editable only with the intended permissions;
- repeating the accepted transformation does not duplicate fields, widgets, rules or records;
- the J1 execution engine handles protected effects, interruption, uncertainty and recovery.

Schema and page/widget IDs are partly observed, and the document owner reports that the date is now visible in the follow-up sheet. The actual ACL rule source, teacher browser permissions, resolved widget field mapping and dependency closure are not yet independently verified. These are fixture observations, not permission to invent a new policy or declare J2 complete. A controlled browser session using the teacher-specific URLs and an isolated test fixture are required before those critical verdicts can pass. Direct maintenance of the reference document's date column is **not** a J2 execution-engine proof.
