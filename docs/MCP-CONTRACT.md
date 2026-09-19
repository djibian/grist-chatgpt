# MCP contract v1

This document records the current public MCP contract direction introduced by C2 and subsequently hardened. It does not by itself change Grist business logic, credentials, authentication, scopes or deployment authorization.

## Normative operation metadata

`src/operations/registry.ts` is authoritative for shared public operation metadata:

- operation name/category;
- required bridge capability;
- user-oriented title, summary and description;
- `readOnlyHint` source value;
- `destructiveHint` source value;
- `openWorldHint` source value.

MCP registrations derive these values from the registry so descriptions/risk metadata cannot silently diverge from authorization/audit policy. Input schemas remain next to concrete registrations because they contain transport validation and configured bounds.

## Risk annotations

Current rules:

- only operations with no state changes, including no audit writes, use `readOnlyHint: true`;
- audited reads therefore use `readOnlyHint: false` while remaining non-destructive;
- additive create operations use `destructiveHint: false`;
- operations that may overwrite, rename, clear or delete existing Grist state use `destructiveHint: true`;
- all current operations remain confined to the configured Grist environment, so `openWorldHint: false`.

Full-surface tests compare MCP registrations with the registry. Submission justifications are generated from the same registry through `src/operations/submissionAnnotations.ts` / `npm run submission:annotations`.

Current audited `doc:read` operations — `list_documents`, `list_tables`, `list_columns`, `query_records`, `inspect_document`, `get_pages`, `get_page_widgets` — intentionally use `readOnlyHint: false` because execution appends an audit event. `grist_help` remains the unaudited `readOnlyHint: true` utility.

## Successful output direction

The contract distinguishes **stable semantic result projection** from formal MCP `outputSchema` coverage.

### UI family

Stable `outputSchema` / `structuredContent` are already used where the bridge has normalized document-UI structures:

- `get_pages`;
- `get_page_widgets`;
- `create_page`;
- `add_page_widget`;
- `rename_page`;
- `update_page_widget`.

These outputs expose reusable stable IDs without requiring prose parsing. Page/widget inspection now includes bounded normalized sort/select-by information and explicit incompleteness/truncation signals where exact normalization is not possible.

### Discovery/schema projection

Public table/column discovery no longer forwards open-ended raw Grist metadata. The authorized public layer projects only functional schema/context fields needed by supported workflows while internal service paths retain private numeric refs needed for bounded UI/semantic work.

### Success-only mutations

Several update/delete operations whose upstream success body is not semantically required now return bounded semantic acknowledgements instead of retaining arbitrary Grist/batch engine responses:

- `update_records` — target table + exact record IDs + `updated: true`;
- `delete_records` — target table + exact record IDs + `deleted: true`;
- `update_tables` — exact requested table IDs + `updated: true`;
- `update_columns` — target table + exact requested column IDs + `updated: true`;
- `delete_columns` — target table + exact deleted column IDs + `deleted: true`;
- fixed internal `RenameColumn` / `RemoveTable` paths return semantic acknowledgements rather than raw `/apply` response fields.

Partial-batch error semantics are unchanged and continue to report completed work safely.

### Creation results

Create operations retain functional created identifiers because later bounded calls need them. On current `main`, broader create-result normalization/formal `outputSchema` coverage remains separate work; the contract must not freeze arbitrary upstream implementation fields merely for convenience.

Consequently, absence of formal `outputSchema` on a tool does not mean its service result is still an unrestricted raw upstream response, and a normalized service acknowledgement does not automatically imply a formal public `outputSchema` has already been declared.

## Semantic document context

`inspect_document` is deliberately advisory/non-executing and avoids user-table row loading. Current context includes:

- tables/columns/formulas;
- local formula reference diagnostics;
- bounded one-hop `$Ref.Field` / `$RefList.Field` diagnostics from already-loaded schema metadata;
- normalized Ref/RefList relationships including verified reverse relationships;
- normalized page/widget sort/select-by context where exact resolution is possible;
- explicit incompleteness markers when internal metadata cannot be safely represented.

No Python/formula execution, raw SQL or generic code execution is introduced.

## Progressive help

`grist_help` preserves the historical complete-catalog default and additionally supports bounded progressive discovery:

- compact per-category operation counts;
- optional category filtering, mutually exclusive with explicit operation-name filtering;
- optional registry-derived workflow descriptions for common discover/read/create+verify/schema-change+verify/UI-configure+verify sequences.

Workflows are descriptive only. They do not execute operations or duplicate tool input schemas.

## Typed error direction

MCP tool failures use an additive JSON error envelope in text content with a stable `code` and human-readable `error` field. Current categories include:

- `partial_write` — non-atomic batched write failed after some work completed;
- `write_verification_failed` — a UI write may have succeeded but final state could not be verified safely;
- `grist_upstream` — bounded upstream Grist HTTP/API failure;
- `operation_failed` — other bounded validation/operation failure.

Errors deliberately do **not** include success `structuredContent`. Some MCP clients validate present structured content against the success schema even for errors, so typed errors remain text-envelope based rather than masquerading as successful result shapes.

For `partial_write`, the contract preserves operation, completed batches/items, failed batch and `retryWholeOperation: false`.

For `write_verification_failed`, it preserves operation, optional known created ID and `retryWholeOperation: false`.

`retryWholeOperation: false` is a safety invariant: callers reconcile known state instead of blindly replaying possibly partially successful work.

## Authorization boundary

The public capability vocabulary remains exactly:

```text
doc:read
doc:write
doc.schema:write
```

MCP OAuth mode maps validated token scopes into a dynamic principal and verifies issuer/resource/expiry before the principal reaches the Grist context. Static MCP bearer exists only as explicit development/backward compatibility. Neither OAuth tokens nor bridge bearer tokens cross into the upstream Grist credential provider.

## Deliberate exclusions

The MCP contract does not expose:

- generic HTTP forwarding;
- raw SQL;
- arbitrary Grist `/apply`;
- arbitrary UserActions;
- generic user/ACL administration;
- model-visible credentials;
- broad destructive targeting when stable explicit identifiers can be required;
- pseudo-transactions that obscure partial success.

Adding/removing public OAuth scopes or exposing a new generic/destructive capability remains a human-gated product/security decision under `AGENTS.md`.
