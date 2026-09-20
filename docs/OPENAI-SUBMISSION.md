# OpenAI plugin submission plan

**Status:** current plan aligned with OpenAI documentation rechecked 2026-09-19 and pre-review support clarification obtained 2026-09-20.

See also `docs/PLUGIN-READY-AUDIT.md` for the current readiness matrix and blocking gaps and `docs/OPENAI-REVIEWER-TESTS.md` for the canonical reviewer-test specification.

## Intended submission

The intended first public product is a **remote MCP-only plugin**:

```text
Primary public contract : MCP
Custom UI               : none initially
Skills                   : none initially
MCP URL model            : universal single production endpoint
Target Grist edition     : Grist Community
Initial service target   : one configured DINUM / La Suite numérique Grist Community instance
```

The plugin is not intended to duplicate Grist's official MCP/OAuth integration where that exists and is sufficient. It adds identity, authorization, per-user credential isolation, bounded semantic operations and safety controls for the Community deployment target.

## Publication eligibility path

OpenAI's current plugin guidelines require authorized third-party access and state that plugins whose primary function is acting as unofficial connectors to third-party services, including intermediary relay layers, cannot be approved.

A real MCP-only draft was created in the OpenAI portal on 2026-09-20. The current MCP hostname was successfully domain-verified and Tool Scan completed successfully. OpenAI AI-assisted support then declined to pre-confirm eligibility outside the actual review and stated that final classification is determined during review.

After receiving the concrete architecture, support mapped the fixed single-instance design, finite Grist-specific semantic tools and lack of arbitrary HTTP/REST forwarding as **materially different from a generic relay/proxy or usual pass-through intermediary**. It also warned that reviewers may still apply the primary-function test and view the product as principally connecting ChatGPT to Grist. Explicit Grist/operator permission can reduce policy risk but does not by itself guarantee approval or override that primary-function test.

Operational consequence: there is no separate pre-review `PASS` available for S0. The actual public review is the decision point. This is **not an approval** and must never be represented as one.

Submission copy must therefore describe the distinct bounded product workflow accurately — inspecting, structuring and maintaining Grist documents with semantic, verified operations and server-side safety controls — rather than presenting the product as a generic “Grist connector”. The repository remains explicitly independent/non-official unless a durable authorization basis says otherwise.

Issue #58 records the durable clarification. Any Grist Labs / DINUM / La Suite numérique or operator permission and branding basis must be factual, separately evidenced and no broader than what was actually granted.

## Product security model to preserve

### ChatGPT/Codex -> bridge

OAuth 2.1/MCP authentication produces a dynamic principal with only the fixed public capabilities:

```text
doc:read
doc:write
doc.schema:write
```

C4-P0 already demonstrates JWT/JWKS validation, issuer/resource/expiry enforcement, scope reduction, dynamic principals, RFC 9728 metadata/challenge, CIMD, PKCE, RFC 8707 binding and real ChatGPT Developer Mode operation through Logto OSS federated to ProConnect.

### Bridge -> Grist Community

Production target:

> every authenticated bridge user executes upstream Grist operations with that user's own Grist API key.

The key is collected only through a separate secure bridge-owned onboarding flow. It must never appear in MCP tool inputs/results, prompts, logs, audit payloads or errors.

Effective authority remains:

```text
current user's Grist permissions
∩ deployment resource policy
∩ principal resource grants
∩ OAuth capability required by the operation
```

The current personal/development deployment still uses one server-side Grist API key; C5 must replace that before production multi-user operation.

## Current official submission requirements

Final remote-MCP review requires, among other portal fields:

### Publisher and listing

- verified OpenAI developer/business identity;
- App Management Write permission for the submitter;
- final name/descriptions/logo/category;
- HTTPS website/support/privacy/terms URLs;
- availability countries/regions;
- release notes;
- up to three starter prompts.

### MCP server

