# Plugin-ready audit — Grist Community / DINUM

**Status:** current submission-readiness audit  
**Audit date:** 2026-09-20  
**Audit baseline:** `main` at `2e2a9a6457a709fce630d7c1e21a0e12eb5a58d8` plus the 2026-09-20 OpenAI draft/support evidence recorded in issue #58  
**Official requirements rechecked:** OpenAI plugin guidelines, remote MCP submission, authentication and submission errors on 2026-09-19.

This document is an assessment. It does not select credential persistence/encryption, add scopes, claim authorization from Grist Labs/DINUM, or create an institutional commitment.

## Executive conclusion

The repository now demonstrates a substantially complete **technical interoperability POC** for ChatGPT <-> OAuth <-> `grist-chatgpt` <-> Grist Community, but it is not yet production multi-user or public-directory ready.

C4 provider selection is no longer a blocker: ProConnect is the upstream identity source, Logto OSS is the reference MCP-facing authorization server, and the bridge remains a provider-neutral JWT/JWKS resource server. C4-P0 has passed with a real ChatGPT Developer Mode connection, dynamic principals, scope/resource enforcement, real bounded Grist reads/writes and grant-removal/expiry evidence.

The main remaining blockers/risks are now:

1. **C5 per-user Grist credential lifecycle:** the current personal/development deployment still uses one server-side Grist API key. Production multi-user use requires the separate secure onboarding/storage/retrieval/disconnect design after explicit persistence/encryption decisions.
2. **S0 review-time public eligibility:** OpenAI AI-assisted support will not pre-confirm eligibility outside review. After receiving the concrete architecture, it described the fixed single-instance, finite semantic-tool design as materially different from a generic relay/proxy or usual pass-through intermediary, while preserving the possibility that reviewers apply the primary-function test and classify the product as principally connecting ChatGPT to Grist. The actual review is therefore the decision point, not a pre-review approval gate.

A real OpenAI MCP-only draft now exists. The current MCP hostname is domain-verified and Tool Scan succeeds. These facts reduce submission uncertainty but do **not** constitute directory approval.

Official references rechecked:

- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/build/auth

## Current readiness matrix

| Area | Status | Current evidence / gap |
| --- | --- | --- |
| Bounded Grist business surface | PASS | Records, schema, discovery and bounded document-UI operations are integrated. |
| MCP-first contract | PASS | Registry-driven tools, user-oriented metadata, typed error direction and stable UI structured results are integrated. |
| Tool risk annotations | PASS | Every public operation has explicit `readOnlyHint`, `destructiveHint`, `openWorldHint` derived from the normative registry. |
| Annotation justifications | PASS for draft/submission artifact | Generated from the same registry and tracked in `chatgpt-app-submission.json`; the real portal Tool Scan succeeds on the current draft endpoint. |
| Credential abstraction | PASS | `GristCredentialProvider` / `GristClientFactory` seam integrated. |
| Principal/cache isolation | PASS | Fresh per-principal Grist contexts and cross-principal isolation tests are integrated. |
| OAuth MCP resource server | PASS for POC/runtime | JWT/JWKS, issuer/audience/expiry, RFC 9728 challenge/metadata, dynamic principal and scope enforcement are implemented and exercised. |
| Logto/ProConnect federation | PASS for POC | Stable ProConnect-backed Logto identity demonstrated. |
| CIMD / PKCE / resource binding | PASS for POC | ChatGPT client metadata, PKCE S256, RFC 8707 resource binding, authorization code/refresh behavior and real connection are demonstrated. |
| ChatGPT Developer Mode live session | PASS | Real ChatGPT Developer Mode connected through Logto -> ProConnect -> Logto; reads and bounded writes/deletes were exercised with verification. |
| Grant removal / renewal boundary | PASS for POC | Removing the Logto third-party grant leaves an already-issued JWT usable until expiry, after which ChatGPT cannot silently renew and asks to reconnect. |
| Per-user Grist credential lifecycle | MISSING / BLOCKING | C5 secure onboarding, encrypted persistence, per-principal retrieval, rotation/revalidation and disconnect are not implemented. |
| Production OAuth operating model | PARTIAL / C4 | Offline preflight, release/rollback runbook and non-secret smoke checks exist; controlled release/rollback plus issuer/JWKS rotation/outage evidence remain. |
| OAuth UserInfo domain-restriction support | PARTIAL / VERIFY | `openid`/`email` compatibility was enabled for the ChatGPT dynamic app; final reviewer path must still prove UserInfo returns `email` with `email_verified: true`. |
| Reviewer authentication | BLOCKING | Final review needs demo credentials without MFA/SMS/email confirmation/private-network dependency. ProConnect cannot be assumed to satisfy that reviewer path by itself. |
| Synthetic reviewer Grist fixture | MISSING | Canonical fixture requirements are specified but no isolated reviewer account/document is claimed provisioned. |
| Exactly 5 positive + 3 negative tests | PASS for specification/package | Canonical scenarios are documented in `OPENAI-REVIEWER-TESTS.md`, represented in `chatgpt-app-submission.json` and locked by repository tests; live reviewer-fixture execution remains pending. |
| Domain verification route | PASS for current draft host | Optional exact-token route is implemented; a real portal-issued token was configured only in protected deployment state and `grist-chatgpt.loeildumaitre.fr` was successfully verified on 2026-09-20. Re-verify if the final hostname changes. |
| Tool scan | PASS for current draft endpoint | Real portal Tool Scan succeeds. Formal `outputSchema` coverage gaps are separately tracked as contract-quality follow-up; final production-endpoint scan is still required. |
| Public website/support/privacy/terms | MISSING | Final HTTPS URLs must match the verified publisher identity. |
| Output/data minimization | PARTIAL / materially advanced | Public table/column metadata and success-only update/delete/apply results are projected to bounded functional data. Creation results still intentionally preserve functional created IDs; final create-result normalization/outputSchema review remains useful. |
| Developer/business identity verification | HUMAN / UNKNOWN | Must be completed in the OpenAI Platform organization used for submission. |
| App-management submission permission | HUMAN / UNKNOWN | Submitter needs App Management Write. |
| Listing metadata | PARTIAL | Draft app metadata exists and has been repositioned around the bounded document-inspection/design/maintenance workflow; final logo, policy copy, starter prompts, countries and release notes remain portal-time work. |
| UI / screenshots / CSP | N/A initially | Initial product is MCP-only with no custom ChatGPT UI. |
| Skills | N/A initially | Initial product remains MCP-only. |
| Rate limiting / metrics / alerting | PARTIAL / C6 | Timeouts, metrics vocabulary and audit contract are documented; per-principal rate limiting and production alerting/export remain. |
| Deployment/rollback/smoke | PARTIAL | Runbook, offline preflight and non-secret public smoke checks exist; controlled production evidence and authenticated synthetic smoke remain. |
| Public-plugin third-party eligibility | ACTIVE / REVIEW-TIME RISK | Issue #58 records that no pre-review approval is available; support mapped the architecture as materially different from a generic pass-through proxy but final primary-function classification is determined during actual review. |

