# J2 stage-tracking fixture provisioning evidence

Status: **historical partial fixture evidence — useful structural observation; not the authoritative J2 proof path.**

Date: 2026-09-24  
Repository baseline: `main` `4571a700eba03ac318eda57a5f0c07c28900f4a2`

This evidence records a controlled provisioning step performed against the explicitly disposable, owner-controlled Grist Community document named `J2-stage-tracking-fixture` in the `ChatGPT` workspace. It does not mutate or claim parity with the live `suivi des stages chatgpt` document.

The J2 Design Compression Review subsequently changed the authoritative completion path. This document remains valid evidence of what was actually provisioned/observed; it must not be read as requiring the synthetic fixture's fixed ACL policy, the old J2-A/B/C/D prerequisite chain, or a full BROW-A…G run before the actual J1-backed date/UI transformation can be implemented.

## Evidence obtained

A pre-mutation semantic inspection showed the disposable document contained only the default `Table1` with three default columns and no relevant stage-tracking structure.

The controlled fixture was provisioned with the minimum currently reachable synthetic structure for the then-committed `date-present-human-modified` starting state:

- `Enseignants` table with stable synthetic fixture IDs, fictional names, `Token_Stages`, and `Acces_Stages_Actif`;
- `Stages` table with stable synthetic fixture IDs, a fictional student label, `Suivi_par -> Enseignants`, and the follow-up fields `Type_de_contact`, `Date_du_contact`, `Ponctuel`, `Implication`, `Commentaire`;
- fictional teacher A and teacher B rows only;
- fictional stage A assigned to teacher A with the committed human-modified synthetic follow-up values;
- fictional stage B assigned to teacher B with an empty trace;
- a `Suivi des stages` page backed by `Stages`, with a record widget and a selected single-record follow-up widget.

During the controlled run, an `Auteur_du_contact -> Enseignants` column was initially added and then explicitly removed because it was empty and outside the starting fixture shape. The subsequent owner clarification removed reassignment from this workflow: J2 no longer requires adding a historical-author binding. This preserves the observed sequence while updating the expected transformation.

Post-correction inspection/reads verified:

- `Stages.Suivi_par` resolves as `Ref:Enseignants`;
- `Date_du_contact` exists as a real `Date` column;
- no historical contact-author binding is pre-provisioned in this starting state;
- the `Suivi des stages` page exists;
- both page widgets are backed by `Stages`;
- the single-record widget is directly selected by the stage-list widget;
- the two committed synthetic stage rows exist with the expected teacher assignments and business values.

The pre-existing default `Table1` was deliberately left untouched because its deletion is not required for the scenario and would add an unnecessary destructive action.

## Secret minimization

No real teacher/student data was copied into the fixture.

The two `Token_Stages` cells remain empty. No actual LinkKey value, token URL, cookie, credential, or access-rule literal was supplied through the model-facing connector or recorded in repository evidence.

Synthetic LinkKeys must be injected only through a server-side controlled path and must remain absent from model output, repository files, and ordinary audit payloads. The authoritative invariant is now the whole-window rule in `docs/ROADMAP.md` and the BehavioralContract: a secret-bearing test application must remain unreachable from every model-facing bridge read path for the full lifetime of its LinkKeys. The currently connected fixture is readable and therefore remains barred from LinkKeys.

## Fresh model-facing isolation observation — 2026-09-25

Controller recovery against exact repository `main` `ce71a68be2dbdf724326823a0996010c0fb0f94b` rechecked the disposable fixture through the connected model-facing Grist Community surface.

Observed fixture identity:

- workspace: `ChatGPT`;
- document: `J2-stage-tracking-fixture`;
- document ID: `ejwdJoXmDVuZWbo8mtwCAq`.

The model-facing document discovery surface listed that exact fixture as available, and a bounded `query_records` call against `Enseignants` succeeded and returned the synthetic `teacher-a` row. Therefore the current model-facing path is **READABLE**, not isolated. This remains a definitive negative result: no synthetic LinkKey seed may be evaluated and no LinkKey/ACL provisioning may proceed in this document while this bridge configuration can address and read it.

A model-facing attempt to query `_grist_ACLRules` was rejected by the bridge's internal-metadata boundary. That rejection is the expected public-surface behavior and is not owner-scoped AccessModel evidence.

No LinkKey, API key, cookie, token URL, ACL literal, or non-synthetic business data was read or recorded by this observation.

## Effect of design compression

The old next step stated that this exact fixture had to be moved outside the static bridge resource boundary and then receive the repository's fixed synthetic ACL/LinkKey policy. That is no longer an authoritative J2 prerequisite.

The current roadmap instead requires one sanitized controlled **realistic copy** whose relevant schema/UI/access/share/link dependencies correspond to the reference, plus two independent initial checkpoints: date absent and date present with legitimate human edits. The existing synthetic fixture may be reused only where it actually satisfies that requirement; otherwise keep this evidence historical and build the safer realistic copy without treating the fixed 13-rule synthetic policy as reference parity.

If the existing `j2:provision-synthetic-access` path is used for diagnostics, its stricter fresh-`DENIED` precondition still applies exactly as documented in `J2-MODEL-FACING-ISOLATION-PROBE.md`. A successful run would prove only that provisioning path, not preservation of the reference application's policy.

## What this does **not** prove

This historical evidence does not prove:

1. the reference application's relevant normalized AccessModel/sharing/link dependencies;
2. that the fixed synthetic ACL policy matches or preserves the reference policy;
3. teacher-specific contact-date access through the supported browser path;
4. the independent date-absent starting checkpoint required for the actual J1-backed change;
5. first-run reconciliation from an independently prepared date-present/human-edited state;
6. J1 interruption/concurrency/rerun behavior for the J2 schema/UI transformation.

Those unknowns must remain explicit. Owner/API success must not be treated as teacher-policy proof.

## Binding status

| Required binding | Current evidence |
| --- | --- |
| `Stage.table` | PROVISIONED in this historical synthetic fixture |
| `Stage.currentTeacherRelation` | PROVISIONED (`Suivi_par`) |
| `Stage.followUpFields` | PROVISIONED for the date-present starting state |
| `Teacher.table` | PROVISIONED |
| `Teacher.linkKeyAttribute` | PLACEHOLDER ONLY; no secret key injected |
| `AccessModel.stageProtection` | UNKNOWN relative to reference |
| `UI.teacherFollowUpPage` | PROVISIONED structurally |
| `UI.teacherFollowUpWidget` | PROVISIONED structurally |
| `UI.contactDateField` | COLUMN PRESENT; browser reachability/editability not yet verified |

This evidence is descriptive implementation history only. Expected outcomes remain fixed independently by the accepted BehavioralContract; current eligibility and proof order are controlled by `docs/ROADMAP.md`.