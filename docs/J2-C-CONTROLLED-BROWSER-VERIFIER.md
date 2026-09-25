# J2-C controlled browser verifier core

Status: **implementation foundation only; no live browser evidence yet**.

This component implements the bounded evidence/orchestration core for roadmap slice J2-C. It does not expose browser control through MCP or GPT Actions and it does not claim that the stage-tracking fixture has passed BROW-A through BROW-G.

## Boundary

`src/j2/stageTrackingBrowserVerifier.ts` accepts only a restricted server-side `J2ControlledBrowserSessionFactory`. The verifier itself never accepts or returns:

- arbitrary URLs or origins;
- LinkKeys, cookies, bearer tokens or API keys;
- JavaScript snippets;
- CSS/XPath selectors;
- generic browser commands;
- screenshots or business row contents.

A future concrete Grist browser adapter must receive those operational details from protected server-side configuration, bind them to one configured synthetic fixture, and implement only the narrow session operations declared by this port.

Mutating session methods return **both** the browser access decision and a checked application postcondition. `ALLOW + APPLIED` means the intended deterministic trace mutation was persisted (including the expected correction, clearing or contact-date value); `DENY + NOT_APPLIED` means a definitive refusal and confirmed non-application. An allowed click or HTTP response without an exact postcondition is `application: UNKNOWN`, and cannot produce `VERIFIED`. This allows negative scenarios to establish unchanged Stage/assignment state without requiring a forbidden protected read merely to prove non-mutation. The concrete adapter must verify postconditions through the permitted fixture authority without leaking protected content to a different browser principal.

The test-only `revokeTeacherALinkKey()` operation is bounded to the configured isolated fixture and the same server-held key used by the positive `teacher-a` and post-revocation `revoked-key` sessions. It may return `APPLIED` only after an exact revocation postcondition; response loss or ambiguity returns `UNKNOWN` without a blind retry. The verifier runs BROW-D **last**, first observing that this same key could read Stage A, then revoking it and checking denial through a new browser session. Evidence remains in the oracle's BROW-A…G order. This order keeps the earlier teacher A positive controls meaningful. The eventual adapter must bind the pre/post observations and relevant fixture revision to the same key and fail closed if it cannot do so.

## Fixed scenarios

The core consumes the independent `J2_STAGE_TRACKING_BROWSER_ORACLE`; it cannot rewrite expected outcomes from observed browser behavior.

It orchestrates:

- BROW-A: assigned teacher A can read/write the protected trace while assignment writes remain denied;
- BROW-B: teacher B is denied on the teacher flow, an alternate reachable view, and Raw Data;
- BROW-C: missing and invalid LinkKeys are tested in separate sessions and both must deny;
- BROW-D: a previously valid LinkKey, explicitly revoked on the isolated fixture, must then deny;
- BROW-E: relation/self-assignment tampering remains denied;
- BROW-F: A enters, corrects and clears the trace on the same Stage with `Suivi_par` unchanged, then B remains denied;
- BROW-G: the contact date is reachable/editable in A's teacher flow while assignment writes remain denied.

The explicit alternate-view and Raw Data checks are deliberate negative controls: merely observing a filtered teacher sheet is not enough to prove isolation.

## Evidence semantics

The accepted evidence version is fixed in code as `j2-stage-tracking-accepted-v1`. Callers cannot relabel the fixed oracle with an arbitrary contract version.

Each scenario evidence record contains only bounded, non-secret provenance and outcomes:

- fixture identity and revision marker;
- Grist version;
- accepted contract version;
- scenario and property IDs;
- acting/tested LinkKey context from the fixed oracle;
- accepted criticality for every referenced property;
- the bounded evidence inputs used by that scenario, including required negative controls;
- for BROW-D, an observed positive before revocation and a confirmed server-side revocation effect;
- expected and observed ALLOW/DENY/UNKNOWN or boolean outcomes;
- completeness, verdict, reason codes, method and timestamp.

The acting context, criticality and evidence-input descriptors are derived from the accepted oracle/contract, never from browser content. They contain no LinkKey values, URLs, cookies or business-row contents.

Verdict rules:

- any definite mismatch is `VIOLATED`;
- a definite contrary access observation takes precedence over uncertainty in another session or view;
- browser/session uncertainty, unsupported state or incomplete closure is `UNKNOWN`;
- `VERIFIED` requires every expected comparison and required denial control to complete successfully;
- after the first `UNKNOWN` or `VIOLATED` scenario, later scenarios are not executed against a potentially changed fixture and receive `UNKNOWN` with `PRIOR_SCENARIO_NOT_VERIFIED`;
- exceptions are intentionally discarded rather than copied into evidence, because browser errors may contain secret URLs or tokens.

Closing a browser session is part of completeness. A close failure cannot silently produce complete evidence.

## Remaining J2-C work

This foundation is necessary but not sufficient for J2-C completion. A later reviewable slice must add the concrete internal Grist browser adapter and operator command, bound to a configured isolated fixture and server-held synthetic links. That adapter must fail closed on selector/version ambiguity and must not become a model-facing generic browser tool.

Only after J2-B has fresh isolation/provisioning evidence may the concrete verifier be run against the synthetic fixture. A local fixture pass still does not by itself prove the DINUM/reference teacher path.

## Reference review

Reference classification: **REIMPLEMENT**.

The design was checked against the official `gristlabs/grist-core` browser-test conventions. In particular, Grist's own nbrowser tests exercise Raw Data through a dedicated `.test-tools-raw` UI control and use test-oriented DOM markers. Those conventions support using a real browser for the negative/control path, but no Grist test-helper implementation is copied here. The future adapter should reuse stable supported/test markers only where they are confirmed for the target Grist version and otherwise return `UNKNOWN`.
