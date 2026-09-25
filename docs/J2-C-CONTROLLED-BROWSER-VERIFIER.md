# J2-C controlled browser verifier core

Status: **integrated diagnostic foundation; no live browser evidence yet; not a mandatory J2 platform dependency.**

This component implements a bounded evidence/orchestration core originally designed for the full BROW-A through BROW-G matrix. It does not expose browser control through MCP or GPT Actions and it does not claim that the stage-tracking reference or any fixture has passed those scenarios.

After the J2 Design Compression Review, the fixed full-matrix core is **broader than the minimum proof required for the contact-date transformation**. The authoritative roadmap and BehavioralContract now require the targeted affected-path browser proof: responsible teacher A, distinct unassigned teacher B including Raw Data, and no-key denial; invalid-key/revocation/relation-tampering/additional-view cases are required only when the transformation's ImpactGraph reaches those properties. Existing broader scenarios remain useful diagnostic capability and must not be reported as verified unless actually run.

## Boundary

`src/j2/stageTrackingBrowserVerifier.ts` accepts only a restricted server-side `J2ControlledBrowserSessionFactory`. The verifier itself never accepts or returns:

- arbitrary URLs or origins;
- LinkKeys, cookies, bearer tokens or API keys;
- JavaScript snippets;
- CSS/XPath selectors;
- generic browser commands;
- screenshots or business row contents.

Any concrete Grist browser adapter must receive operational details from protected server-side configuration, bind them to one configured controlled test application, and implement only the narrow session operations needed by the accepted proof. J2 does **not** require building a custom browser/CDP platform when a smaller controlled path can produce the required evidence.

Mutating session methods return **both** the browser access decision and a checked application postcondition. `ALLOW + APPLIED` means the intended deterministic trace mutation was persisted; `DENY + NOT_APPLIED` means a definitive refusal and confirmed non-application. An allowed click or HTTP response without an exact postcondition is `application: UNKNOWN`, and cannot produce `VERIFIED`. This allows negative scenarios to establish unchanged Stage/assignment state without requiring a forbidden protected read merely to prove non-mutation. A concrete adapter must verify postconditions through permitted fixture authority without leaking protected content to another browser principal.

The existing test-only `revokeTeacherALinkKey()` operation is bounded to the configured isolated fixture. If the full legacy oracle is executed, BROW-D still requires an observed positive before revocation, exact revocation postcondition, and a new denied browser session; response loss remains `UNKNOWN` without blind retry. Under the compressed J2 proof, however, revocation is not a mandatory date-transformation test unless the observed dependency closure reaches LinkKey lifecycle behavior.

## Existing fixed scenarios

The integrated core consumes `J2_STAGE_TRACKING_BROWSER_ORACLE`; it cannot rewrite expected outcomes from observed browser behavior. It can orchestrate:

- BROW-A: assigned teacher A can read/write the protected trace while assignment writes remain denied;
- BROW-B: teacher B is denied on the teacher flow, an alternate reachable view, and Raw Data;
- BROW-C: missing and invalid LinkKeys are tested in separate sessions and both must deny;
- BROW-D: a previously valid LinkKey, explicitly revoked on the isolated fixture, must then deny;
- BROW-E: relation/self-assignment tampering remains denied;
- BROW-F: A enters, corrects and clears the trace on the same Stage with `Suivi_par` unchanged, then B remains denied;
- BROW-G: the contact date is reachable/editable in A's teacher flow while assignment writes remain denied.

These remain implemented diagnostics, not a statement that all seven are current J2 prerequisites. The targeted minimum may reuse the relevant A/B/C/F/G mechanics without extending the core or forcing execution of D/E when they are outside the change closure. Raw Data remains mandatory for the B negative because a filtered teacher sheet alone is not proof of isolation.

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
- expected and observed ALLOW/DENY/UNKNOWN or boolean outcomes;
- completeness, verdict, reason codes, method and timestamp.

When BROW-D is used, evidence additionally requires an observed positive before revocation and a confirmed server-side revocation effect. Acting context, criticality and evidence-input descriptors are derived from the accepted oracle/contract, never from browser content. They contain no LinkKey values, URLs, cookies or business-row contents.

Verdict rules remain:

- any definite mismatch is `VIOLATED`;
- a definite contrary access observation takes precedence over uncertainty in another session or view;
- browser/session uncertainty, unsupported state or incomplete closure is `UNKNOWN`;
- `VERIFIED` requires every expected comparison and required denial control for the executed scenario to complete successfully;
- after the first `UNKNOWN` or `VIOLATED` scenario, later scenarios in that run are not executed against a potentially changed fixture and receive `UNKNOWN` with `PRIOR_SCENARIO_NOT_VERIFIED`;
- exceptions are intentionally discarded rather than copied into evidence, because browser errors may contain secret URLs or tokens.

Closing a browser session is part of completeness. A close failure cannot silently produce complete evidence.

## Role in the compressed J2 path

The next product proof is the actual J1-backed date/UI transformation on a sanitized realistic copy. A concrete browser adapter is eligible only to the extent needed to produce J2-V1's smallest affected-path evidence. PR #158's broader custom CDP transport is therefore not a prerequisite in its current scope.

If this core is reused, adapt or wrap it minimally; do not generalize it into arbitrary browsing. If a smaller controlled mechanism can produce the required A/B/no-key evidence, the full BROW-A…G executor may remain dormant diagnostic code.

Any secret-bearing test application must satisfy the isolation invariant in the roadmap for the full lifetime of LinkKeys. A controlled-copy pass still does not by itself prove the live DINUM/reference teacher path; reference-specific claims require current binding/parity evidence.

## Reference review

Reference classification: **REIMPLEMENT**.

The design was checked against the official `gristlabs/grist-core` browser-test conventions. In particular, Grist's own nbrowser tests exercise Raw Data through a dedicated `.test-tools-raw` UI control and use test-oriented DOM markers. Those conventions support using a real browser for the negative/control path, but no Grist test-helper implementation is copied here. Any concrete adapter should reuse stable supported/test markers only where they are confirmed for the target Grist version and otherwise return `UNKNOWN`.