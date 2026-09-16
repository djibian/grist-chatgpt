# OpenAI plugin submission plan

Status: product direction agreed; submission requirements must still be re-checked against current OpenAI documentation immediately before submission.

See also [Plugin-ready audit — Grist Community / DINUM](PLUGIN-READY-AUDIT.md).

## Target product

The intended product is a **MCP-first integration for Grist Community**, with the DINUM / La Suite numérique Grist Community instance as the first production target.

This project is not intended to duplicate Grist's official MCP server where that integration is available. Its purpose is to provide the missing MCP/authentication layer for a Grist Community deployment that exposes the REST API but does not provide the official Grist MCP/OAuth stack.

The desired user experience is a normal ChatGPT/Codex conversation in which an installed plugin can inspect and perform explicitly authorized Grist work through bounded semantic tools.

## Product surface

```text
Primary public contract : MCP
Development compatibility: GPT Actions / OpenAPI
Initial Grist target     : one configured Grist Community DINUM instance
Initial distribution     : MCP-only plugin; UI/skills optional later
```

GPT Actions remain useful as a product-development and compatibility surface, but new product architecture should be designed around MCP first.

## Identity decisions

Two authentication layers are deliberately separated.

### ChatGPT/Codex -> grist-chatgpt

The production plugin must use the current MCP-compatible OAuth 2.1 authentication model and create a dynamic bridge principal for the authenticated user.

The current static `MCP_BEARER_TOKEN` remains a prototype/development mechanism.

Candidate OAuth capabilities/scopes are the existing Grist-aligned bridge capabilities:

```text
doc:read
doc:write
doc.schema:write
```

### grist-chatgpt -> Grist Community

Each authenticated user will execute upstream Grist operations with **that user's own Grist API key**.

This is the selected product architecture for the Community/DINUM target.

Consequences:

- Grist remains authoritative for the user's real ACLs;
- the bridge may reduce authority through deployment policy, grants and capabilities, but does not recreate Grist ACLs;
- a shared technical Grist account is not the target design;
- the process-wide `GRIST_API_KEY` is a prototype implementation that must become a credential-provider abstraction.

The effective authority is the intersection of Grist permissions, deployment policy, principal grants and operation scope.

## Credential onboarding

The Grist API key must never be a model-visible value or MCP tool argument.

The intended onboarding is a separate secure web flow owned by the bridge:

1. user authenticates to the plugin/bridge;
2. user opens a secure "Connect Grist" page;
3. user enters the API key directly into that bridge-owned form;
4. the bridge validates the credential directly against the configured DINUM Grist instance;
5. the bridge associates the verified Grist identity with the plugin principal;
6. the API key is stored encrypted and is retrieved only for that principal's upstream requests;
7. the user can disconnect Grist and remove the stored credential.

The key must never appear in prompts, logs, audit events, MCP results, OpenAPI arguments or errors.

## Multi-user scope

The first product is multi-user for **one configured DINUM Grist Community instance**.

It is not initially a multi-tenant proxy for arbitrary Grist instances.

This keeps the initial deployment compatible with a single stable MCP endpoint while still allowing multiple individually authenticated users to operate with their own Grist permissions.

## Existing readiness

The repository already provides substantial submission-relevant foundations:

- public HTTPS MCP endpoint validated end-to-end against Grist Community DINUM;
- reverse proxy, loopback-only Node listener and host validation;
- server-side secret handling;
- policy-aware principal/capability model;
- structured audit without cell contents or credentials;
- bounded data/schema/UI tools;
- explicit exact-target deletion;
- destructive/read-only/open-world MCP annotations;
- explicit partial-write behavior and post-write verification for sensitive UI writes;
- reproducible CI with dependency audit, type checking, tests and build.

## Critical work before submission

### 1. OAuth 2.1 MCP identity

Replace the static production MCP principal with dynamic OAuth-authenticated principals, including the current MCP protected-resource/authentication contract and explicit scopes.

### 2. Per-user Grist credential provider

Introduce a credential abstraction and ensure `GristClient`, resource discovery and caches are isolated by authenticated user credential.

A static API-key provider may remain for the existing single-user prototype.

### 3. Stable MCP v1 tool contract

For each public tool, stabilize:

- name and user-intent-oriented title/description;
- explicit input schema;
- output schema where useful;
- structured result format;
- OAuth scope/capability;
- read-only/destructive/open-world annotations;
- typed error behavior.

The operation registry should increasingly become the normative source for shared policy metadata so tool descriptions and authorization cannot drift.

### 4. Production hardening

Before public distribution, formalize:

- per-principal rate limiting;
- request/upstream timeouts;
- operational metrics and alerting;
- secret rotation;
- deployment/rollback procedure;
- protected release workflow;
- post-deploy synthetic smoke tests.

### 5. Reviewer environment

The reviewer environment must use synthetic data rather than real educational/administrative DINUM data.

Prepare reproducible positive scenarios such as:

1. inspect document structure, relations, pages and widgets;
2. query/filter records;
3. create a table, columns and records;
4. update bounded data/schema state;
5. create a page, add widgets, configure select-by and verify through independent re-read.

Prepare negative scenarios such as:

1. write attempted without the required scope;
2. access outside the deployment/principal resource grant;
3. invalid page/widget/select-by target with no unintended write.

The final set must satisfy the current OpenAI reviewer requirements at submission time.

## Publisher and distribution work

Before submission, prepare and verify the then-current requirements for:

- stable production HTTPS MCP endpoint;
- verified OpenAI developer/organization identity and required app-management permission;
- domain verification/challenge;
- plugin name, description, logo and example prompts;
- public website and support contact;
- privacy policy and terms;
- countries/availability;
- reviewer credentials and instructions;
- required positive and negative test cases.

The relationship to Grist Labs and DINUM / La Suite numérique must remain explicit and non-misleading. Until agreed otherwise, this repository and any test deployment remain an independent integration, not an official Grist Labs or DINUM product.

## Submission strategy

The initial submission should remain deliberately small:

```text
MCP server only
+ strong bounded tool contract
+ OAuth identity
+ per-user Grist Community credentials
+ synthetic reviewer fixture
```

Do not add an Apps SDK UI merely for submission. Skills or UI can be added later if they provide clear user value.

## Go / no-go criterion

Proceed to public submission only when both are true:

- **technical:** a reviewer can authenticate, connect a synthetic Grist Community identity, safely exercise read/write tools, disconnect the credential and reproduce documented positive/negative tests;
- **institutional/product:** the plugin's target, ownership, branding, privacy responsibilities and support boundaries are explicit.

## Current roadmap

1. stabilize and merge v0.6 document UI;
2. make MCP the normative product surface;
3. introduce `GristCredentialProvider` / per-principal client context;
4. make resource discovery and caches user-aware;
5. implement OAuth 2.1 MCP authentication and dynamic principals;
6. implement secure Grist API-key onboarding/storage/disconnect;
7. harden the MCP v1 contracts and typed errors;
8. production hardening;
9. synthetic reviewer fixture and test scenarios;
10. publisher metadata, domain verification and submission.

## Official references to re-check before submission

- OpenAI plugin submission and MCP authentication documentation;
- current MCP authorization specification;
- Grist Community REST API/API-key documentation;
- Grist official MCP/Connected Apps documentation to maintain a clear edition boundary.
