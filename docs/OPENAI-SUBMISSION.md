# OpenAI plugin submission plan

**Status:** current plan aligned with the repository's 2026-09-20 pre-review clarification evidence.

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

## Public-review eligibility status

OpenAI's current plugin guidelines remain relevant to third-party access and unofficial connectors. The repository remains explicitly independent/non-official and must not claim a Grist Labs, DINUM / La Suite numérique or OpenAI relationship unless one is actually established.

Issue #58 records the 2026-09-20 pre-review clarification attempt and current portal evidence:

- a real MCP-only draft was created;
- `grist-chatgpt.loeildumaitre.fr` was successfully domain-verified;
- the portal Tool Scan completed successfully;
- OpenAI AI-assisted support would not pre-confirm public eligibility and stated that final classification happens during actual app/plugin review;
- after receiving the concrete bounded architecture, support described it as materially different from a generic relay/proxy while noting that the final reviewer can still apply the primary-function test.

This is **not an approval**. It means there is no separate pre-review approval mechanism to wait for before preparing a legitimate reviewer environment and final package. Public approval remains an external review outcome.

Submission copy should describe the product's concrete bounded workflows, authorization/safety semantics and fixed deployment target rather than market it as a generic “Grist connector”. Any Grist Labs/DINUM permission or branding evidence must remain separate, factual and non-invented.

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

## Domain verification — implementation and current draft verification complete

`OPENAI_APPS_CHALLENGE_TOKEN` is optional.

- when unset, the challenge route is absent;
- when configured with the exact valid single-line portal token, `/.well-known/openai-apps-challenge` returns only that token as plain text;
- surrounding whitespace/line breaks are rejected rather than silently normalized;
- no token belongs in source control, tool data, `/healthz`, OpenAPI or logs.

Issue #58 records successful domain verification for the real MCP-only draft. The secret challenge token itself is intentionally not recorded. Re-run verification only if the final portal/deployment requires it.

## Submission-specific status

### Already prepared / externally exercised

- registry-derived MCP annotation values and justifications;
- tracked `chatgpt-app-submission.json` with 23 tools;
- exact canonical 5-positive / 3-negative reviewer specification plus repository tests;
- optional exact-token domain challenge endpoint;
- multiple model-facing output-minimization slices;
- real ChatGPT OAuth interoperability POC;
- real MCP-only submission draft;
- successful domain verification for `grist-chatgpt.loeildumaitre.fr`;
- successful portal Tool Scan for the current draft, as recorded in issue #58.

### Low-risk work that may proceed independently

- prove the final Logto reviewer/client UserInfo path returns `email` + `email_verified: true`;
- keep the tracked submission artifact aligned with the normative operation registry/public contract;
- maintain reviewer-test documentation if the bounded public contract changes;
- keep public positioning accurate: independent/non-official, bounded product/workflow, no generic relay claims.

### Must resolve before actual final review

- C4 production deployment/rotation/outage evidence;
- C5 per-user Grist credential storage/retrieval/disconnect;
- per-principal rate limiting and remaining C6 operational controls;
- final production endpoint;
- reviewer login without secondary-verification dependency;
- isolated synthetic Grist reviewer fixture;
- final reviewer-path UserInfo evidence;
- public website/support/privacy/terms;
- publisher identity/app-management permission;
- demo recording;
- any final Tool Scan/domain re-verification needed after deployment/contract changes.

There is no longer a separate requirement to obtain an unavailable OpenAI pre-approval before preparing C7/C8. The actual OpenAI review determines the unresolved public-eligibility question.

## Portal sequence

Once the production/reviewer environment is ready:

1. Open or update the real OpenAI MCP-only submission draft.
2. Use the production universal MCP URL.
3. Configure OAuth and provide reviewer demo credentials/instructions.
4. If the portal requires renewed domain verification, configure only the exact portal-issued challenge token, deploy it, verify the well-known response, then complete portal verification.
5. Run/refresh Tool Scan against the exact final endpoint and resolve blocking findings.
6. Fill public listing metadata/policy URLs/availability/release notes/starter prompts.
7. Add the canonical exact 5 positive and 3 negative tests with expected behavior and the demo recording URL.
8. Submit for review.
9. Remediate review findings without weakening security invariants.
10. Publish only after approval and an explicit release decision.

## Go / no-go

Proceed to actual public review when the technical/reviewer package is ready and relationship claims are defensible and accurate:

- production OAuth and per-user Grist credential lifecycle are complete enough for the reviewer environment;
- required C6 controls/evidence are complete enough for the real endpoint;
- reviewer identity/fixture and UserInfo requirements are satisfied;
- final Tool Scan/domain state matches the submitted endpoint;
- exact reviewer scenarios and demo are complete;
- publisher/legal/support/privacy/listing data are accurate;
- the product remains represented as an independent bounded workflow/safety integration, without invented third-party affiliation.

The actual OpenAI review then decides eligibility under the current third-party/primary-function rules. A rejection or requested policy change becomes new external evidence for an explicit roadmap decision; it must not be pre-empted by weakening the security model.

Official references to re-check immediately before submission:

- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/build/auth

## Prepared import draft

`chatgpt-app-submission.json` follows the current prepared import format and contains 23 tools, five positive scenarios and three negative non-invocation scenarios.

Remote MCP only; no distributed skills or Apps SDK UI. The production MCP URL is supplied in the portal rather than invented as a field in the tracked JSON.

### Proposed synthetic fixture (not provisioned)

The current reviewer specification expects one isolated synthetic document with a `ReviewTasks` table containing `Title` and `Status`, at least three rows with `Status = Open`, no row titled `NoSuchSyntheticTask`, at least one Ref relationship, and existing page/widget context. The reviewer needs the three existing scopes on that isolated document.

Start each run from the documented clean fixture and use an operator-managed reset. Never replay a partial/ambiguous write merely to reset a scenario.

## Output-schema follow-up

Formal MCP `outputSchema` remains incomplete for several non-UI tools. Recent data-minimization work means many record/schema update/delete service results are already semantic bounded acknowledgements rather than raw upstream payloads, but formal schemas should be added only when the normalized result contract is intentionally stable. Creation tools must preserve the functional created identifiers needed for later calls while avoiding unnecessary engine-only data.
