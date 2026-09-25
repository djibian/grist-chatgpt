# J2 reference application binding and evidence gaps

Status: **structural observation plus user-confirmed sheet display; targeted teacher ACL/browser and Builder execution proofs pending**.

Reference: the Grist document named “suivi des stages chatgpt”. This is one application fixture for the generic Builder. This document records schema and page metadata only; no student, teacher or Stage row values were read or copied into the repository. The live document identifier and LinkKey tokens are deliberately omitted from this public repository.

## Observed Stage follow-up

| Logical role | Grist identity | Observed type/behavior |
|---|---|---|
| Stage | `Stages` | existing table |
| assigned teacher | `Stages.Suivi_par` | editable `Ref:Enseignants`; accepted follow-up workflow leaves this relation unchanged |
| contact type | `Stages.Type_de_contact` | editable Choice: `Appel`, `Visite` |
| contact date | `Stages.Date_du_contact` | editable Date, display `DD/MM/YYYY`; added directly to live reference on 2026-09-24 |
| implication | `Stages.Implication` | editable Choice |
| punctuality | `Stages.Ponctuel` | editable Choice |
| comment | `Stages.Commentaire` | editable Text |
| placement dates | `Stages.Date_de_debut_modifiee`, `Stages.Date_de_fin_modifiee` | separate editable Date columns; neither is the contact date |
| teacher access flag | `Enseignants.Acces_Stages_Actif` | editable Bool observed; whether/how ACLs consult it remains unknown |

`Date_du_contact` is a genuine non-formula Date column. It can remain blank for records created before the change. The document owner reports that the date was subsequently placed in the visible follow-up sheet. This report is not a controlled test of teacher permissions or J1 engine execution. The existing schema has a single set of current trace fields on each Stage, and the owner confirms this one editable trace is sufficient. A per-contact history and technical editor audit were not observed or required. The assigned teacher is the business author when recording a contact; the accepted workflow does not reassign the Stage. Existing rows must not be assigned a guessed author.

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
| Assignment remains unchanged during follow-up | owner decision: no reassignment; `Suivi_par` observed | ACCEPTED behavior; teacher browser enforcement UNKNOWN |
| Contact date is an editable `Stages` Date field | schema metadata and owner-confirmed placement in the sheet | OBSERVED; teacher-link display still UNKNOWN |
| Teacher links enforce the intended access | link formula observed; owner describes the workflow | relevant ACL source, permissions and negative cases UNKNOWN |
| `Acces_Stages_Actif` revokes a teacher link | Bool field observed, no ACL rule read | UNKNOWN; do not infer its effect from its name |
| Builder can safely reproduce/maintain the result | J1 synthetic engine proof only | J2 schema/UI execution on a controlled realistic copy UNKNOWN |

## Compressed binding and proof sequence

The authoritative sequence is now the compressed J2 path in `docs/ROADMAP.md`; the former mandatory J2-A → J2-B → J2-C → J2-D chain is superseded. Observation, transformation and targeted verification may overlap where their real dependencies allow it.

1. **Bind the relevant closure (J2-R1).** With explicit owner authority, observe only the Stage/date/UI/access/share/link facts that the contact-date change can reach. The internal `AccessModelObserver` may be used when helpful, but broad ACL normalization is not a product goal. Unsupported or inaccessible relevant constructs remain `UNKNOWN`; raw formulas, literals, LinkKeys and credentials stay server-side.
2. **Prepare one safe realistic copy with two independent checkpoints.** Use fictional rows and preserve the relevant existing policy/UI rather than installing the repository's fixed synthetic 13-rule policy as a substitute. Prepare a date-absent checkpoint for the actual Builder change and an independently prepared date-present/human-edited checkpoint for adoption/reconciliation. A reference/copy mismatch remains `UNKNOWN`; it is not repaired by rewriting the oracle.
3. **Transform through J1 (J2-T1).** Record exact `MANAGED`/`SHARED` targets and execute the minimum date-column/UI-placement effects through the J1 execution engine. Leave `Suivi_par`, business rows and ACLs unchanged when the bound Stage policy already protects the field. Add an ACL write only if the observed policy actually requires one, under a separately reviewed bounded effect contract.
4. **Verify the affected browser path (J2-V1).** Use separate non-owner sessions for responsible teacher A, distinct teacher B and no-key. A must reach/edit/correct/clear the date on the same Stage with unchanged assignment; B must be denied on the affected teacher page and Raw Data; no-key must expose no protected follow-up. Add invalid-key, revocation, relation-tampering or alternate-view cases only when the actual ImpactGraph reaches those accepted properties. A controlled-copy pass does not by itself verify the live DINUM teacher link.
5. **Exercise recovery/concurrency/rerun (J2-R2).** Run the independent date-present/human-edited first Builder execution, inject one lost-response/restart boundary and one relevant concurrent human change, then perform a true rerun on already managed state. Preserve legitimate data/layout, avoid blind replay and duplicates, and suspend on ambiguity/conflict.

