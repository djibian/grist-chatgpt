# J2 synthetic stage-tracking fixture

Status: **J2-B fixture/oracle foundation and partial structural provisioning; synthetic ACL/LinkKey execution and parity evidence still pending.**

This document defines the synthetic data states and independent expected-outcome matrix used by the stage-tracking reference scenario. The date-present structural fixture exists, but its LinkKey/ACL policy has not been executed or compared with the reference. Business expectations are not derived from observed ACL rules.

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
- historical contact-author binding absent;
- two fictional teachers with distinct LinkKey handles;
- a synthetic Stage assigned to A with an existing follow-up trace whose historical author is unknown;
- no date or historical author is invented for that legacy trace.

This state is intended to exercise the actual Builder addition when J2-D becomes eligible.

### `date-present-human-modified`

- contact-date field already present;
- historical contact-author binding still absent;
- existing synthetic contact date and follow-up content present;
- a human-layout marker represents unrelated/shared UI state that must be preserved;
- historical author remains unknown until a new contact is captured under the accepted rule.

This state exercises reconciliation with an already-satisfied structural property and legitimate human changes.

### Derived `managed-rerun` state

The manifest also contains a derived post-transformation verification state used only for the convergence/rerun oracle:

- contact-date field already present exactly once;
- historical contact-author binding already present exactly once;
- the human-modified business rows and layout marker are unchanged;
- the legacy trace's historical author remains unknown rather than being fabricated.

`TRANSFORM-RERUN` starts from this already managed state. It therefore tests a genuine second application of the same accepted intent, rather than accidentally testing the first addition of the historical-author binding again.

## Browser matrix

The manifest fixes BROW-A through BROW-G before any browser run:

| Scenario | Fixed expectation |
|---|---|
| BROW-A | assigned A can read/write the protected trace on the same Stage; trace editing cannot reassign the Stage |
| BROW-B | valid B cannot read/write A's protected Stage |
| BROW-C | missing/invalid LinkKey exposes no protected trace |
| BROW-D | revoked key loses protected access |
| BROW-E | teacher self-assignment/relation tampering is denied and cannot broaden access |
| BROW-F | after A records a contact, a separately authorized A → B reassignment preserves the single trace and author A; responsibility/access moves from A to B |
| BROW-G | the contact date is reachable/editable in the assigned teacher's intended follow-up UI |

BROW-F deliberately records two unresolved policies without weakening the accepted outcome:

- the exact actor/role authorized to initiate reassignment;
- whether a later B correction/replacement changes attribution of A's existing trace.

Those remain `UNKNOWN_POLICY`. The fixture does not invent answers.

## Transformation matrix

The manifest fixes expected transformation behavior for:

- date-absent initial state;
- date-present/human-modified initial state;
- a true rerun from the derived managed post-state.

Each expects exactly one contact-date field and one historical-author binding after the applicable transformation, no duplicated Stage/trace, no fabricated legacy author, preservation of business rows and untargeted schema, and preservation/reconciliation of the human layout.

## Binding requirements

Before a provisioned Grist fixture can claim parity for this scenario, it must bind at least:

- Stage table;
- current teacher relation;
- follow-up fields;
- historical contact-author binding;
- Teacher table;
- LinkKey user attribute;
- Stage AccessModel protection;
- teacher follow-up page/widget;
- contact-date field in that UI.

J2-A supplies normalized AccessModel evidence for the access portion once its controlled owner-authorized path is proven. Page/widget binding uses the existing semantic UI inspection surface. A mismatch or inaccessible dependency is `UNKNOWN`, not equivalence.

## Provisioning boundary

The currently connected Grist Community model-facing surface can discover and mutate bounded document/table/page objects, but it cannot create a disposable document or author/read raw ACL metadata through a public model operation. That limitation is intentional for the existing public contract.

Therefore this foundation does **not** mutate the real `suivi des stages chatgpt` document and does not repurpose unrelated test documents. The integrated internal provisioner receives an explicitly disposable, owner-controlled fixture; it does not create or publicly share a document. Before any ACL action, it must establish the exact `J2-stage-tracking-fixture` identity and owner access through Grist discovery, then verify the two fictional teacher and Stage identities and their assignments.

**The current connected fixture is readable by the model-facing Grist bridge:** its `Enseignants` rows can be queried with the shared owner credential. The tokens are still empty. Installing restrictive Grist ACL rules would not prevent that owner-credential bridge from returning newly written `Token_Stages` values to the model. Thus the fixture must first be excluded from every model-facing bridge path or recreated on an isolated test origin. A controlled negative probe against the configured bridge's strongest fixture read path must return `DENIED`; `READABLE`, an unavailable probe or other uncertainty blocks LinkKey generation and all ACL writes. An authentication failure or unavailable bridge is `UNKNOWN`, not `DENIED`. The provisioner now requires this explicit trusted isolation probe before calling the synthetic secret vault, and checks that its recent fixture/configuration fingerprint matches the configured bridge fingerprint. No live probe implementation or runtime wiring exists yet; an operator must bind the trusted probe to **every deployed model-facing read path** and invalidate its evidence whenever that configuration changes. Its test double is not live isolation evidence.

Only after that isolation evidence exists does the provisioner install the ACL rules before writing synthetic LinkKeys in its action sequence. A failed identity/shape/isolation check refuses the operation, and even a successful provision must still be followed by actual owner-observer and non-owner browser evidence.

The provisioner is J2 test infrastructure, not a mandate to expose generic document creation, raw `_grist_*` access or ACL authoring as a public MCP capability.
