# Plugin-ready audit — Grist Community / DINUM

**Status:** current submission-readiness audit  
**Audit date:** 2026-09-19  
**Audit baseline:** `main` at `6de61601b220b77758a2b0c90035bff7461d2138`  
**Official requirements rechecked:** OpenAI plugin submission, remote MCP review, authentication, submission errors and plugin guidelines.

This document is an assessment. It does not select credential persistence/encryption, add scopes, claim authorization from Grist Labs/DINUM, or create an institutional commitment.

## Executive conclusion

The bridge is technically much further along than the 2026-09-17 audit recorded. The repository and live POC now demonstrate OAuth/JWT/JWKS resource-server behavior, dynamic principals, positive and negative `/mcp` authorization paths, RFC 9728 metadata, Logto/ProConnect federation, CIMD, PKCE, resource binding and a public ChatGPT OAuth readiness probe.

The first blocker to a **public OpenAI directory submission is now a publication-eligibility / third-party-authorization gate**, not another Grist feature.

OpenAI's current plugin guidelines state both that third-party API access requires appropriate authorization and that plugins whose primary function is to act as unofficial connectors to third-party services, including intermediary relay layers, cannot be approved. This repository currently describes itself as an independent, non-official Grist Labs / DINUM / OpenAI integration. No durable evidence in the repository establishes authorization from Grist Labs or DINUM for a public OpenAI plugin.

Therefore the next highest-value action is to resolve one of these paths before substantial submission-only engineering:

1. obtain/document the authorization or partnership basis needed for the Grist/DINUM integration; or
2. obtain written clarification from OpenAI that the proposed product, with its authentication/authorization and bounded semantic workflow layer, is eligible under the current third-party integration rule.

Until that is resolved, production hardening that is useful independently may continue, but expensive submission-specific work should not be treated as guaranteed to lead to directory publication.

Official references:

- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/app-review
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/build/auth

## Current readiness matrix

| Area | Status | Current evidence / gap |
| --- | --- | --- |
| Bounded Grist business surface | PASS | Records, schema, discovery and bounded document-UI operations are integrated. |
| MCP-first contract | PASS | Registry-driven tools, user-oriented metadata, structured results/errors and stable capabilities are integrated. |
| Tool risk annotations | PASS for values | Every operation has explicit `readOnlyHint`, `destructiveHint`, `openWorldHint` derived from the operation registry. |
| Annotation justifications for submission | PASS for draft | Generated from the normative registry by `npm run submission:annotations` and mapped into `chatgpt-app-submission.json`. |
| Credential abstraction | PASS | `GristCredentialProvider` / `GristClientFactory` seam integrated. |
| Principal/cache isolation | PASS | Fresh per-principal Grist contexts and explicit cross-user isolation tests are integrated. |
| OAuth MCP resource server | PASS for POC/runtime | OAuth mode, JWT/JWKS, issuer/audience/expiry policy, dynamic Principal and scope enforcement are implemented and exercised on actual `/mcp`. |
| Logto/ProConnect federation | PASS for POC | Stable ProConnect-backed Logto identity demonstrated in non-production. |
| CIMD / PKCE / resource binding | PASS | Public readiness probe validates Logto CIMD, PKCE S256, auth code, refresh grant, RFC 9728 and stable ChatGPT CIMD compatibility. |
| ChatGPT developer-mode live session | EXTERNAL GATE | Current personal ChatGPT workspace does not expose Apps/developer mode. This is not evidence of bridge incompatibility and is not required to create a public plugin submission draft. |
| Per-user Grist credential lifecycle | MISSING / BLOCKING | C5 secure onboarding, encrypted persistence, rotation and disconnect are not implemented. |
| Production endpoint | PARTIAL | Public HTTPS POC exists, but OpenAI requires a production endpoint, not a local/test/demo endpoint, for final review. |
| OAuth UserInfo domain restriction support | PARTIAL / VERIFY | Logto publishes OIDC/UserInfo capabilities, but the final CIMD client path must prove `openid` + `email` are enabled and UserInfo returns `email` with `email_verified: true`. |
| Reviewer authentication | BLOCKING | OpenAI reviewers need ready-to-use demo credentials without MFA, email/SMS confirmation or private-network access. The current ProConnect path is not suitable as the only reviewer login path. |
| Synthetic reviewer Grist fixture | MISSING | Must avoid real educational/administrative data and provide reproducible full-feature demo data. |
| Exactly 5 positive + 3 negative tests | PARTIAL | Candidate scenarios exist in docs/tests, but the exact submission set and expected reviewer-visible outcomes are not yet packaged. |
| Demo recording URL | MISSING | Final remote-MCP submission requires a recording showing principal workflows/tools on supported platforms. |
| Domain verification challenge | MISSING | Need to serve the exact portal token at `/.well-known/openai-apps-challenge` on the MCP host or accepted parent origin. |
| Tool scan | PENDING PORTAL | Must run `Scan Tools` against the production MCP endpoint and resolve all current findings. |
| Public website/support/privacy/terms | MISSING | Final HTTPS URLs must match the verified publisher identity. |
| Privacy/data-minimization review | PARTIAL | Credentials are excluded from model-visible tools and audit data; a final per-tool response review and public privacy policy remain required. |
| Developer/business identity verification | HUMAN / UNKNOWN | Must be completed in the OpenAI Platform organization used for submission. |
| App-management submission permission | HUMAN / UNKNOWN | Submitter needs `api.apps.write` / App Management Write; organization owners have it automatically. |
| Listing metadata | MISSING | Final display name, short/long descriptions, logo, category, capabilities, up to 3 starter prompts, countries and release notes. |
| UI / screenshots / CSP | N/A initially | MCP-only product has no custom UI; screenshots should not be supplied unless tool scan reports UI output. |
| Skills | N/A initially | Initial product remains MCP-only. |
| Rate limiting / metrics / alerting | MISSING / C6 | Final production hardening still required. |
| Deployment/rollback/smoke tests | PARTIAL | Deployment procedure exists historically; final controlled release/rollback and synthetic post-deploy smoke tests remain to formalize. |
| Public-plugin third-party eligibility | BLOCKING HUMAN GATE | Current product is explicitly non-official; OpenAI's current rules prohibit plugins whose primary function is an unofficial third-party connector. Authorization or OpenAI eligibility clarification is required before assuming public approval is possible. |

