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
| teacher access flag | `Enseignants.Acces_Stages_Actif` | editable Bool observed; whether/how ACLs consult it remains unknown |

`Date_du_contact` is a genuine non-formula Date column. It can remain blank for records created before the change. The document owner reports that the date was subsequently placed in the visible follow-up sheet. This report is not a controlled test of teacher permissions or J1 engine execution. The existing schema has a single set of current trace fields on each Stage, and the owner confirms this one editable trace is sufficient. A per-contact history and actual editor/author audit were not observed and are not required for J2. `Suivi_par` is the assigned teacher and attributed business author in this non-reassignment workflow; it is not a technical editor audit.

## Observed navigation and UI metadata

| Element | Observation | Limit |
|---|---|---|
| `Enseignants.Lien_Stages` | formula builds a teacher-specific self-link to page 8 using `LinkKey_Token=$Token_Stages` | no token value inspected or published; ACL rule source and effective behavior unverified |
| page 8, “Suivi des stages” | two native widgets, 31 (`record`) and 37 (`single`), both sourced from `Stages` | owner reports date displayed in the sheet; teacher-specific display and permissions unverified |
| widget 37 | selected by widget 31 and has an explicit layout of field references | date placement reported by owner, but its numeric field mapping and teacher visibility are not resolved by the connector |

## User-confirmed access flow

The document owner reports that each teacher obtains a specific URL from the `Enseignants` table. Grist LinkKeys plus the document's ACL rules present an adapted interface and display only the Stages assigned to that teacher. The owner also reports adding `Date_du_contact` to the follow-up sheet after the schema change. These observations define the expected teacher workflow; they do not by themselves establish the exact ACL formulas, whether `Acces_Stages_Actif` is consulted, or negative/revocation behavior. LinkKey token values must remain out of repository documents, logs and model-facing results.

## Current assurance boundary

| Claim | Evidence available | Current verdict |
|---|---|---|
| One editable contact trace per Stage is sufficient | owner decision plus one observed set of Stage fields | ACCEPTED business behavior; OBSERVED structure |
| Contact date is an editable `Stages` Date field | schema metadata and owner-confirmed placement in the sheet | OBSERVED; teacher-link display still UNKNOWN |
| Teacher links enforce the intended access | link formula observed; owner describes the workflow | ACL source, permissions and negative cases UNKNOWN |
| `Acces_Stages_Actif` revokes a teacher link | Bool field observed, no ACL rule read | UNKNOWN; do not infer its effect from its name |
| Builder can safely reproduce/maintain the result | J1 synthetic engine proof only | J2 execution on an isolated fixture UNKNOWN |

## Required binding/evidence before J2 execution

1. Inspect the exact Grist access rules, public-sharing role and `user.LinkKey` attributes, including whether `Acces_Stages_Actif` participates in access and how invalid or revoked keys behave; owner/API access is insufficient.
2. With authorized controlled browser sessions for teacher-specific links, confirm that `Date_du_contact` appears and is editable only for the assigned teacher; record the precise widget field mapping and any necessary layout reconciliation.
3. Use synthetic Stage/teacher identities and their distinct LinkKey URLs to test assigned, non-assigned, invalid-key, revoked-key and relation-tampering cases, including entry/replacement/correction/clearing of the sole trace on the same Stage and verification that `Suivi_par` remains unchanged. Check other reachable pages and Raw Data for unintended disclosure, rather than equating a filtered sheet with authorization.
4. Record the widget field mapping, exact `MANAGED`/`SHARED` regions, formulas, access dependencies and any custom integrations touched by the proposed change.
5. In isolated synthetic fixtures, test both starting states: without the date, the Builder must add and expose it while preserving access and existing rows; with the date already present, it must reconcile human layout and rerun without duplication. Execute needed effects through J1, including interruption and concurrency. A constructed pre-date fixture is representative evidence, not a claim to have reproduced the exact historical live state. Do not treat the direct live schema edit as a Builder proof.

## Evidence standard for the future test run

For each accepted property, record the tested fixture revision and Grist version (when observable), the acting test role/link scenario, the expected result, the observed result, and any inaccessible dependency. Test A and B links in separate sessions without owner privileges; include at least one deliberate denied read and denied write through the supported teacher browser path. A positive owner/API read or Grist “View As” display is useful for diagnosis but does not substitute for a teacher-link edit test: “View As” changes are recorded as the owner, and `user.LinkKey` is a web-client attribute rather than an API credential. Do not record raw LinkKey values or real student/teacher rows.

No J2 assurance verdict is complete while a property in the impacted critical dependency set remains unobserved. Passing this fixture demonstrates the stated scenarios at the observed revision; changes to ACLs, formulas, widgets, Grist version or access configuration require checking which evidence has become stale. An independent review should challenge the acceptance scenarios and evidence before declaring J2 complete.

The reference's structural state may evolve after this observation. Rebind and compare before any effectful J2 plan; do not hardcode these IDs into the general Builder.
