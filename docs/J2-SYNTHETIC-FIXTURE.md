# J2 synthetic stage-tracking fixture

Status: **J2-B fixture/oracle foundation; disposable Grist provisioning and parity evidence still pending.**

This document defines the synthetic data states and independent expected-outcome matrix used by the stage-tracking reference scenario. It does not claim that a Grist fixture with the reference AccessModel has already been provisioned, and it does not derive business expectations from observed ACL rules.

The currently connected fixture is readable through the model-facing bridge. Do not provision LinkKeys there until it is isolated and a controlled negative read probe verifies the exact bridge configuration.

## Independent oracle

`src/j2/stageTrackingFixture.ts` is the executable fixture/oracle manifest. Its expected outcomes come from the accepted `docs/BEHAVIORAL-CONTRACT-STAGE-TRACKING.md` and `docs/J2-STAGE-TRACKING-ACCEPTED-SEMANTICS.md`.

The oracle is deliberately independent from:

- `AccessModelObserver` output;
- the current ACL formulas in the reference document;
- owner/API behavior;
- future browser observations.

Observed implementation evidence may prove or violate the oracle; it may not rewrite the oracle so that a failing implementation passes.

## Synthetic identities and secrets

The fixture contains only fictional teachers, students and Stages. It records logical LinkKey **handles**, never actual LinkKey values. A future controlled provisioner/browser verifier must inject distinct synthetic LinkKeys server-side and keep those values, URLs and cookies out of model output, audit payloads and repository files.

No real student or teacher row is copied into this fixture.

## Starting states

Two committed **initial** states are represented:

### `date-absent`

- contact-date field absent;
- two fictional teachers with distinct LinkKey handles;
- a synthetic Stage assigned to A with an existing follow-up trace;
- no date is invented for that legacy trace.

This state is intended to exercise the actual Builder addition when J2-D becomes eligible.

### `date-present-human-modified`

- contact-date field already present;
- existing synthetic contact date and follow-up content present;
- a human-layout marker represents unrelated/shared UI state that must be preserved;
- assignment A remains unchanged during contact editing.

This state exercises reconciliation with an already-satisfied structural property and legitimate human changes.

### Derived `managed-rerun` state

The manifest also contains a derived post-transformation verification state used only for the convergence/rerun oracle:

- contact-date field already present exactly once;
- the human-modified business rows and layout marker are unchanged;
- no additional author field is introduced.

`TRANSFORM-RERUN` starts from this already managed state. It tests a second application of the accepted intent without requiring another schema change.

## Browser matrix

The manifest fixes BROW-A through BROW-G before any browser run:

| Scenario | Fixed expectation |
|---|---|
| BROW-A | assigned A can read/write the protected trace on the same Stage; trace editing cannot reassign the Stage |
| BROW-B | valid B cannot read/write A's protected Stage |
| BROW-C | missing/invalid LinkKey exposes no protected trace |
| BROW-D | revoked key loses protected access |
| BROW-E | teacher self-assignment/relation tampering is denied and cannot broaden access |
| BROW-F | A records, corrects and clears a contact; the Stage and assignment A persist and B's separate link stays denied |
| BROW-G | the contact date is reachable/editable in the assigned teacher's intended follow-up UI |

BROW-F verifies that trace editing leaves `Suivi_par` unchanged. It does not require an author-history column.

## Transformation matrix

The manifest fixes expected transformation behavior for:

- date-absent initial state;
- date-present/human-modified initial state;
- a true rerun from the derived managed post-state.

Each expects exactly one contact-date field after the applicable transformation, no additional author field, no duplicated Stage/trace, preservation of business rows and untargeted schema, and preservation/reconciliation of the human layout.

## Binding requirements

Before a provisioned Grist fixture can claim parity for this scenario, it must bind at least:

- Stage table;
- current teacher relation;
- follow-up fields;
- Teacher table;
- LinkKey user attribute;
- Stage AccessModel protection;
- teacher follow-up page/widget;
- contact-date field in that UI.

J2-A supplies normalized AccessModel evidence for the access portion once its controlled owner-authorized path is proven. Page/widget binding uses the existing semantic UI inspection surface. A mismatch or inaccessible dependency is `UNKNOWN`, not equivalence.

## Provisioning boundary

The currently connected Grist Community model-facing surface can discover and mutate bounded document/table/page objects, but it cannot create a disposable document or author/read raw ACL metadata through a public model operation. That limitation is intentional for the existing public contract.

Therefore this foundation does **not** mutate the real `suivi des stages chatgpt` document and does not repurpose unrelated test documents. A later internal/test provisioner must create or receive an explicitly disposable owner-controlled document, install only the minimum synthetic schema/UI/access dependencies, inject secret LinkKeys server-side, then bind the resulting document to this immutable expected matrix.

The provisioner is J2 test infrastructure, not a mandate to expose generic document creation, raw `_grist_*` access or ACL authoring as a public MCP capability.