- stable production HTTPS MCP endpoint;
- current successful Tool Scan;
- domain ownership verification through the portal-issued challenge token;
- exact public tool names/descriptions/schemas;
- explicit `readOnlyHint`, `openWorldHint`, `destructiveHint` plus justifications;
- minimized tool inputs/outputs without authentication secrets or unnecessary internal diagnostics.

### OAuth

For the final OAuth client/reviewer path, prove:

- OIDC discovery;
- `openid` and `email` advertised and enabled;
- UserInfo returns `email` and `email_verified: true`;
- reviewer login works with provided demo credentials;
- reviewer login requires no inaccessible MFA, SMS/email confirmation, private network or additional setup.

The normal production user identity can remain ProConnect-backed while the bounded reviewer path satisfies the review requirement without weakening normal access.

### Reviewer package

The final remote-MCP package requires exactly:

- **5 positive** test cases;
- **3 negative** test cases;
- explicit expected behavior;
- reviewer instructions;
- synthetic data only;
- isolated reviewer identity/credential;
- demo recording URL.

## Canonical reviewer scenarios — specification complete

`docs/OPENAI-REVIEWER-TESTS.md` is the canonical human-readable specification. `chatgpt-app-submission.json` carries the corresponding import/portal representation and repository tests lock the exact 5+3 shape.

The five positive cases cover:

1. structural inspection without unnecessary row disclosure;
2. bounded filtering/sorting plus deterministic no-match behavior;
3. bounded record creation followed by ID-based verification;
4. bounded schema creation/update followed by metadata verification;
5. page/widget creation plus safe select-by and re-read verification.

The three submission negatives are non-invocation cases for unrelated personal-calendar access, arbitrary HTTP forwarding and Grist account/ACL administration.

Runtime security tests such as insufficient OAuth scope/resource access or invalid UI links remain separate because they test supported Grist intents after tool selection rather than submission routing/refusal behavior.

The specification is complete; the reviewer account/document is not yet claimed provisioned and the eight cases have not yet been executed against a final C7 environment.

## Domain verification — current draft verified

`OPENAI_APPS_CHALLENGE_TOKEN` is optional runtime configuration.

- when unset, the challenge route is absent;
- when configured with the exact valid single-line portal token, `/.well-known/openai-apps-challenge` returns only that token as plain text;
- surrounding whitespace/line breaks are rejected rather than silently normalized;
- no token belongs in source control, tool data, `/healthz`, OpenAPI or logs.

On 2026-09-20 the real portal-issued token was configured only in the protected deployment environment, the current `grist-chatgpt.loeildumaitre.fr` hostname was successfully verified in the portal, and the token remained out of the repository. If the final production hostname changes, repeat domain verification for that final hostname instead of assuming this draft verification transfers.

## Submission-specific status

### Already prepared

- registry-derived MCP annotation values and justifications;
- tracked `chatgpt-app-submission.json` with 23 tools;
- exact canonical 5-positive / 3-negative reviewer specification plus repository tests;
- optional exact-token domain challenge endpoint;
- multiple model-facing output-minimization slices;
- real ChatGPT OAuth interoperability POC;
- real OpenAI MCP-only draft created;
- current draft hostname successfully domain-verified;
- current Tool Scan completed successfully, with non-blocking `outputSchema` recommendations remaining as contract-quality follow-up;
- pre-review support clarification recorded in issue #58: no pre-approval is available, the architecture is materially different from a generic pass-through proxy, and the primary-function classification remains a review-time decision.

### Low-risk work that may proceed independently

- prove the final Logto reviewer/client UserInfo path returns `email` + `email_verified: true`;
- continue bounded public-output normalization where it materially reduces unnecessary upstream/internal fields while preserving functional IDs;
- keep the tracked submission artifact aligned with the normative operation registry/public contract;
- maintain reviewer-test documentation if the bounded public contract changes;
- keep listing copy aligned with the actual bounded workflow and independent/non-official status;
- document only the factual rights/permission/branding basis that exists for the intended target deployment.

