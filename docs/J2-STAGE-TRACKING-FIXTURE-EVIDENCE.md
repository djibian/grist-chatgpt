# J2 stage-tracking fixture provisioning evidence

Status: **PARTIAL J2-B evidence — date-present structural/data/UI fixture provisioned; AccessModel/LinkKey binding not yet proven.**

Date: 2026-09-24  
Repository baseline: `main` `4571a700eba03ac318eda57a5f0c07c28900f4a2`

This evidence records a controlled provisioning step performed against the explicitly disposable, owner-controlled Grist Community document named `J2-stage-tracking-fixture` in the `ChatGPT` workspace. It does not mutate or claim parity with the live `suivi des stages chatgpt` document.

## Evidence obtained

A pre-mutation semantic inspection showed the disposable document contained only the default `Table1` with three default columns and no relevant stage-tracking structure.

The controlled fixture was provisioned with the minimum currently reachable synthetic structure for the committed `date-present-human-modified` starting state:

- `Enseignants` table with stable synthetic fixture IDs, fictional names, `Token_Stages`, and `Acces_Stages_Actif`;
- `Stages` table with stable synthetic fixture IDs, a fictional student label, `Suivi_par -> Enseignants`, and the follow-up fields `Type_de_contact`, `Date_du_contact`, `Ponctuel`, `Implication`, `Commentaire`;
- fictional teacher A and teacher B rows only;
- fictional stage A assigned to teacher A with the committed human-modified synthetic follow-up values;
- fictional stage B assigned to teacher B with an empty trace;
- a `Suivi des stages` page backed by `Stages`, with a record widget and a selected single-record follow-up widget.

During the controlled run, an `Auteur_du_contact -> Enseignants` column was initially added and then explicitly removed because it was empty and outside the starting fixture shape. The subsequent owner clarification removed reassignment from this workflow: J2-D no longer requires adding a historical-author binding. This preserves the observed sequence while updating the expected transformation.

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

Future synthetic LinkKeys must be injected through a server-side controlled path and must remain absent from model output, repository files, and ordinary audit payloads. The currently connected fixture can be read by the model-facing bridge; it must be isolated and a controlled negative read must pass before any key is inserted.

## Fresh model-facing isolation observation — 2026-09-25

Controller recovery against exact repository `main` `ce71a68be2dbdf724326823a0996010c0fb0f94b` rechecked the disposable fixture through the connected model-facing Grist Community surface.

Observed fixture identity:

- workspace: `ChatGPT`;
- document: `J2-stage-tracking-fixture`;
- document ID: `ejwdJoXmDVuZWbo8mtwCAq`.

The model-facing document discovery surface listed that exact fixture as available, and a bounded `query_records` call against `Enseignants` succeeded and returned the synthetic `teacher-a` row. Therefore the current model-facing path is **READABLE**, not isolated. This is a definitive negative result for the provisioning precondition: no synthetic LinkKey seed may be evaluated and no LinkKey/ACL provisioning may proceed while this bridge configuration can address and read the fixture.

A model-facing attempt to query `_grist_ACLRules` was rejected by the bridge's internal-metadata boundary. That rejection is the expected public-surface behavior and does **not** satisfy J2-A: owner-scoped normalized AccessModel observation still requires the dedicated internal owner-authorized observer/operator path.

The next admissible J2-B step is environmental, not a model-facing mutation: place the fixture outside the deployed model-facing resource boundary exactly as required by `docs/J2-MODEL-FACING-ISOLATION-PROBE.md` (separate test origin, or a same-origin document-only allowlist configuration that statically excludes this exact document with no workspace allowlist), then run the protected operator command and obtain a fresh `DENIED` isolation verdict before provisioning secrets or ACLs.

No LinkKey, API key, cookie, token URL, ACL literal, or non-synthetic business data was read or recorded by this observation.

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
| `Stage.followUpFields` | PROVISIONED for the date-present starting state |
| `Teacher.table` | PROVISIONED |
| `Teacher.linkKeyAttribute` | PLACEHOLDER ONLY; no secret key injected |
| `AccessModel.stageProtection` | UNKNOWN |
| `UI.teacherFollowUpPage` | PROVISIONED structurally |
| `UI.teacherFollowUpWidget` | PROVISIONED structurally |
| `UI.contactDateField` | COLUMN PRESENT; browser reachability/editability not yet verified |

This evidence is descriptive implementation evidence only. The expected outcomes remain those fixed independently in `src/j2/stageTrackingFixture.ts` and the accepted BehavioralContract.
