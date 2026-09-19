# OpenAI plugin submission plan

**Status:** current plan aligned with OpenAI documentation checked 2026-09-19.

See also `docs/PLUGIN-READY-AUDIT.md` for the readiness matrix and blocking gaps.

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

The plugin is not intended to duplicate Grist's official MCP/OAuth integration where that exists. It provides authentication, authorization, per-user credential isolation and bounded semantic Grist operations for the Community deployment target.

## Critical publication gate

OpenAI's current plugin guidelines impose a requirement that materially affects this project:

- third-party API integration must have appropriate authorization and respect the third party's terms;
- plugins whose **primary function is to act as unofficial connectors to third-party services**, including intermediary relay layers, cannot be approved.

This repository currently identifies itself as an independent, non-official Grist Labs / DINUM / OpenAI integration. Therefore public directory submission must not assume eligibility until at least one durable basis is established:

1. authorization/partnership or other clear permission basis suitable for public Grist/DINUM integration; or
2. written OpenAI clarification that the proposed product is eligible under the current third-party connector rule.

If necessary, create a plugin submission draft to obtain a submission/plugin identifier, then contact OpenAI support with the exact architecture and positioning before completing expensive submission-only work.

Do not claim an official Grist Labs, DINUM / La Suite numérique or OpenAI relationship unless one is explicitly established.

## Product security model to preserve

### ChatGPT/Codex -> bridge

OAuth 2.1/MCP authentication produces a dynamic principal with only the fixed public capabilities:

```text
doc:read
doc:write
doc.schema:write
```

The current POC has already demonstrated JWT/JWKS validation, issuer/resource/expiry enforcement, scope reduction, dynamic principals, RFC 9728 metadata, CIMD, PKCE and positive/negative `/mcp` authorization paths.

### Bridge -> Grist Community

The production target remains:

> every authenticated bridge user executes upstream Grist operations with that user's own Grist API key.

The key is collected only through a separate bridge-owned secure onboarding flow. It must never appear in MCP tool inputs/results, prompts, general logs, audit payloads or errors.

The effective authority remains:

```text
current user's Grist permissions
∩ deployment resource policy
∩ principal resource grants
∩ OAuth capability required by the operation
```

## Current official submission requirements

Final remote-MCP review requires the following classes of artifact.

### Publisher and listing

- OpenAI developer/business identity verified in the submitting organization;
- submitter has App Management Write / `api.apps.write`;
- final plugin/package name and display metadata within portal limits;
- logo and category;
- HTTPS website, support, privacy-policy and terms URLs matching the publisher identity;
- availability countries/regions;
- release notes;
- up to three starter prompts.

### MCP server

- stable **production** HTTPS MCP endpoint, not a local/test/demo endpoint;
- current successful `Scan Tools` result;
- domain ownership verification using the portal-provided token at `/.well-known/openai-apps-challenge`;
- exact public tool names/descriptions/schemas;
- explicit `readOnlyHint`, `openWorldHint`, `destructiveHint` for every tool;
- a justification for every annotation value for every tool;
- no unnecessary personal data, authentication secrets, debug payloads or diagnostic identifiers in tool outputs.

### OAuth

For the final OAuth client path, prove:

- OIDC discovery;
- `openid` and `email` advertised **and enabled**;
- UserInfo endpoint returns `email` and `email_verified: true`;
- OAuth reviewer login works with provided demo credentials;
- reviewer login requires no MFA, SMS confirmation, email confirmation or private-network access.

The production user identity path can remain ProConnect-backed, but the review environment must satisfy the reviewer credential requirement without weakening normal production access.

### Reviewer package

Final remote-MCP submission requires:

- exactly **5 positive** test cases;
- exactly **3 negative** test cases;
- explicit expected behavior for each;
- reviewer instructions;
- synthetic data only;
- an isolated Grist reviewer identity/credential;
- a demo recording URL showing the main workflows/tools on supported platforms.

No screenshot should be supplied for the initial MCP-only version unless the current tool scan identifies actual UI output; screenshots are for plugins with UI.

## Candidate review scenarios

The final wording must be tested against the production reviewer fixture, but the intended exact set is:

### Positive — 5

1. Inspect a synthetic Grist document's tables, columns, relations, pages and widgets without reading rows unnecessarily.
2. Query and filter synthetic table records.
3. Create bounded records and independently verify the created values.
4. Create/update bounded schema objects (table/columns/formula metadata) and verify the resulting schema.
5. Create a page, add a supported native widget, configure a safe direct `select-by` link and verify by re-read.

### Negative — 3

1. Attempt a write with a principal/token lacking `doc:write`; reject before any Grist mutation.
2. Attempt access to a document outside the deployment/principal resource boundary; reject before protected data is returned.
3. Attempt an invalid UI linkage/target; fail without unintended write and preserve explicit retry semantics.

These scenarios should be automated where possible and mirrored in reviewer instructions.

## Submission-specific implementation gaps

### Must resolve before heavy submission work

