# Plugin-ready audit — Grist Community / DINUM

**Status:** current submission-readiness audit  
**Audit date:** 2026-09-19  
**Audit baseline:** `main` at `7fe3f67739461fa7bd977b3923cb19d4afcf20ed`  
**Official requirements rechecked:** OpenAI plugin guidelines, remote MCP submission, authentication and submission errors on 2026-09-19.

This document is an assessment. It does not select credential persistence/encryption, add scopes, claim authorization from Grist Labs/DINUM, or create an institutional commitment.

## Executive conclusion

The repository now demonstrates a substantially complete **technical interoperability POC** for ChatGPT <-> OAuth <-> `grist-chatgpt` <-> Grist Community, but it is not yet production multi-user or public-directory ready.

C4 provider selection is no longer a blocker: ProConnect is the upstream identity source, Logto OSS is the reference MCP-facing authorization server, and the bridge remains a provider-neutral JWT/JWKS resource server. C4-P0 has passed with a real ChatGPT Developer Mode connection, dynamic principals, scope/resource enforcement, real bounded Grist reads/writes and grant-removal/expiry evidence.

The two main non-product blockers are now:

1. **S0 public-plugin eligibility / third-party authorization:** OpenAI's current guidelines require authorized third-party API access and state that plugins whose primary function is acting as unofficial connectors to third-party services cannot be approved. This project remains explicitly independent/non-official, so public eligibility must be clarified durably before assuming directory approval.
2. **C5 per-user Grist credential lifecycle:** the current personal/development deployment still uses one server-side Grist API key. Production multi-user use requires the separate secure onboarding/storage/retrieval/disconnect design after explicit persistence/encryption decisions.

Useful private product/platform work may continue independently of S0.

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
| Annotation justifications | PASS for draft/submission artifact | Generated from the same registry and tracked in `chatgpt-app-submission.json`; final deployed Tool Scan remains pending. |
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
| Domain verification route | PASS for implementation / external activation pending | Optional exact-token `/.well-known/openai-apps-challenge` route is implemented and absent when unset; real portal token must only be configured/verified when issued. |
| Tool scan | PENDING PORTAL | Must run against the final production MCP endpoint and resolve current findings. |
| Public website/support/privacy/terms | MISSING | Final HTTPS URLs must match the verified publisher identity. |
| Output/data minimization | PARTIAL / materially advanced | Public table/column metadata and success-only update/delete/apply results are projected to bounded functional data. Creation results still intentionally preserve functional created IDs; final create-result normalization/outputSchema review remains useful. |
| Developer/business identity verification | HUMAN / UNKNOWN | Must be completed in the OpenAI Platform organization used for submission. |
| App-management submission permission | HUMAN / UNKNOWN | Submitter needs App Management Write. |
| Listing metadata | MISSING | Final display name/copy/logo/category/capabilities/starter prompts/countries/release notes remain portal-time work. |
| UI / screenshots / CSP | N/A initially | Initial product is MCP-only with no custom ChatGPT UI. |
| Skills | N/A initially | Initial product remains MCP-only. |
| Rate limiting / metrics / alerting | PARTIAL / C6 | Timeouts, metrics vocabulary and audit contract are documented; per-principal rate limiting and production alerting/export remain. |
| Deployment/rollback/smoke | PARTIAL | Runbook, offline preflight and non-secret public smoke checks exist; controlled production evidence and authenticated synthetic smoke remain. |
| Public-plugin third-party eligibility | BLOCKING HUMAN GATE | S0 issue #58 requires durable OpenAI clarification and any additional Grist Labs/DINUM authorization basis OpenAI says is necessary. |

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

### Domain challenge implementation

`OPENAI_APPS_CHALLENGE_TOKEN` is optional. When unset, no challenge route is exposed; when set to a valid exact single-line value, the well-known route returns only that token as plain text. A real token must never be invented or committed.

## Current OpenAI requirements that remain important

### Third-party authorization / unofficial connector gate

OpenAI's current plugin guidelines require authorized third-party integration and say plugins whose primary function is to act as unofficial connectors to third-party services cannot be approved. The project adds substantial identity, authorization, semantic, retry-safety and bounded-operation behavior, but that does not itself settle OpenAI's classification.

Issue #58 contains the exact clarification package. Do not claim an official Grist Labs, DINUM or OpenAI relationship without durable evidence.

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

**BLOCKED / human-institutional gate.** Obtain durable OpenAI clarification of eligibility; if OpenAI requires additional third-party authorization, obtain the relevant Grist Labs/DINUM basis without overstating any relationship.

### C4 — production OAuth

**ELIGIBLE.** Exercise the documented release/rollback path on the intended deployment and record issuer/JWKS key-rotation plus outage/recovery behavior while preserving the proven provider-neutral contract.

### C5 — per-user Grist credential lifecycle

**BLOCKED by C4 + human persistence/encryption decisions.** Implement only after the storage/key-management decision is explicit.

### C6 — production hardening

Finish per-principal rate limits, operational metrics/alerts, audit export if required, secret/key rotation and controlled production evidence after C4/C5 permit finalization.

### S1 — low-risk submission preparation

Already integrated:

- annotation semantics/justifications and tracked submission artifact;
- canonical 5+3 reviewer specification/tests;
- exact-token domain-challenge implementation;
- multiple public-output minimization slices.

Remaining independently useful work includes final-client UserInfo proof, continued output minimization/contract normalization where functional value remains, and keeping submission artifacts aligned with the public tool contract.

### C7/C8 — reviewer environment and final submission

Provision the reviewer identity and synthetic Grist fixture only when identity/credential readiness and S0 make final review viable. Then execute the canonical scenarios, record the demo, complete Tool Scan/domain verification/listing/legal/support requirements and submit.

## Go / no-go

Do **not** treat public-directory approval as technically inevitable while S0 is unresolved.

Proceed to final public submission only when:

1. public-plugin eligibility / required third-party authorization is resolved;
2. each authenticated user is isolated and upstream Grist calls use only that user's credential;
3. the reviewer can authenticate without prohibited secondary verification and uses synthetic data;
4. final production OAuth/UserInfo/domain verification pass;
5. exact review artifacts and live Tool Scan are complete;
6. public branding, privacy and support responsibilities are accurate and non-misleading;
7. C6 production controls/evidence are complete enough for a real production endpoint.
