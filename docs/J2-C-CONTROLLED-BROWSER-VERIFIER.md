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

## Fixed scenarios

The core consumes the independent `J2_STAGE_TRACKING_BROWSER_ORACLE`; it cannot rewrite expected outcomes from observed browser behavior.

It orchestrates:

- BROW-A: assigned teacher A can read/write the protected trace while assignment writes remain denied;
- BROW-B: teacher B is denied on the teacher flow, an alternate reachable view, and Raw Data;
- BROW-C: missing and invalid LinkKeys are tested in separate sessions and both must deny;
- BROW-D: a revoked LinkKey must deny;
- BROW-E: relation/self-assignment tampering remains denied;
- BROW-F: A enters, corrects and clears the trace on the same Stage with `Suivi_par` unchanged, then B remains denied;
- BROW-G: the contact date is reachable/editable in A's teacher flow while assignment writes remain denied.

The explicit alternate-view and Raw Data checks are deliberate negative controls: merely observing a filtered teacher sheet is not enough to prove isolation.

## Evidence semantics

Evidence contains only bounded identifiers and outcomes: fixture identity/revision marker, Grist version, contract version, scenario/property IDs, expected/observed booleans or ALLOW/DENY/UNKNOWN values, completeness, verdict and timestamp.

- any definite mismatch is `VIOLATED`;
- browser/session uncertainty, unsupported state or incomplete closure is `UNKNOWN`;
- `VERIFIED` requires every expected comparison and required denial control to complete successfully;
- exceptions are intentionally discarded rather than copied into evidence, because browser errors may contain secret URLs or tokens.

Closing a browser session is part of completeness. A close failure cannot silently produce complete evidence.

## Remaining J2-C work

This foundation is necessary but not sufficient for J2-C completion. A later reviewable slice must add the concrete internal Grist browser adapter and operator command, bound to a configured isolated fixture and server-held synthetic links. That adapter must fail closed on selector/version ambiguity and must not become a model-facing generic browser tool.

Only after J2-B has fresh isolation/provisioning evidence may the concrete verifier be run against the synthetic fixture. A local fixture pass still does not by itself prove the DINUM/reference teacher path.

## Reference review

Reference classification: **REIMPLEMENT**.

The design was checked against the official `gristlabs/grist-core` browser-test conventions. In particular, Grist's own nbrowser tests exercise Raw Data through a dedicated `.test-tools-raw` UI control and use test-oriented DOM markers. Those conventions support using a real browser for the negative/control path, but no Grist test-helper implementation is copied here. The future adapter should reuse stable supported/test markers only where they are confirmed for the target Grist version and otherwise return `UNKNOWN`.