## Submission requirements already structurally satisfied

### Remote MCP shape

The intended submission is a **remote MCP-only plugin** using one public HTTPS `/mcp` endpoint. No Apps SDK UI or skill is required for the initial product.

### Tool contract and annotations

The operation registry supplies the three required MCP annotation values and submission justifications. Current audited reads intentionally use `readOnlyHint: false` because they append an audit event; `grist_help` is the only unaudited read-only operation. Current operations remain confined to the configured Grist environment, so `openWorldHint: false` is coherent.

### OAuth/MCP interoperability

C4-P0 evidence covers:

- RFC 9728 protected-resource metadata/challenge;
- authorization-server/OIDC discovery;
- PKCE `S256`;
- authorization code and refresh behavior;
- ChatGPT CIMD/dynamic-app compatibility;
- canonical RFC 8707 resource binding;
- fixed public scopes `doc:read`, `doc:write`, `doc.schema:write`;
- JWT/JWKS signature and issuer/audience/expiry validation;
- insufficient-scope and wrong-resource rejection;
- dynamic principal/context creation;
- OAuth bearer exclusion from the Grist credential provider;
- real ChatGPT Developer Mode operation.

This proves interoperability, not production C4/C5 completion.

### Reviewer test package

`docs/OPENAI-REVIEWER-TESTS.md` is the canonical human-readable specification for exactly five positive and three negative cases. Repository tests lock the tracked submission artifact to that shape. The fixture is deliberately synthetic and still needs provisioning/execution for C7.

### Domain challenge implementation and live draft verification

`OPENAI_APPS_CHALLENGE_TOKEN` is optional. When unset, no challenge route is exposed; when set to a valid exact single-line value, the well-known route returns only that token as plain text. A real token must never be invented or committed.

On 2026-09-20 the portal issued a real token, the protected deployment environment supplied it without committing it, and the current draft hostname was successfully verified. This proves control of the current draft hostname only; repeat verification if the final production hostname changes.

## Current OpenAI requirements that remain important

### Third-party authorization / unofficial connector classification

OpenAI's current plugin guidelines require authorized third-party integration and say plugins whose primary function is to act as unofficial connectors to third-party services cannot be approved.

