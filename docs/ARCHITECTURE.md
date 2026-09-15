# Architecture v0.5.0

## Objective

`grist-chatgpt` is a controlled compatibility bridge between conversational AI clients and Grist Community. It keeps authentication, authorization, guardrails and Grist credentials server-side while exposing named operations through GPT Actions and MCP.

It is not intended to reproduce the whole Grist API or to become a generic remote-control proxy.

## Architecture

```text
ChatGPT GPT Actions                 MCP client
        |                               |
        +---------------+---------------+
                        |
                        v
                transport adapters
                        |
                        v
              Principal / capabilities
                        |
                        v
              AuthorizationService
                        |
                        v
              AuthorizedGristService
                  |             |
                  |             +--> AuditLogger
                  v
                 GristService
                        |
          +-------------+-------------+
          |                           |
          v                           v
     GristClient                bounded /apply
     REST operations            UserActions only
          +-------------+-------------+
                        |
                        v
                 Grist Community
```

## Responsibility boundaries

### Transport adapters

GPT Actions and MCP translate protocol-specific calls into the same service methods. No Grist authorization rule should depend on the transport implementation itself.

### Principal

Each authenticated bridge client is represented as a `Principal` with:

- a stable internal ID;
- a transport (`gpt-actions` or `mcp` today);
- one or more resource grants;
- Grist-aligned capabilities.

The current single-user deployment creates two static principals from the existing bearer tokens. This is deliberately replaceable later by OIDC/OAuth or another authenticator.

### AccessPolicy

`AccessPolicy` remains the deployment-level resource boundary. It defines which document IDs and/or workspaces may be exposed by this bridge at all.

### AuthorizationService

`AuthorizationService` intersects:

1. the deployment `AccessPolicy`;
2. the current principal's resource grants;
3. the operation's required capability.

Both conditions must pass before a document operation reaches the business service.

### Operation registry

`src/operations/registry.ts` is authoritative for operation policy metadata:

- operation name;
- category;
- required capability;
- read-only flag;
- destructive flag;
- concise purpose.

`AuthorizedGristService` obtains required capabilities from this registry, and `grist_help` exposes the same metadata to clients. The goal is to prevent security policy and tool documentation from drifting apart.

Input/output schemas are still owned by the current GPT/MCP adapters in v0.5. A later compact-surface migration may also generate protocol schemas from shared operation definitions.

### AuthorizedGristService

This facade preserves the validated `GristService` behavior while adding:

- capability enforcement;
- resource authorization;
- principal identity;
- structured audit.

This incremental wrapper avoids rewriting the stable v0.4 service and makes the migration reversible and testable.

### GristService

`GristService` remains the transport-neutral business layer for validated data and schema behavior:

- read/write/schema guardrails;
- exact-target deletion;
- write batching;
- explicit partial-success errors;
- validation of identifiers and counts.

### GristClient and low-level actions

`GristClient` owns explicit REST calls.

Raw `/apply` remains inaccessible to models. v0.5 still uses it internally only for fixed operations:

- `RenameColumn`;
- `RemoveTable`.

Future page/widget support must use a separate bounded UI-actions adapter rather than exposing arbitrary UserActions.

## Capabilities

The initial capability vocabulary intentionally mirrors Grist's official OAuth/MCP model where practical:

```text
doc:read
doc:write
doc.schema:write
```

Semantics:

- `doc:read`: document discovery, tables/columns, semantic context, record reads;
- `doc:write`: record creation/update/deletion;
- `doc.schema:write`: table and column mutations.

The capability model is extensible for future bounded features such as attachments or webhooks without granting them implicitly through `doc:write`.

## Semantic document context

`DocumentContextService` provides a compact structural representation intended for reasoning before complex modifications.

It currently reports:

- table IDs;
- column IDs, labels and types;
- formulas and formula flags;
- `Ref` / `RefList` relationships;
- table/column/relation counts.

It deliberately does not read user-table rows. MCP exposes it as `inspect_document`; GPT Actions exposes `inspectGristDocument`.

This service is stateless in v0.5. Future versions may extend it with pages/widgets and bounded caching invalidated after structural mutations.

## Audit model

Every call routed through `AuthorizedGristService` emits one structured JSON event containing only operational metadata:

```text
requestId
principal
transport
operation
capability
documentId (when applicable)
itemCount (when meaningful)
status
durationMs
errorType (on failure)
```

Cell values, API keys and bearer tokens are never intentionally logged by the audit layer.

The current VPS can rely on `journald`; an institutional deployment may route the same event shape to centralized audit infrastructure.

## Personal deployment

The current validated personal architecture remains intentionally simple:

```text
ChatGPT Plus
   |
   | HTTPS / GPT Actions token
   v
personal VPS bridge
   |
   | personal Grist API key (server-side only)
   v
Grist Community DINUM
```

`GPT_ACTION_CAPABILITIES` and `MCP_CAPABILITIES` allow the two client principals to be restricted independently without changing the Grist API key.

## Future institutional substitution points

v0.5 does not implement institutional IAM. It prepares clean replacement points:

```text
static bearer principal today
        -> future OIDC/OAuth principal

single server-side API key today
        -> future delegated-user credential provider
```

Business services should not need to know which authentication or credential mechanism produced the authorized request.

If the target Grist deployment later offers the official Grist MCP/OAuth functionality directly, using the official integration should be preferred over maintaining equivalent bridge functionality.

## Deliberate exclusions

The bridge continues to exclude:

- generic HTTP forwarding;
- raw SQL;
- arbitrary `/apply` / UserActions;
- unrestricted instance administration;
- user/ACL administration.

## Next architectural layer

The intended v0.6 direction is bounded document UI composition modeled on Grist's official MCP semantics:

- inspect pages/widgets;
- create/update/remove pages;
- add/configure native or known custom widgets;
- configure layouts;
- configure `select-by` links.

Generated executable widget code is explicitly outside this first UI layer and should be treated as a separate security boundary.

## Architectural invariant

> Every capability exposed to a model must correspond to a named Grist operation with explicit server-side resource authorization, an explicit required capability and predictable bounded effects.