## Submission requirements that are already structurally satisfied

### Remote MCP shape

The intended submission type is **MCP-only remote plugin**, using one universal public HTTPS `/mcp` endpoint. No Apps SDK UI or skill is required for the first version.

### Tool contract

The operation registry already supplies explicit values for all three required annotations on every public operation:

- `readOnlyHint`;
- `destructiveHint`;
- `openWorldHint`.

Current operations stay within the configured Grist environment, so `openWorldHint: false` is coherent. Destructive record/table/column deletes are explicitly marked destructive. `list_documents`, `list_tables`, `list_columns`, `query_records`, `inspect_document`, `get_pages` and `get_page_widgets` retain `doc:read` authorization but declare `readOnlyHint: false`, `destructiveHint: false` and `openWorldHint: false`: their execution appends an audit event without changing Grist user data. Only `grist_help` remains `readOnlyHint: true`. Audit remains enabled; hints do not change OAuth scopes or authorization.

The draft submission artifact includes per-tool justifications; final live tool scan and reviewer validation remain pending.

### OAuth/MCP interoperability

The live POC demonstrates:

- RFC 9728 protected-resource metadata;
- authorization server discovery;
- PKCE `S256`;
- Authorization Code and refresh grants;
- CIMD;
- stable ChatGPT CIMD compatibility including `private_key_jwt` support;
- canonical MCP resource binding;
- fixed public scopes `doc:read`, `doc:write`, `doc.schema:write`;
- JWT/JWKS signature and issuer/audience/expiry validation;
- insufficient-scope and wrong-resource rejection;
- no OAuth bearer crossing into the Grist credential boundary.

These are strong prerequisites for submission but do not replace reviewer login and final OAuth UserInfo/domain-restriction checks.

## New/clarified OpenAI requirements to carry into implementation

### 1. Third-party integration authorization and originality

This is now the first public-submission gate.

The plugin must not misrepresent itself as official, and OpenAI additionally requires appropriate authorization for third-party API integration. More importantly, the current guidelines say an unofficial connector whose primary function is connecting to a third-party service cannot be approved.

Before public-submission engineering is treated as committed work, record a durable answer to:

- Who authorizes this integration with Grist Community / DINUM for public distribution?
- Is Grist Labs authorization also needed for the product/brand/API relationship?
- If relying on open-source/API rights rather than partnership, does OpenAI accept this specific product as more than a prohibited unofficial connector?

If the answer is unclear, create a submission draft to obtain a plugin/submission identifier and ask OpenAI support for a pre-review eligibility clarification without claiming an official relationship.

### 2. OAuth workspace-domain protection