The test application must satisfy the secret-isolation invariant for the full lifetime of any LinkKeys. Prefer a separate test origin with no model-facing bridge. If same-origin testing is ever used, follow the exact exclusive-window constraints in the roadmap/BehavioralContract; the currently model-readable fixture remains barred from tokens.

For each property used in a J2 acceptance verdict, evidence names the accepted contract version, acting scenario, expected result, setup/cleanup, checked UI/data surface and dependencies. A run records exact fixture/document identity, tested revision/fingerprint, Grist version where observable, actual result, method and `VERIFIED`/`VIOLATED`/`UNKNOWN` verdict. Dependency changes invalidate affected evidence. Keep synthetic LinkKeys, full URLs and session secrets inside the verifier, including on failures and in logs.

## Property-to-proof checklist

This table specifies the compressed proof obligation without asserting that any case already passed.

| Accepted properties | Required scenario and independently expected outcome | Admissible evidence |
|---|---|---|
| `STAGE-B1/B2/B10`, `STAGE-U1` | A enters, corrects and clears one trace including date while the Stage and assignment A stay unchanged. | Non-owner controlled browser plus stable Stage identity/assignment before/after. |
| `STAGE-B3/B4`, `STAGE-A1/A3/A4` | B cannot read/edit A's protected trace on the affected teacher page or Raw Data; no-key exposes no protected data. | Separate browser sessions, positive A control and denied B/no-key controls; never substitute owner/API results. |
| `STAGE-B5/B6` | Revocation and relation tampering remain accepted application properties. | Required in this J2 run only when the actual impact/dependency closure reaches token lifecycle or the writable assignment relation; otherwise remain explicitly unverified. |
| `STAGE-A2`, `STAGE-B7/B8`, `STAGE-U3` | Date-absent state gains exactly one date field/UI placement without disclosure, loss or duplication; true rerun converges. | J1 effect journal, pre/post schema/UI and stable-record assertions, targeted browser proof for impacted access. |
| `STAGE-U2`, `STAGE-H1/H2/H3`, `STAGE-C1` | Independent date-present/human-edited first run and injected concurrent change are preserved/reconciled or cause safe suspension. | Independent checkpoint, conflict classification and bounded before/after assertions. |
| `STAGE-R1/R2/R3/R4/R5` | Lost response/restart retains known effects, avoids blind replay and suspends when ambiguity remains. | Fault injection and durable J1 journal/recovery evidence on the controlled copy. |
| `STAGE-B9` | Creating a new period does not duplicate Stages if period generation is in the actual impact graph. | Impact decision plus regression only when impacted; otherwise record exclusion. |

A row passes only if every applicable property in the transformation closure has current evidence. Unexecuted broader application properties remain `UNKNOWN` rather than being silently treated as successful. Authorized observation must confirm the reference's relevant access/share/link/UI binding for any reference-specific claim; if that binding remains inaccessible, the isolated engineering result may still be valid but the reference-specific claim stays `UNKNOWN`.

## Evidence standard for the future test run

For each accepted property in the impacted closure, record the tested copy revision and Grist version (when observable), the acting test role/link scenario, expected result, observed result, and any inaccessible dependency. Test A and B links in separate sessions without owner privileges; include a deliberate B denial on Raw Data and a no-key denial. A positive owner/API read or Grist “View As” display is useful for diagnosis but does not substitute for a teacher-link edit test: “View As” changes are recorded as the owner, and `user.LinkKey` is a web-client attribute rather than an API credential. Do not record raw LinkKey values or real student/teacher rows.

No J2 assurance verdict is complete while a property in the impacted critical dependency set remains unobserved. Passing the controlled copy demonstrates only the stated scenarios at the observed revision. Changes to ACLs, formulas, widgets, Grist version or access configuration require checking which evidence has become stale. An independent review must challenge the intent-to-plan-to-effect-to-evidence chain before declaring J2 complete.

The reference's structural state may evolve after this observation. Rebind and compare before any reference-specific claim; do not hardcode these IDs into the general Builder.