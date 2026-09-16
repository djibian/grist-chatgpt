# Product vision

## Mission

`grist-chatgpt` provides the secure MCP/authentication layer missing from **Grist Community**, with the DINUM / La Suite numérique Grist Community instance as the first production target.

The product lets ChatGPT/Codex perform realistic Grist work through named bounded semantic tools while keeping credentials, authorization, guardrails and audit server-side.

It is not intended to compete with Grist's official MCP/OAuth integration where that integration is available and sufficient.

## Product contract

```text
Primary public contract : MCP
Development compatibility: GPT Actions / OpenAPI
Target Grist edition      : Grist Community
Initial deployment target : DINUM instance
Tenancy model             : multi-user, one configured Grist instance
```

GPT Actions are a useful development/compatibility surface, not the architecture that should drive future product decisions.

## Identity model

The production identity model is intentionally two-layered.

### ChatGPT/Codex -> grist-chatgpt

Users authenticate individually to the MCP service through the supported OAuth 2.1/MCP authentication model. Authentication produces a dynamic bridge `Principal` with explicit scopes/capabilities and resource grants.

The existing capability vocabulary is the starting point for public scopes:

- `doc:read`;
- `doc:write`;
- `doc.schema:write`.

### grist-chatgpt -> Grist Community

Each authenticated bridge user executes upstream Grist operations with **that user's own Grist API key**.

Grist therefore remains authoritative for the user's true ACLs. The bridge may only reduce authority through deployment policy, principal grants, OAuth scopes/capabilities and bounded operations.

The effective authority is the intersection of:

```text
Grist permissions of the current user's API key
∩ deployment policy for the DINUM bridge
∩ principal resource grants
∩ required operation capability/scope
```

A shared technical Grist account with bridge-reimplemented ACLs is not the target architecture.

## Target architecture

```text
                 ChatGPT / Codex
                        |
                     OAuth 2.1
                        |
                        v
                grist-chatgpt MCP
                        |
              dynamic user Principal
               scopes + resource grants
                        |
                        v
              AuthorizationService
                        |
                        v
           AuthorizedGristService
                        |
                        v
            GristCredentialProvider
                        |
             per-user Grist API key
                        |
                        v
                   GristClient
                        |
             REST + bounded actions
                        |
                        v
              Grist Community DINUM
```

## Core product properties

### Grist remains authoritative

The bridge does not recreate Grist's ACL system. Upstream requests are made with the current user's Grist credential, so Grist enforces that user's permissions.

### Powerful but bounded

The bridge should support realistic work — records, schema and document UI — but every model-visible mutation must be a named operation with predictable effects.

No generic HTTP proxy, raw SQL surface or arbitrary `/apply`/UserAction tool is part of the product.

### Understand before modifying

The model should be able to inspect compact semantic document context, page/widget structure and relevant stable identifiers before mutation without requiring indiscriminate row disclosure.

### Safe failure semantics

Non-atomic batches and ambiguous post-write states must be explicit. The model must not be encouraged to blindly replay a whole operation after partial success or uncertain completion.

### Credential invisibility

Grist API keys and OAuth/session secrets never become model-visible tool arguments or results. Grist credential onboarding is a separate secure bridge-owned flow.

### User isolation

No Grist client, discovered-resource set, cache or authorization fact derived from one user's credential may become visible to another principal.

### MCP-first tool quality

Public tools should converge on stable user-intent-oriented names/titles/descriptions, explicit schemas, structured outputs, correct risk annotations and typed errors.

## Initial product boundary

The first production product is **multi-user for one configured Grist Community DINUM instance**.

Do not build arbitrary multi-tenant routing across unrelated Grist installations unless a later explicit product decision requires it.

A MCP-only plugin is sufficient for the first public product. Apps SDK UI and skills should be added only when they solve a demonstrated user need.

## Non-goals

The near-term product does not aim to provide:

- generic Grist instance administration;
- user/ACL administration;
- raw SQL;
- arbitrary HTTP calls;
- arbitrary Grist UserActions;
- model-visible credentials;
- a replacement for Grist's official MCP where that integration is available;
- a universal router for arbitrary Grist instances;
- feature breadth at the expense of identity/security correctness.

## Success criteria for plugin-ready v1

A plugin-ready v1 exists when:

1. a ChatGPT/Codex user authenticates individually to the MCP service;
2. the user securely connects their own Grist API key outside the model conversation;
3. upstream calls use only that user's Grist credential;
4. resource discovery and caches are isolated per user;
5. bridge scopes can reduce the authority of the user's Grist credential;
6. the main record/schema/document-UI workflows use stable bounded MCP contracts;
7. destructive and partial-write semantics remain explicit;
8. production observability, rate limiting and release/rollback controls exist;
9. a reviewer can reproduce required positive and negative scenarios using synthetic data;
10. privacy/support/terms/publisher/domain requirements for OpenAI submission are satisfied.

## Guiding invariant

> ChatGPT/Codex authenticates the user to the bridge; the bridge authenticates that same user to Grist Community with the user's own API key; Grist remains authoritative for upstream permissions; and the bridge may only reduce authority through explicit policy, scopes, grants and bounded semantic operations.
