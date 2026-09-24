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

## Automated binding and evidence sequence

The J2-A/B/C/D dependency order and eligibility are fixed in [the roadmap](ROADMAP.md). Manual ACL transcription or hands-on test execution is not a prerequisite for implementing the bounded observation and test adapters.

1. **Observe access with owner authority (J2-A).** Read only the relevant ACL resources/rules, defaults, sharing and user-attribute dependencies through a dedicated internal adapter. Establish which constructs are visible on the tested Grist version. Interpret `Acces_Stages_Actif` only when a rule actually depends on it. Mark unsupported or inaccessible policy as `UNKNOWN`; do not publish raw formulas, literal secrets, LinkKeys or a generic `_grist_*` reader. An owner/API observation alone does not verify teacher behavior.
2. **Construct the independent fixture (J2-B).** Use fictional Stage/teacher identities and synthetic LinkKeys, never copies of real rows. Prepare both states: without `Date_du_contact` for the Builder to add, and with the date plus a human-modified layout for reconciliation. The accepted BehavioralContract determines expected outcomes independently of the observed ACLs. Bind the fixture's relevant normalized AccessModel, sharing, link-generation and UI dependencies to the reference; a mismatch remains `UNKNOWN`.
3. **Verify effective behavior (J2-C).** Use separate non-owner browser sessions for assigned teacher A, other teacher B, missing/invalid and revoked links. Check reading and writing through the supported teacher page, other reachable pages and Raw Data. Enter, replace, correct and clear the single trace on the same Stage, and verify that `Suivi_par` never changes. Include deliberate denied read/write and relation-tampering controls. Record the widget field mapping and required layout reconciliation. A passing synthetic scenario does not by itself verify the live DINUM teacher link.
4. **Transform through J1 (J2-D).** Record the exact `MANAGED`/`SHARED` regions, formulas, access dependencies and integrations in the accepted plan. On isolated fixtures only, add and expose the date in the absent state, reconcile the already present date and human layout in the other state, and verify existing rows, interruption, concurrency and rerun. Add an ACL write only if the observed policy actually requires it; that write needs its own bounded authorization and recovery design. A constructed pre-date fixture does not claim to reproduce the historical live state. The direct live schema edit is not Builder proof.

For each property, the fixture manifest must name its accepted contract version, role and scenario, expected result, setup/cleanup, checked UI/data surface, denial/control case, and evidence dependencies. A run records the fixture/document identity, tested revision or fingerprint, Grist version where observable, actual result, exact method and `VERIFIED`/`FAILED`/`UNKNOWN` verdict. Dependency changes invalidate affected evidence. Keep synthetic LinkKeys, full URLs and session secrets inside the verifier, including on failures and in logs; only bounded outcomes enter model-visible evidence.

## Property-to-proof checklist

This table specifies which proof must be produced, without asserting that any case already passed.

| Accepted properties | Required scenario and independently expected outcome | Admissible evidence |
|---|---|---|
| `STAGE-B1/B2/B10`, `STAGE-U1` | A enters, corrects and clears one trace on A's Stage; the same Stage survives, `Suivi_par` stays fixed, and the teacher sees the contact date. | Non-owner controlled browser plus stable Stage identity and bounded before/after assertions. |
| `STAGE-B3/B4/B5/B6`, `STAGE-A1/A3/A4` | B, missing/invalid key and revoked key cannot read/write A's protected Stage; neither an alternate page/Raw Data nor relation tampering grants access. | Separate browser sessions, positive A control and denied read/write controls; never substitute owner/API results. |
| `STAGE-A2`, `STAGE-B7/B8`, `STAGE-U3` | A date-absent fixture gains exactly one date field and UI placement without disclosure, loss or duplication; rerun converges. | J1 effect journal, pre/post schema/UI and stable-record assertions, browser checks around any access-relevant intermediate state. |
| `STAGE-U2`, `STAGE-H1/H2/H3`, `STAGE-C1` | Existing date and independent human layout/business/managed changes are reconciled or cause a safe suspension; no outside-scope overwrite. | Second fixture, injected concurrent edit, conflict classification and bounded before/after assertions. |
| `STAGE-R1/R2/R3/R4/R5` | Lost responses, partial effects and restart preserve known identifiers, avoid blind replay, and suspend if ambiguity remains. | Fault injection and durable journal replay through J1 on the isolated fixture. |
| `STAGE-B9` | Creating a new period does not duplicate Stages if period generation is in the actual impact graph. | Impact decision plus a fixture regression when impacted; document the excluded dependency when not impacted. |

A row passes only if every applicable property and its negative/control scenario has current evidence. A single green fixture run does not establish parity with the live document. Authorized observation must confirm the reference's relevant ACL/sharing, link-generation and UI binding; if actual live teacher-browser behavior remains inaccessible, record that production-specific claim as `UNKNOWN` and name the minimum access needed to resolve it.

## Evidence standard for the future test run

For each accepted property, record the tested fixture revision and Grist version (when observable), the acting test role/link scenario, the expected result, the observed result, and any inaccessible dependency. Test A and B links in separate sessions without owner privileges; include at least one deliberate denied read and denied write through the supported teacher browser path. A positive owner/API read or Grist “View As” display is useful for diagnosis but does not substitute for a teacher-link edit test: “View As” changes are recorded as the owner, and `user.LinkKey` is a web-client attribute rather than an API credential. Do not record raw LinkKey values or real student/teacher rows.

No J2 assurance verdict is complete while a property in the impacted critical dependency set remains unobserved. Passing this fixture demonstrates the stated scenarios at the observed revision; changes to ACLs, formulas, widgets, Grist version or access configuration require checking which evidence has become stale. An independent review should challenge the acceptance scenarios and evidence before declaring J2 complete.

The reference's structural state may evolve after this observation. Rebind and compare before any effectful J2 plan; do not hardcode these IDs into the general Builder.
