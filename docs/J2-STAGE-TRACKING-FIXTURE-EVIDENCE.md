# J2 stage-tracking fixture provisioning evidence

Status: **PARTIAL J2-B evidence — structural/data/UI fixture provisioned; AccessModel/LinkKey binding not yet proven.**

Date: 2026-09-24  
Repository baseline: `main` `4571a700eba03ac318eda57a5f0c07c28900f4a2`

This evidence records a controlled provisioning step performed against the explicitly disposable, owner-controlled Grist Community document named `J2-stage-tracking-fixture` in the `ChatGPT` workspace. It does not mutate or claim parity with the live `suivi des stages chatgpt` document.

## Evidence obtained

A pre-mutation semantic inspection showed the disposable document contained only the default `Table1` with three default columns and no relevant stage-tracking structure.

The controlled fixture was then provisioned with the minimum currently reachable synthetic structure needed for the committed J2 scenario:

- `Enseignants` table with stable synthetic fixture IDs, fictional names, `Token_Stages`, and `Acces_Stages_Actif`;
- `Stages` table with stable synthetic fixture IDs, a fictional student label, `Suivi_par -> Enseignants`, the follow-up fields `Type_de_contact`, `Date_du_contact`, `Ponctuel`, `Implication`, `Commentaire`, and `Auteur_du_contact -> Enseignants`;
- fictional teacher A and teacher B rows only;
- fictional stage A assigned to teacher A with the committed human-modified synthetic follow-up values and no fabricated historical author;
- fictional stage B assigned to teacher B with an empty trace;
- a `Suivi des stages` page backed by `Stages`, with a record widget and a selected single-record follow-up widget.

A post-provisioning semantic inspection verified:

- `Stages.Suivi_par` resolves as `Ref:Enseignants`;
- `Stages.Auteur_du_contact` resolves as `Ref:Enseignants`;
- `Date_du_contact` exists as a real `Date` column;
- the `Suivi des stages` page exists;
- both page widgets are backed by `Stages`;
- the single-record widget is directly selected by the stage-list widget;
- the two committed synthetic stage rows exist with the expected teacher assignments and business values.

The pre-existing default `Table1` was deliberately left untouched because its deletion is not required for the scenario and would add an unnecessary destructive action.

## Secret minimization

No real teacher/student data was copied into the fixture.

The two `Token_Stages` cells remain empty. No actual LinkKey value, token URL, cookie, credential, or access-rule literal was supplied through the model-facing connector or recorded in repository evidence.

Future synthetic LinkKeys must be injected through a server-side controlled path and must remain absent from model output, repository files, and ordinary audit payloads.

## What this does **not** prove

This step does not complete J2-B and does not unlock a parity claim.

Still missing:

1. owner-scoped normalized AccessModel observation from J2-A against the controlled fixture;
2. installation/verification of the synthetic LinkKey user attribute and stage-protection rules through an internal/test-only path;
3. secret server-side injection of distinct teacher A/B LinkKeys;
4. proof that the fixture's access dependencies match the fixed oracle rather than merely its visible schema/UI shape;
5. the separate date-absent transformation starting state needed by J2-D;
6. controlled browser execution of BROW-A through BROW-G (J2-C).

Until those items are evidenced, access-related bindings remain `UNKNOWN`; owner/API success must not be treated as teacher-policy proof.

## Binding status

| Required binding | Current evidence |
| --- | --- |
| `Stage.table` | PROVISIONED |
| `Stage.currentTeacherRelation` | PROVISIONED (`Suivi_par`) |
| `Stage.followUpFields` | PROVISIONED |
| `Stage.historicalContactAuthorBinding` | PROVISIONED structurally (`Auteur_du_contact`), behavioral semantics unverified |
| `Teacher.table` | PROVISIONED |
| `Teacher.linkKeyAttribute` | PLACEHOLDER ONLY; no secret key injected |
| `AccessModel.stageProtection` | UNKNOWN |
| `UI.teacherFollowUpPage` | PROVISIONED structurally |
| `UI.teacherFollowUpWidget` | PROVISIONED structurally |
| `UI.contactDateField` | COLUMN PRESENT; browser reachability/editability not yet verified |

This evidence is descriptive implementation evidence only. The expected outcomes remain those fixed independently in `src/j2/stageTrackingFixture.ts` and the accepted BehavioralContract.