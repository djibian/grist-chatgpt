# Plugin-ready audit — Grist Community / DINUM

**Status:** current submission-readiness audit  
**Audit date:** 2026-09-20  
**Audit baseline:** `main` at `d6375dc56179258218792740f1fb37ab1cffd1e3`  
**Official requirements baseline:** repository guidance rechecked on 2026-09-19; issue #58 records the 2026-09-20 pre-review clarification attempt.

This document is an assessment. It does not select credential persistence/encryption, add scopes, claim authorization from Grist Labs/DINUM/OpenAI, or create an institutional commitment.

## Executive conclusion

The repository demonstrates a substantially complete **technical interoperability POC** for ChatGPT <-> OAuth <-> `grist-chatgpt` <-> Grist Community, but it is not yet production multi-user or ready for final public review.

C4 provider selection is no longer a blocker: ProConnect is the upstream identity source, Logto OSS is the reference MCP-facing authorization server, and the bridge remains a provider-neutral JWT/JWKS resource server. C4-P0 has passed with a real ChatGPT Developer Mode connection, dynamic principals, scope/resource enforcement, real bounded Grist reads/writes and grant-removal/expiry evidence.

Issue #58 now records an important publication-gate clarification: a real MCP-only draft was created, the `grist-chatgpt.loeildumaitre.fr` domain was verified, and the portal Tool Scan completed successfully. OpenAI AI-assisted support did **not** pre-approve eligibility and stated that final classification is determined during the actual app/plugin review. It described the bounded architecture as materially different from a generic relay/proxy while noting that reviewers can still apply the guideline's primary-function test. This is not an approval.

The operational consequence is that there is no separate pre-review approval mechanism to wait for. Reviewer-environment and submission-package preparation may proceed when their technical/human dependencies are satisfied; actual OpenAI review is the point that resolves final public eligibility.

The main engineering/human blockers before final review are therefore:

1. **C5 per-user Grist credential lifecycle:** the current personal/development deployment still uses one server-side Grist API key. Production multi-user use requires the separate secure onboarding/storage/retrieval/disconnect design after explicit persistence/encryption decisions.
2. **C4/C6 production evidence and controls:** controlled release/rollback, issuer/JWKS rotation/outage evidence and remaining production hardening are not complete.
3. **C7 reviewer environment:** the reviewer identity, synthetic fixture and final reviewer-compatible UserInfo evidence remain incomplete.

Public approval remains an external review risk, not a completed prerequisite.

Official references to re-check immediately before submission:

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
| Annotation justifications | PASS for draft/submission artifact | Generated from the same registry and tracked in `chatgpt-app-submission.json`; final submission must remain aligned with the deployed contract. |
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
| Domain verification | PASS for current draft | Issue #58 records successful verification of `grist-chatgpt.loeildumaitre.fr` through a real MCP-only portal draft. Re-verify only if the final portal/deployment requires it. |
| Tool Scan | PASS for current draft | Issue #58 records a successful portal Tool Scan. A final scan must reflect the contract actually submitted if it changes. |
| Public website/support/privacy/terms | MISSING | Final HTTPS URLs must match the verified publisher identity. |
| Output/data minimization | PARTIAL / materially advanced | Public table/column metadata and success-only update/delete/apply results are projected to bounded functional data. Historical raw UI compatibility fields remain explicit v1 debt rather than secret data. |
| Developer/business identity verification | HUMAN / UNKNOWN | Must be completed in the OpenAI Platform organization used for submission. |
| App-management submission permission | HUMAN / UNKNOWN | Submitter needs App Management Write. |
| Listing metadata | MISSING | Final display name/copy/logo/category/capabilities/starter prompts/countries/release notes remain portal-time work. |
| UI / screenshots / CSP | N/A initially | Initial product is MCP-only with no custom ChatGPT UI. |
| Skills | N/A initially | Initial product remains MCP-only. |
| Rate limiting / metrics / alerting | PARTIAL / C6 | Timeouts, metrics vocabulary and audit contract are documented; per-principal rate limiting and production alerting/export remain. |
| Deployment/rollback/smoke | PARTIAL | Runbook, offline preflight and non-secret public smoke checks exist; controlled production evidence and authenticated synthetic smoke remain. |
| Public-plugin third-party eligibility | EXTERNAL REVIEW RISK | Issue #58 records that no pre-review approval is available; final classification occurs in actual OpenAI review. The project must remain independent/non-official and describe its bounded product/workflow value accurately. |

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

### Domain challenge implementation and current draft verification

`OPENAI_APPS_CHALLENGE_TOKEN` is optional. When unset, no challenge route is exposed; when set to a valid exact single-line value, the well-known route returns only that token as plain text. A real token must never be invented or committed.

Issue #58 records that the real portal draft successfully verified the current domain. This external evidence does not change the rule that challenge tokens remain secret and deployment-only.

## Current OpenAI requirements that remain important

### Third-party authorization / primary-function review

OpenAI's published plugin guidelines remain relevant to third-party integrations and unofficial connectors. Issue #58 records that AI-assisted support could not pre-classify this product and that final classification occurs during actual review.

The same issue records two useful but non-dispositive facts from that clarification attempt:

- the bounded architecture was described as materially different from a generic relay/proxy or usual pass-through intermediary;
- the final reviewer may still apply the primary-function test because the product connects ChatGPT to Grist.

Explicit Grist Labs/DINUM permission or rights evidence may reduce policy/branding risk if obtained, but no such evidence should be invented and it does not guarantee OpenAI approval. Preserve the independent/non-official positioning and describe the product as its concrete bounded workflows and safety layer rather than a generic connector.

### OAuth workspace-domain support

The final OAuth reviewer path must expose OIDC discovery, enable `openid` and `email`, and provide UserInfo returning `email` with `email_verified: true`.

### Reviewer credentials

Final reviewers need a ready-to-use demo login that does not depend on inaccessible MFA, SMS/email confirmation, private network access or additional setup.

### Final review package

The final remote-MCP package includes, among other portal fields:

- production MCP endpoint;
- current successful Tool Scan;
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

**ACTIVE external review risk; no separate pre-review blocker.** Issue #58 records that no durable pre-approval mechanism is available and that actual OpenAI review is the classification point. Keep the submission independent/non-official, bounded and factually described. S0 is resolved only by the actual review outcome or a later explicit product decision after that outcome.

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
- a real MCP-only portal draft with successful domain verification and Tool Scan recorded in issue #58.

Remaining independently useful work is the final-client UserInfo proof plus keeping submission artifacts aligned with the public contract.

### C7/C8 — reviewer environment and final submission

C7 no longer waits for a separate S0 pre-approval. Provision the reviewer identity and synthetic Grist fixture once C4/C5 make the reviewer path technically safe. Complete C6 and the reviewer evidence, then finalize C8 and submit. The actual OpenAI review is what resolves the remaining S0 eligibility risk.

## Go / no-go

Do **not** treat public-directory approval as technically inevitable. The pre-review clarification did not approve the product.

Proceed to actual public review when:

1. each authenticated user is isolated and upstream Grist calls use only that user's credential;
2. production OAuth and required C6 controls/evidence are complete enough for the real endpoint;
3. the reviewer can authenticate without prohibited secondary verification and uses synthetic data;
4. final UserInfo requirements pass;
5. exact review artifacts and the current Tool Scan/domain state are coherent with the submitted endpoint;
6. public branding, privacy, support and third-party relationship claims are accurate and non-misleading.

The actual OpenAI review then decides final public eligibility under the current guidelines; a rejection or request for changes becomes new external evidence for a human/product roadmap decision.
