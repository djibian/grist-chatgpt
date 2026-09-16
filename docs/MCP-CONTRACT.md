# MCP contract v1

This document records the public MCP contract direction introduced by C2. It does not change Grist business logic, credentials, authentication, scopes or deployment authorization.

## Normative operation metadata

`src/operations/registry.ts` is the authoritative registry for public operation metadata that is shared across the bridge:

- operation name and category;
- required bridge capability;
- user-oriented title, summary and description;
- `readOnlyHint` source value;
- `destructiveHint` source value;
- `openWorldHint` source value.

MCP registrations derive these fields from the registry so titles, descriptions and risk annotations cannot silently diverge from the authorization/audit operation catalog.

Input schemas remain next to their concrete MCP registrations because they contain transport validation and configured bounds. The registry is metadata, not an alternate business-operation dispatcher.

## Risk annotations

The current contract follows these rules:

- true reads use `readOnlyHint: true`;
- mutations use `readOnlyHint: false`;
- only record, table and column deletion use `destructiveHint: true`;
- all current operations are confined to the configured Grist environment, so `openWorldHint: false`;
- adding or changing a public destructive capability remains a product/security decision, not a metadata refactor.

Full-surface tests compare every MCP registration with the registry and pin the destructive/read-only sets.

## Structured successful outputs

`outputSchema` and `structuredContent` are introduced only where the bridge already produces normalized, stable document-UI structures with identifiers intended for later calls:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
- `update_page_widget`.

These outputs retain text content for compatibility and additionally expose structured content. Page IDs, widget IDs, table IDs/references and select-by source IDs therefore remain directly reusable without parsing prose.

Raw Grist REST response shapes for records and schema operations are intentionally not declared stable in this tranche. Adding an `outputSchema` there should follow normalization of the relevant response rather than freezing an upstream implementation shape accidentally.

## Typed error direction

MCP tool failures use an additive JSON error envelope in text content with a stable `code` and human-readable `error` field. Current categories are:

- `partial_write` — a non-atomic batched write failed after some work completed;
- `write_verification_failed` — a UI write may have succeeded but its final state could not be verified safely;
- `grist_upstream` — Grist returned an upstream HTTP/API failure;
- `operation_failed` — other bounded validation or operation failures.

Errors deliberately do **not** include `structuredContent`. Success `outputSchema` describes the stable successful result only, and some MCP clients validate any present `structuredContent` against that success schema even for `isError: true`. Keeping the typed error envelope in text content avoids converting a recoverable tool error into a client-side schema failure. Upstream response bodies and internal stacks are not exposed.

For `partial_write`, the contract preserves `operation`, `completedBatches`, `completedItems`, `failedBatch` and `retryWholeOperation: false`.

For `write_verification_failed`, the contract preserves `operation`, an optional known `createdId`, and `retryWholeOperation: false`.

`retryWholeOperation: false` is a safety invariant: callers must reconcile the reported state rather than blindly replaying a possibly partially successful write.

## Deliberately unchanged

C2 does not:

- change the Grist credential model or credential storage;
- start OAuth or select an identity provider;
- add, remove or reinterpret public scopes/capabilities;
- change server/resource authorization;
- expose raw `/apply`, arbitrary UserActions, SQL or generic HTTP;
- add new Grist feature breadth;
- change the bounded semantics of existing operations.