- public-plugin third-party authorization/eligibility gate;
- production per-user Grist credential onboarding/storage/disconnect architecture.

### Low-risk work that may proceed independently

- prove Logto final-client `openid`/`email` and verified UserInfo behavior;
- add per-tool annotation justification metadata or a generated submission artifact;
- implement a safe configurable domain-challenge endpoint whose token is supplied only at deployment/submission time;
- formalize the exact 5 positive / 3 negative test fixtures;
- audit tool outputs for data minimization.

### Before final review

- production endpoint and production deployment controls;
- per-principal rate limiting;
- metrics/alerting;
- secret/key rotation procedure;
- controlled release and rollback procedure;
- post-deploy synthetic smoke tests;
- reviewer account with no secondary-verification requirement;
- synthetic Grist document/account fixture;
- public legal/support pages;
- demo recording;
- current tool scan and domain verification.

## Portal sequence

Once the eligibility gate is viable and the product is review-ready:

1. Open the OpenAI plugin submission portal.
2. Create a plugin **With MCP**.
3. Use the production universal MCP URL.
4. Select/configure OAuth and provide reviewer demo credentials.
5. Complete domain verification when the portal issues its challenge token.
6. Run **Scan Tools** and resolve all blocking findings.
7. Fill public listing metadata and policy URLs.
8. Add starter prompts, exact 5 positive tests, exact 3 negative tests, expected outcomes, release notes and demo recording URL.
9. Submit for review.
10. Remediate review findings without weakening security invariants.
11. After approval, choose when to publish.

## Go / no-go

Proceed to public submission only when both are true:

- **eligibility:** the independent Grist/DINUM integration has a defensible authorization/approval basis under OpenAI's third-party connector policy;
- **technical/reviewer:** the production plugin, reviewer identity, synthetic Grist fixture, OAuth/UserInfo behavior, domain challenge, tool metadata/annotations and exact review artifacts all pass current OpenAI requirements.

Official references to re-check again immediately before submission:

- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/app-review
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/build/auth


## Prepared import draft

`chatgpt-app-submission.json` follows the official skill v1 import format and contains
22 tools, five positive scenarios and three negative **non-invocation** scenarios.
The authorization/invalid-link negative scenarios above remain separate runtime
security checks: they invoke tools and therefore are not the skill's negative
routing tests. Neither set is evidence of live reviewer-fixture execution.

Remote MCP only, no distributed skills or Apps SDK UI. Enter
`https://grist-chatgpt.loeildumaitre.fr/mcp` in the portal's MCP URL field: the
skill's import contract has no endpoint field. Do not extend the JSON with
invented publisher, authentication or domain-verification fields.

### Manual completion

- Confirm final public display name/copy/category and logo; draft name follows package metadata.
- Supply verified publisher identity and app-management permission.
- Supply website, support, privacy and terms HTTPS URLs.
- Select countries/regions, release notes and up to three starter prompts.
- Resolve S0 authorization/eligibility before final public submission.
- Supply reviewer login and instructions securely through the portal; never put credentials in this JSON or the repository.
- Provision an isolated synthetic Grist fixture, record its document/table identifiers in reviewer instructions, and execute/reset the proposed scenarios.
- Supply the demo recording URL; attachments and expected-output URLs remain null because none were provided.
- Complete production/OAuth/UserInfo validation, portal tool scan and the exact portal-issued domain challenge.

### Proposed synthetic fixture (not provisioned)

Before running the import scenarios, supply one authorized synthetic document
with a `ReviewTasks` table containing text columns `Title` and `Status`, at least
three rows with `Status = Open`, and no row titled `NoSuchSyntheticTask`.
Include at least one Ref relationship, an existing page and a widget so the
structural scenario can verify all advertised metadata. The reviewer needs
`doc:read`, `doc:write` and `doc.schema:write` on this isolated document.
Start each run from a clean fixture without `ReviewMetrics`, `Review dashboard`,
`Review Alpha` or `Review Beta`; use an operator-managed reset between runs.
These are proposed synthetic names, not claims that a live fixture exists.
Never replay a partial or ambiguous write merely to reset a scenario.

### Source review and separate non-blocking improvement

No dedicated tool input requests credentials or sensitive personal identifiers.
Record fields and returned Grist data may contain personal information; complete
the existing data-minimization/privacy review and use synthetic reviewer data.
Tool names and descriptions match their bounded Grist actions. There is no Apps
SDK widget resource or widget CSP to review; Grist page widgets are upstream
objects, not embedded ChatGPT UI.

Missing `outputSchema` (deferred, not changed in this preparation):
`list_documents`, `list_tables`, `list_columns`, `query_records`, `create_records`,
`update_records`, `delete_records`, `create_tables`, `update_tables`, `delete_table`,
`create_columns`, `update_columns`, `rename_column`, `delete_columns`,
`inspect_document`, `grist_help`.

Add an outputSchema so models can use this tool's results more reliably.
See https://modelcontextprotocol.io/specification/draft/server/tools#tool.
Follow the normalization strategy in `MCP-CONTRACT.md` as separate work.
