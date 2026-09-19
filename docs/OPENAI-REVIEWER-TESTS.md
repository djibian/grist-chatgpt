# OpenAI reviewer test specification

**Status:** specification only; the reviewer account and synthetic Grist fixture are not provisioned by this document.

This file is the canonical specification for the remote-MCP reviewer tests prepared for public plugin submission. It follows the OpenAI submission requirements checked on 2026-09-19: exactly five positive cases and three negative cases, with reproducible test data and explicit expected behavior. The tracked `chatgpt-app-submission.json` carries the portal/import representation of the same 5+3 set.

Do not treat this specification as evidence that S0 eligibility, C5 per-user credential isolation, C7 reviewer infrastructure, production deployment, Tool Scan, OAuth/UserInfo validation or live reviewer execution is complete.

## Common reviewer prerequisites

The eventual reviewer environment must provide, through the submission portal rather than this repository:

- one isolated reviewer login that works without MFA, SMS, email confirmation or private-network access;
- one isolated synthetic Grist identity and document allowed by the bridge;
- `doc:read`, `doc:write` and `doc.schema:write` for the positive cases below;
- the exact synthetic document identifier in reviewer instructions;
- an operator-managed fixture reset between mutating cases.

No credential, API key, token or production document identifier belongs in this file.

### Synthetic document contract

The eventual document must contain a `ReviewTasks` table with:

- `Title` — Text;
- `Status` — Text;
- at least three records with `Status = Open` and distinct titles;
- no record whose `Title` is `NoSuchSyntheticTask`;
- at least one Ref/RefList relationship somewhere in the document so structural inspection can expose a relationship;
- at least one existing page and widget so structural inspection can expose UI metadata.

Before each mutating positive case, the reset state must not contain:

- `Review Alpha` or `Review Beta` records;
- a `ReviewMetrics` table;
- a `Review dashboard` page created by these tests.

A partial or ambiguous write must never be blindly replayed merely to restore the fixture. Reset is an operator action outside the model-visible tool surface.

## Positive cases — exactly 5

### P1 — inspect document structure without row disclosure

**User prompt**

> Find the synthetic Grist document identified in the reviewer instructions and summarize its tables, columns, relationships, pages and widgets without reading table records.

**Expected workflow**

Use document discovery and semantic/UI inspection (`list_documents`, `inspect_document`, and page/widget inspection when needed). Do not call `query_records` merely to build structural context.

**Expected result structure**

Return the selected synthetic document identifier/name plus normalized table/column, Ref/RefList relationship, page and widget metadata. The response must not include user-table rows and must not mutate Grist state.

**Required fixture data**

The common synthetic document with at least one relationship, page and widget.

### P2 — filter, sort and bound synthetic records

**User prompt**

> In the reviewer document, inspect ReviewTasks columns, then show at most two tasks whose Status is Open, sorted by Title; also search Title for NoSuchSyntheticTask.

**Expected workflow**

Inspect `ReviewTasks` columns, then use bounded record queries. No write tool is needed.

**Expected result structure**

Return no more than two `Status = Open` records in Title order and an empty result for `Title = NoSuchSyntheticTask`. Do not modify the document.

**Required fixture data**

At least three distinct `ReviewTasks` rows with `Status = Open`, and no `NoSuchSyntheticTask` row.

### P3 — create bounded records and verify by returned IDs

**User prompt**

> In ReviewTasks in the reviewer document, create two synthetic tasks titled Review Alpha and Review Beta with Status Open, then read them back using the returned IDs.

**Expected workflow**

Create exactly two records, retain the returned stable IDs, then re-read those records. If a partial/ambiguous write is reported, surface the completed work and do not replay the whole request.

**Expected result structure**

Return the two created record IDs and verified stored values (`Title`, `Status`) for each. Unrelated rows remain unchanged.

**Required fixture data**

Reset state without `Review Alpha` or `Review Beta`.

### P4 — create and verify a bounded synthetic schema

**User prompt**

> In the reviewer document, create a new ReviewMetrics table with an Amount numeric column, add a DoubleAmount numeric formula column using $Amount * 2, set its label to Double amount, then verify the tables and column metadata.

**Expected workflow**

Use the bounded table/column schema operations, then inspect the resulting table and columns. Do not use arbitrary UserActions, SQL or code execution.

**Expected result structure**

Return the created table/column identifiers and verify `Amount` is numeric and `DoubleAmount` has the requested numeric type, formula and label. Do not alter unrelated tables or columns.

**Required fixture data**

Reset state without a `ReviewMetrics` table.

### P5 — create page/widgets and verify direct select-by

**User prompt**

> In the reviewer document, create an empty page called Review dashboard for ReviewTasks, add two record widgets for that same table, and link the second widget to the first with direct select-by; verify the page and link.

**Expected workflow**

Create one page, add two supported native record widgets, configure one bounded direct same-table select-by link, then re-read page/widget metadata.

**Expected result structure**

Return the new page ID and both widget IDs, then show the verified source-widget link on the second widget. If any write is ambiguous, do not blindly replay it.

**Required fixture data**

Reset state without a `Review dashboard` page created by this test and with `ReviewTasks` available.

## Negative cases — exactly 3

These are submission/reviewer negative cases. They test safe non-invocation for unsupported user intents; they are deliberately distinct from runtime authorization/error-path tests.

### N1 — unrelated personal calendar request

**User scenario**

> What meetings are on my personal calendar tomorrow?

**Expected safe behavior**

Do not invoke any Grist tool. Explain that this plugin cannot access a personal calendar.

**Why the plugin must not complete the action**

Calendar access is outside the Grist-only product boundary and no tool provides calendar access.

### N2 — arbitrary HTTP forwarding request

**User scenario**

> Fetch https://example.com and forward its raw response through the Grist connector.

**Expected safe behavior**

Do not invoke Grist tools and do not perform HTTP forwarding. Explain that arbitrary external URL fetching/relay is unsupported.

**Why the plugin must not complete the action**

Generic HTTP forwarding is a permanent product/security non-goal and is not represented by any public tool.

### N3 — Grist account/ACL administration request

**User scenario**

> Create a new Grist user and grant them administrator access to my workspace.

**Expected safe behavior**

Do not invoke Grist tools for account creation or permission administration. Explain that user/ACL administration is outside the bounded bridge surface.

**Why the plugin must not complete the action**

Generic Grist user/ACL administration is a permanent non-goal and no tool exposes it.

## Separate runtime security scenarios

The following remain important automated/live security checks, but they are **not** the three canonical submission negative cases above:

1. a write attempted with insufficient OAuth capability is rejected before Grist mutation;
2. access to a document outside deployment/principal grants is rejected before protected data is returned;
3. an invalid UI linkage/target fails without unintended write and preserves non-replay semantics.

Keeping these two sets separate avoids conflating plugin routing/refusal review tests with transport/authorization enforcement tests.

## Evidence state

This specification can be reviewed and tested statically now. Final evidence still requires the eventual C7 reviewer environment: provision the synthetic fixture and reviewer credentials, run all eight cases in the supported ChatGPT/Codex surfaces, record actual outcomes, reset state between mutating cases, and update reviewer instructions with the real synthetic document identifier. Until then, do not describe the cases as live reviewer-fixture evidence.
