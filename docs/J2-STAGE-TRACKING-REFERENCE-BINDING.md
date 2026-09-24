# J2 reference application binding and evidence gaps

Status: **structural observation plus user-confirmed sheet display; teacher ACL/browser and Builder execution proofs pending**.

Reference: the Grist document named “suivi des stages chatgpt”. This is one application fixture for the generic Builder. This document records schema and page metadata only; no student, teacher or Stage row values were read or copied into the repository. The live document identifier and LinkKey tokens are deliberately omitted from this public repository.

## Observed Stage follow-up

| Logical role | Grist identity | Observed type/behavior |
|---|---|---|
| Stage | `Stages` | existing table |
| assigned teacher | `Stages.Suivi_par` | editable `Ref:Enseignants` |
| contact type | `Stages.Type_de_contact` | editable Choice: `Appel`, `Visite` |
| contact date | `Stages.Date_du_contact` | editable Date, display `DD/MM/YYYY`; added directly to live reference on 2026-09-24 |
| implication | `Stages.Implication` | editable Choice |
| punctuality | `Stages.Ponctuel` | editable Choice |
| comment | `Stages.Commentaire` | editable Text |
| placement dates | `Stages.Date_de_debut_modifiee`, `Stages.Date_de_fin_modifiee` | separate editable Date columns; neither is the contact date |

`Date_du_contact` is a genuine non-formula Date column. It can remain blank for records created before the change. The document owner reports that the date was subsequently placed in the visible follow-up sheet. This report is not a controlled test of teacher permissions or J1 engine execution. The existing schema has a single set of current trace fields on each Stage; a per-contact history and actual editor/author audit were not observed. `Suivi_par` is the assigned teacher and attributed business author in this non-reassignment workflow; it is not a technical editor audit.

## Observed navigation and UI metadata

| Element | Observation | Limit |
|---|---|---|
| `Enseignants.Lien_Stages` | formula builds a teacher-specific self-link to page 8 using `LinkKey_Token=$Token_Stages` | no token value inspected or published; ACL rule source and effective behavior unverified |
| page 8, “Suivi des stages” | two native widgets, 31 (`record`) and 37 (`single`), both sourced from `Stages` | owner reports date displayed in the sheet; teacher-specific display and permissions unverified |
| widget 37 | selected by widget 31 and has an explicit layout of field references | date placement reported by owner, but its numeric field mapping and teacher visibility are not resolved by the connector |

## User-confirmed access flow

The document owner reports that each teacher obtains a specific URL from the `Enseignants` table. Grist LinkKeys plus the document's ACL rules present an adapted interface and display only the Stages assigned to that teacher. The owner also reports adding `Date_du_contact` to the follow-up sheet after the schema change. These observations define the expected teacher workflow; they do not by themselves establish the exact ACL formulas or negative/revocation behavior. LinkKey token values must remain out of repository documents, logs and model-facing results.

## Required binding/evidence before J2 execution

1. Inspect the exact Grist access rules and `user.LinkKey` attributes, including invalid and revoked LinkKey behavior; owner/API access is insufficient.
2. With authorized controlled browser sessions for teacher-specific links, confirm that `Date_du_contact` appears and is editable only for the assigned teacher; record the precise widget field mapping and any necessary layout reconciliation.
3. Use synthetic Stage/teacher identities and their distinct LinkKey URLs to test assigned, non-assigned, invalid-key, revoked-key and relation-tampering cases, including edit/correct/clear of the trace and verification that `Suivi_par` remains unchanged.
4. Record the widget field mapping, exact `MANAGED`/`SHARED` regions, formulas, access dependencies and any custom integrations touched by the proposed change.
5. In an isolated fixture, execute and verify the accepted transformation through the J1 effect boundary, including interruption, concurrency and idempotent rerun. Do not treat the direct live schema edit as this proof.

The reference's structural state may evolve after this observation. Rebind and compare before any effectful J2 plan; do not hardcode these IDs into the general Builder.
