# J2-C controlled browser verifier

Status: **bounded implementation present; live browser evidence still gated by J2-B fixture isolation/provisioning**.

This slice implements both the fixed BROW-A…BROW-G evidence/orchestration core and an internal Grist/Chromium adapter. It does not expose browser control through MCP or GPT Actions and it does not claim that the stage-tracking fixture has passed the browser matrix.

## Boundary

`src/j2/stageTrackingBrowserVerifier.ts` accepts only a restricted server-side `J2ControlledBrowserSessionFactory`. The verifier never accepts or returns arbitrary URLs/origins, LinkKeys/cookies/API keys, caller-supplied JavaScript/selectors, generic browser commands, screenshots or business-row contents.

`src/j2/stageTrackingGristBrowserAdapter.ts` implements that port for exactly one operator-configured synthetic fixture. Its configuration is bounded to one Grist origin, one exact document ID/path, one teacher page reference, one alternate page reference and the reviewed selector profile `grist-core-b393db7`. Unsupported selector profiles fail closed.

`src/j2/chromiumCdpPipe.ts` launches a fresh headless Chromium profile on `about:blank` and controls it only through a private `--remote-debugging-pipe`. Secret Grist URLs are sent after process launch through that pipe, so LinkKeys are not placed in Chromium argv. The transport exposes only navigation, fixed-expression evaluation, bounded text insertion and a tiny fixed-key set to the J2 adapter; it is not a generic model-facing browser capability.

Mutating session methods return **both** the browser access decision and a checked application postcondition. `ALLOW + APPLIED` means the intended deterministic trace mutation was persisted; `DENY + NOT_APPLIED` means a definitive UI refusal/non-reachability plus a confirmed unchanged fixture state. Unverifiable effects remain `UNKNOWN`. Postconditions are checked through the owner-authorized fixture API, never by leaking protected content into another browser principal.

The test-only `revokeTeacherALinkKey()` is a one-shot owner effect. It verifies the exact precondition, sends at most one update, then resolves even an ambiguous response by one post-read. It never blindly retries. The old server-held key is retained only in memory for the later `revoked-key` browser session.

## Operator command and mandatory preconditions

`npm run j2:verify-browser` runs `tools/j2-browser-verify.ts`. It requires protected operator configuration including:

- `J2_OWNER_AUTHORIZED=YES`;
- exact fixture document ID and Grist origin/path;
- owner Grist API key distinct from the model-facing bridge key;
- dedicated synthetic LinkKey seed;
- teacher and alternate page refs;
- Chromium executable;
- bounded Grist version marker;
- `J2_GRIST_BROWSER_SELECTOR_PROFILE=grist-core-b393db7`.

Before deriving any synthetic LinkKey or launching Chromium, the command reconstructs the deployed model-facing bridge resource policy and executes the strongest model-facing read probe against the fixture. The verdict must be freshly `DENIED`. `READABLE` or `UNKNOWN` refuses execution. The command then requires the fixture to contain the exact already-provisioned server-held synthetic keys and active teacher identities.

This means the currently documented READABLE fixture cannot be exercised by this command. The environment must first satisfy the J2-B isolation gate and then rerun bounded synthetic access provisioning.

## Fixed scenarios

The core consumes the independent `J2_STAGE_TRACKING_BROWSER_ORACLE`; observed browser behavior cannot rewrite expectations.

- BROW-A: assigned A can read/write the protected trace while assignment writes remain denied.
- BROW-B: B is denied on the teacher flow, an alternate reachable view and Raw Data.
- BROW-C: missing and invalid LinkKeys are tested in separate sessions and both deny.
- BROW-D: the same A key is observed working, revoked server-side, then denied in a fresh session.
- BROW-E: relation/self-assignment tampering remains denied.
- BROW-F: A enters, corrects and clears a trace on the same Stage with `Suivi_par` unchanged, then B remains denied.
- BROW-G: the contact date is reachable/editable in A's teacher flow while assignment writes remain denied.

The alternate-view and Raw Data checks are deliberate negative controls: a filtered teacher sheet alone is insufficient evidence of isolation.

## Evidence semantics

The accepted evidence version is fixed as `j2-stage-tracking-accepted-v1`. Evidence contains only bounded non-secret provenance and outcomes: fixture identity/revision fingerprint, Grist version, scenario/property IDs, fixed acting context, accepted criticality, expected/observed ALLOW/DENY/UNKNOWN values, completeness, reason codes and timestamp.

Any definite mismatch is `VIOLATED`; uncertainty is `UNKNOWN`; `VERIFIED` requires every fixed comparison and negative control to complete. After the first `UNKNOWN` or `VIOLATED` scenario, later scenarios are not executed against a potentially changed fixture. Exceptions are intentionally collapsed to non-secret failure states rather than copied into evidence.

## Remaining J2-C work

Implementation is reviewable, but J2-C is not complete until the real disposable fixture can produce fresh accepted browser evidence. That live run is blocked by the current J2-B environmental isolation gate, not by missing generic browser capability.

A successful isolated synthetic-fixture pass still does not by itself prove the DINUM/reference teacher path; reference parity remains a separate evidence question.

## Reference review

Reference classification: **REIMPLEMENT**.

The adapter was checked against `gristlabs/grist-core` at commit `b393db7ba2e45ecb47fb8734c2d9d185152ce20d`. Grist documents `LinkKey_NAME` URL parameters as `NAME_`, assigns browser link parameters to `user.LinkKey`, and its nbrowser suite uses `.test-tools-raw`, `.test-raw-data-*`, `.g_record_detail_*`, `.g-column-label`, `.gridview_row` and `.field_clip` markers for the relevant UI paths. The implementation reuses those reviewed conventions but copies no Grist browser-helper implementation. Selector/profile mismatch or UI ambiguity fails to `UNKNOWN` rather than manufacturing proof.