### Must resolve before final review

- C4 production deployment/rotation/outage evidence;
- C5 per-user Grist credential storage/retrieval/disconnect;
- per-principal rate limiting and remaining C6 operational controls;
- final production endpoint;
- reviewer login without secondary-verification dependency;
- isolated synthetic Grist reviewer fixture;
- public website/support/privacy/terms;
- publisher identity/app-management permission;
- demo recording;
- current Tool Scan on the final endpoint;
- final-host domain challenge verification if the production hostname differs;
- a defensible factual permission/rights basis for operating against the intended Grist deployment and using any submitted branding, without implying affiliation.

Final public eligibility itself cannot be resolved before review because OpenAI support states that the actual review performs that classification.

## Portal sequence

A real draft already exists. Once the production/reviewer environment is ready:

1. Update the existing OpenAI MCP-only draft rather than creating a parallel submission.
2. Set the final production universal MCP URL.
3. Configure OAuth and provide reviewer demo credentials/instructions.
4. If the final hostname differs from the currently verified draft host, configure only the exact portal-issued challenge token for that host, deploy it and complete domain verification again.
5. Run Tool Scan on the final endpoint and resolve blocking findings; treat `outputSchema` recommendations as bounded contract-quality work rather than inventing unstable schemas.
6. Fill public listing metadata/policy URLs/availability/release notes/starter prompts using bounded-workflow positioning and accurate affiliation language.
7. Add the canonical exact 5 positive and 3 negative tests with expected behavior and the demo recording URL.
8. Submit for review. This review is the final S0 eligibility decision point.
9. Record the review outcome durably. Remediate concrete findings without weakening security invariants or inventing an official relationship.
10. Publish only after approval and an explicit release decision.

## Go / no-go

Proceed to public review only when both are true:

- **defensible submission basis:** the listing accurately describes the bounded workflow, fixed single-instance target and independent status; the factual rights/permission/branding basis is documented; no known policy fact is being hidden or overstated;
- **technical/reviewer readiness:** production OAuth, per-user Grist credential lifecycle, reviewer identity/fixture, UserInfo, final-host domain verification, Tool Scan, operational controls and exact review artifacts are complete.

Do **not** represent the OpenAI support exchange, successful draft creation, domain verification or Tool Scan as public-directory approval. Approval remains contingent on the actual review.

Official references to re-check immediately before submission:

- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/build/auth

## Prepared import draft

`chatgpt-app-submission.json` follows the current prepared import format and contains 23 tools, five positive scenarios and three negative non-invocation scenarios.

Its listing copy now presents `grist-chatgpt` as a bounded document-design/maintenance workflow rather than a generic connector while retaining explicit independent/non-official language.

Remote MCP only; no distributed skills or Apps SDK UI. The production MCP URL is supplied in the portal rather than invented as a field in the tracked JSON.

### Proposed synthetic fixture (not provisioned)

The current reviewer specification expects one isolated synthetic document with a `ReviewTasks` table containing `Title` and `Status`, at least three rows with `Status = Open`, no row titled `NoSuchSyntheticTask`, at least one Ref relationship, and existing page/widget context. The reviewer needs the three existing scopes on that isolated document.

Start each run from the documented clean fixture and use an operator-managed reset. Never replay a partial/ambiguous write merely to reset a scenario.

## Output-schema follow-up

Formal MCP `outputSchema` remains incomplete for several non-UI tools. The current portal Tool Scan succeeds but recommends `outputSchema` for affected tools. Recent data-minimization work means many record/schema update/delete service results are already semantic bounded acknowledgements rather than raw upstream payloads, but formal schemas should be added only when the normalized result contract is intentionally stable. Creation tools must preserve the functional created identifiers needed for later calls while avoiding unnecessary engine-only data.
