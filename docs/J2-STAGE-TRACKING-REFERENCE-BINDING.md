# J2 reference application binding and evidence gaps

Status: **partial structural observation, not an ACL/UI or Builder execution proof**.

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

`Date_du_contact` is a genuine non-formula Date column. It can remain blank for records created before the change. The direct column addition is **not** evidence of correct UI placement, teacher permissions or J1 engine execution. The existing schema has a single set of current trace fields on each Stage; a per-contact history and actual editor/author audit were not observed. `Suivi_par` is an assignment, not author attribution.

## Observed navigation and UI metadata

| Element | Observation | Limit |
|---|---|---|
| `Enseignants.Lien_Stages` | formula builds a self-link to page 8 using `LinkKey_Token=$Token_Stages` | no token value inspected or published; rule semantics unverified |
| page 8, “Suivi des stages” | two native widgets, 31 (`record`) and 37 (`single`), both sourced from `Stages` | teacher-facing display and actual permissions unverified |
| widget 37 | selected by widget 31 and has an explicit layout of field references | new contact date's inclusion in the card unverified; connector does not expose resolved field mapping |

## Required binding/evidence before J2 execution

1. Inspect the exact Grist access rules and `user.LinkKey` attributes, including revoked and reassigned teacher behavior; owner/API access is insufficient.
2. With an authorized controlled browser session, confirm where `Date_du_contact` appears in page 8 and make it visible/editable in the intended teacher-facing sheet if absent.
3. Use synthetic Stage/teacher identities to test assigned, non-assigned, invalid-key, revoked-key, relation-tampering and reassignment cases, including edit/correct/clear of the trace.
4. Record the widget field mapping, exact `MANAGED`/`SHARED` regions, formulas, access dependencies and any custom integrations touched by the proposed change.
5. In an isolated fixture, execute and verify the accepted transformation through the J1 effect boundary, including interruption, concurrency and idempotent rerun. Do not treat the direct live schema edit as this proof.

The reference's structural state may evolve after this observation. Rebind and compare before any effectful J2 plan; do not hardcode these IDs into the general Builder.