Issue #58 now contains the concrete pre-review support exchange. Support would not pre-confirm eligibility from a description because final classification occurs in review. Given the exact architecture, it described the fixed single-instance, finite validated semantic-tool surface as materially different from a generic relay/proxy or normal pass-through intermediary. It also preserved the possibility that reviewers still treat the primary function as connecting ChatGPT to Grist.

Support stated that explicit permission/rights from Grist Labs or the target instance operator can reduce policy risk but does not automatically override the primary-function test and no particular authorization letter is documented as guaranteeing approval.

Accordingly:

- do not describe the product as a generic “Grist connector” when the actual value is a bounded inspect/structure/maintain workflow with semantic validation and safety controls;
- do not hide that Grist Community is the target service;
- keep the one configured instance boundary explicit;
- document the real permission/rights/branding basis for the intended deployment;
- do not claim an official Grist Labs, DINUM / La Suite numérique or OpenAI relationship without durable evidence;
- treat actual review, not a nonexistent pre-approval, as the final S0 decision.

### OAuth workspace-domain support

The final OAuth reviewer path must expose OIDC discovery, enable `openid` and `email`, and provide UserInfo returning `email` with `email_verified: true`.

### Reviewer credentials

Final reviewers need a ready-to-use demo login that does not depend on inaccessible MFA, SMS/email confirmation, private network access or additional setup.

### Final review package

Current OpenAI submission documentation requires the final remote-MCP package to include, among other portal fields:

- production MCP endpoint;
- successful Tool Scan;
- domain verification;
- exact tool metadata/annotations and justifications;
- exactly five positive and three negative cases with expected behavior;
- reviewer credentials/instructions when authentication is required;
- demo recording URL;
- website/support/privacy/terms URLs;
- publisher verification/app-management permission;
- listing metadata, availability and release notes.

## Remaining work by project tranche

### S0 — public-plugin eligibility

**ACTIVE / review-time decision.** No separate pre-review approval is available. Maintain accurate bounded-workflow positioning and independent status, document the factual permission/rights basis for the intended Grist deployment/branding, then let the actual OpenAI review determine the remaining primary-function classification. Record the result in issue #58. A connector-rule rejection returns S0 to BLOCKED pending the smallest concrete authorization/product/submission change identified by review.

### C4 — production OAuth

**ELIGIBLE.** Exercise the documented release/rollback path on the intended deployment and record issuer/JWKS key-rotation plus outage/recovery behavior while preserving the proven provider-neutral contract.

### C5 — per-user Grist credential lifecycle

**BLOCKED by C4 + human persistence/encryption decisions.** Implement only after the storage/key-management decision is explicit.

### C6 — production hardening

Finish per-principal rate limits, operational metrics/alerts, audit export if required, secret/key rotation and controlled production evidence after C4/C5 permit finalization.

### S1 — low-risk submission preparation

Already integrated/prepared:

- annotation semantics/justifications and tracked submission artifact;
- canonical 5+3 reviewer specification/tests;
- exact-token domain-challenge implementation;
- multiple public-output minimization slices;
- a real MCP-only portal draft;
- successful current-host domain verification;
- successful current-endpoint Tool Scan;
- submission copy repositioned around the bounded workflow rather than generic connector language.

Remaining independently useful work includes final-client UserInfo proof, outputSchema/contract normalization where intentionally stable, and keeping submission artifacts aligned with the public tool contract.

### C7/C8 — reviewer environment and final submission

C7 is no longer blocked by a separate S0 pre-approval. It remains blocked by C5 and depends on the final production C4 identity path. Once those dependencies permit, provision the reviewer identity and synthetic Grist fixture, execute the canonical scenarios and prepare the demo.

C8 remains blocked by C6/C7 and final publisher/legal/support completeness. Complete the final Tool Scan/domain verification/listing package and submit the existing draft for review. That review is the final S0 eligibility decision point.

## Go / no-go

Do **not** treat public-directory approval as technically inevitable. The current support exchange, draft creation, domain verification and Tool Scan are evidence of a viable review path, not approval.

Proceed to final public review only when:

1. the submission accurately describes the bounded workflow, fixed one-instance target and independent/non-official status, with a defensible factual rights/permission/branding basis;
2. each authenticated user is isolated and upstream Grist calls use only that user's credential;
3. the reviewer can authenticate without prohibited secondary verification and uses synthetic data;
4. final production OAuth/UserInfo/domain verification pass;
5. exact review artifacts and live final-endpoint Tool Scan are complete;
6. public branding, privacy and support responsibilities are accurate and non-misleading;
7. C6 production controls/evidence are complete enough for a real production endpoint.

The actual OpenAI review then resolves the remaining S0 primary-function classification. Record and address the review outcome without weakening security invariants or overstating affiliation.