For OAuth plugins OpenAI expects support for enterprise workspace domain restrictions:

- OIDC discovery;
- `openid` and `email` advertised and enabled for the OAuth client;
- a UserInfo endpoint returning `email` and `email_verified: true`.

Logto already exposes the relevant OIDC mechanism, but the exact final CIMD/dynamic-app configuration and returned claims must be demonstrated with sanitized live evidence.

### 3. Reviewer credentials without secondary verification

The reviewer must receive a demo username/password or equivalent ready-to-use credentials that do **not** require:

- MFA;
- SMS code;
- email confirmation;
- private network access;
- additional account creation/configuration.

The production identity source can remain ProConnect, but final review needs a bounded reviewer path compatible with this requirement. That path must not weaken normal user authentication or broaden production privileges.

### 4. Domain verification endpoint

When the portal issues a token, the exact token must be served as the entire response body at:

```text
https://<approved-host>/.well-known/openai-apps-challenge
```

The host must be the MCP host or an accepted parent origin. Do not invent or commit a token before the portal provides it.

### 5. Exact review package

Final remote-MCP submission requires at least:

- exactly 5 positive tests;
- exactly 3 negative tests;
- expected behavior for each;
- release notes;
- a demo recording URL;
- current successful tool scan;
- reviewer credentials when OAuth is used;
- production MCP URL;
- domain verification;
- explicit annotation values and justifications.

### 6. Public listing constraints

Prepare the final values close to submission, including:

- package name: <= 64 characters and restricted package-name character set;
- display name: <= 30 characters;
- short description: <= 30 characters;
- long description: <= 4000 characters;
- developer name: <= 80 characters;
- at most 20 listed capabilities, each <= 120 characters;
- at most 3 unique starter prompts, each <= 128 characters and without MCP `@mentions`;
- HTTPS website/support/privacy/terms URLs;
- category, availability countries and release notes.

## Privacy and data handling

The final privacy policy must describe at least:

- categories of personal data processed;
- purposes;
- categories of recipients;
- retention periods;
- user controls/removal.

The plugin must minimize tool inputs and outputs. Internal diagnostic/session/trace/request identifiers should not be returned unless strictly required. Functional Grist document/table/column/record/page/widget identifiers may remain model-visible when they are necessary to target and verify bounded operations; this necessity should be reflected in the privacy/reviewer documentation.

API keys, passwords, OAuth tokens, MFA/OTP codes and other authentication secrets must never be collected through model-visible MCP tool arguments or results. The planned separate bridge-owned Grist credential onboarding flow preserves this invariant.

## Recommended order from this audit

### S0 — Public-plugin eligibility

**Human/institutional gate; resolve first.**

Obtain either:

- a clear authorization basis for the Grist/DINUM integration suitable for public distribution; and/or
- written OpenAI clarification that this product is eligible under the current unofficial-connector rule.

### S1 — Complete product identity/credential lifecycle

After S0 is viable:

- finish production C4 identity hardening as needed;
- decide C5 persistence/encryption/key management;
- implement secure per-user Grist onboarding, validation, retrieval, rotation and disconnect.

### S2 — Submission protocol gaps

In parallel where low risk:

- prove OIDC `openid`/`email` + UserInfo verified email for the final client path;
- revalidate generated annotation justifications against the deployed tool scan;
- implement configurable one-token domain challenge serving;
- define the exact 5 positive / 3 negative reviewer scenarios.

### S3 — Reviewer and production environment

- production-not-POC MCP endpoint;
- bounded reviewer login without MFA/email/SMS/private network;
- synthetic Grist account/data fixture;
- per-principal rate limiting, metrics/alerts, release/rollback and smoke tests.

### S4 — Publisher package and portal submission

- verified publisher identity and `api.apps.write`;
- website/support/privacy/terms;
- listing metadata and starter prompts;
- demo recording;
- domain verification;
- tool scan;
- reviewer credentials/instructions;
- exactly 5 positive + 3 negative tests;
- submit, remediate review findings, then publish after approval.

## Go / no-go

Do **not** treat public-directory approval as technically inevitable while S0 is unresolved.

Proceed to final public submission only when:

1. publication eligibility / third-party authorization is resolved;
2. each authenticated user is safely isolated and upstream Grist calls use that user's own credential;
3. the reviewer can authenticate without prohibited secondary verification and use only synthetic data;
4. final production OAuth, UserInfo and domain verification requirements pass;
5. exact OpenAI review artifacts and policy attestations are complete;
6. public branding, privacy and support responsibilities are accurate and non-misleading.
