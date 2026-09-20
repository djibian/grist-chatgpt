# P4 compact MCP surface evaluation

## Scope

P4-E1 evaluates whether the current public MCP surface should be compacted. It is an evaluation-only tranche: this document does not change runtime behavior, public tool schemas, OAuth scopes, compatibility behavior or operation semantics.

Evaluation baseline:

```text
main: d6375dc56179258218792740f1fb37ab1cffd1e3
operations: 23
```

The normative source for the inventory is `src/operations/registry.ts` on that exact baseline.

Product invariant:

```text
1 invocation = 1 bounded semantic intention
```

Any compaction must also preserve operation-specific authorization capability, MCP risk annotations, explicit partial/ambiguous-write behavior, exact-target semantics and the stable v1 compatibility contract.

## Exact v1 inventory

All operations are `openWorld: false`. Audited Grist reads intentionally have `readOnlyHint: false` because the audit event is a state change; `grist_help` is the only true read-only tool.

| Operation | Category | Capability | Effect / MCP risk | Replay / ambiguity note |
| --- | --- | --- | --- | --- |
| `list_documents` | discovery | `doc:read` | audit-only read; non-destructive | none |
| `list_tables` | discovery | `doc:read` | audit-only read; non-destructive | none |
| `list_columns` | discovery | `doc:read` | audit-only read; non-destructive | none |
| `query_records` | data | `doc:read` | audit-only read; non-destructive | none |
| `create_records` | data | `doc:write` | write; non-destructive annotation | large requests may partially succeed; never replay the whole request after partial success |
| `update_records` | data | `doc:write` | destructive write | large requests may partially succeed; never blindly replay |
| `delete_records` | data | `doc:write` | destructive write | explicit record IDs; large requests may partially succeed; never blindly replay |
| `create_tables` | schema | `doc.schema:write` | structural write; non-destructive annotation | bounded creation |
| `update_tables` | schema | `doc.schema:write` | destructive structural write | explicit targets |
| `delete_table` | schema | `doc.schema:write` | destructive structural write | exactly one explicit table |
| `create_columns` | schema | `doc.schema:write` | structural write; non-destructive annotation | bounded creation |
| `update_columns` | schema | `doc.schema:write` | destructive structural write | explicit targets |
| `rename_column` | schema | `doc.schema:write` | destructive structural write | exactly one explicit column ID rename |
| `delete_columns` | schema | `doc.schema:write` | destructive structural write | explicit targets; multiple removals may partially succeed; never blindly replay |
| `inspect_document` | context | `doc:read` | audit-only structural read; non-destructive | no user-table row scan |
| `get_pages` | ui | `doc:read` | audit-only UI read; non-destructive | bounded normalization with explicit incompleteness |
| `get_page_widgets` | ui | `doc:read` | audit-only UI read; non-destructive | bounded normalization/candidate discovery with explicit incompleteness/truncation |
| `create_page` | ui | `doc.schema:write` | structural write; non-destructive annotation | post-write re-read verification |
| `add_page_widget` | ui | `doc.schema:write` | structural write; non-destructive annotation | post-write re-read verification |
| `rename_page` | ui | `doc.schema:write` | destructive UI write | exact post-write verification; ambiguous post-write state is not blindly replayed |
| `update_page_layout` | ui | `doc.schema:write` | destructive UI write | exact normalized post-write verification; ambiguous post-write state is non-retryable at whole-operation level |
| `update_page_widget` | ui | `doc.schema:write` | destructive UI write | bounded read-modify-write and exact verification; ambiguous post-write state is non-retryable at whole-operation level |
| `grist_help` | utility | none | true read-only; non-destructive | discovery only |

Category counts:

```text
discovery  3
data       4
schema     7
context    1
ui         7
utility    1
-----------
total     23
```

Capability split:

```text
none               1
doc:read            7
doc:write           3
doc.schema:write   12
```

The capability counts alone do not define safe grouping because operations sharing a capability still differ in destructive annotation, target cardinality and partial/ambiguous-write semantics.

## Compaction patterns evaluated

### A. One records manager

Candidate shape:

```text
records(action = query | create | update | delete, ...)
```

This would reduce four named tools to one tagged-union tool, but it would mix:

- `doc:read` and `doc:write`;
- audit-only reads and mutations;
- non-destructive creation with destructive update/delete;
- simple read semantics with non-atomic batch partial-success semantics.

MCP risk annotations are attached to the tool, not to a runtime discriminator supplied inside one invocation. A single records manager would therefore either under-describe destructive effects or require conservative annotations that make harmless reads look destructive/write-like. It would also make authorization and confirmation behavior less legible while preserving essentially the same payload complexity inside a larger union schema.

**Disposition: reject.**

### B. Table and column schema managers

Candidate shapes:

```text
tables(action = create | update | delete, ...)
columns(action = create | update | rename | delete, ...)
```

These preserve the common `doc.schema:write` capability, but they still combine materially different risk semantics:

- create operations are non-destructive annotations;
- update/rename/delete operations are destructive;
- `delete_columns` has explicit partial-success/no-blind-replay behavior that does not apply uniformly to the other actions;
- rename and delete have deliberately narrow target contracts that become less obvious behind a generic action discriminator.

The apparent reduction in tool count would be purchased by broader schemas and less precise tool-level risk metadata, without reducing the number of semantic decisions the model must make.

**Disposition: reject.**

### C. One pages/UI manager

Candidate shape:

```text
pages(action = inspect | inspect_widgets | create | add_widget | rename | update_layout | update_widget, ...)
```

This is the most aggressive apparent compaction but has the largest semantic mismatch. It would combine:

- `doc:read` inspection with `doc.schema:write` mutation;
- audit-only reads, non-destructive creates and destructive mutations;
- simple page creation, exact widget creation, page rename, full bounded layout replacement and bounded widget read-modify-write behavior;
- different post-write verification and ambiguity semantics.

A single annotation/capability contract cannot accurately describe all of those effects. A large tagged union would also hide the stable-ID input contract specific to each UI intention and make approval prompts less informative.

**Disposition: reject.**

### D. Group only operations with identical capability and broad risk class

A more conservative approach could introduce separate read/create/destructive managers, for example a schema-create manager or a destructive UI manager.

This avoids some capability mixing but still has weak value:

- tool-level destructive metadata becomes more accurate, but semantic target contracts remain heterogeneous;
- tagged union schemas grow while individual bounded intentions remain unchanged;
- partial-success and exact verification rules still differ by action;
- the model must still select the same underlying intention, now through an additional `action` discriminator;
- the total surface shrinks only by replacing several small explicit schemas with fewer large union schemas.

Compaction by itself therefore does not demonstrate improved routing, safety or maintainability.

**Disposition: reject for v1.**

### E. Keep narrow execution tools and compact discovery/context

The current design already provides the safer form of compactness:

- `grist_help` is one progressive entry point over the operation registry, with category filtering and optional workflows;
- `inspect_document` supplies compact semantic document context for complex work;
- execution remains granular, so each invocation retains precise capability, destructive metadata, stable-ID contract and failure semantics.

This separates **discovery compactness** from **execution granularity** instead of forcing both concerns into super-tools.

**Disposition: retain.**

## Compatibility and data minimization

The existing 23 operations remain the stable v1 compatibility surface.

P4-E1 does not silently remove compatibility fields from existing outputs. In particular, the raw UI v1 compatibility fields previously dispositioned by `S1-OUT-1` remain part of the current v1 contract. Any future removal, replacement or versioned normalization of those fields requires its own explicit migration/deprecation contract and tests; it is not implied by the decision to keep the current tool topology.

Likewise, KEEP does not forbid a future v2 surface if concrete client evidence later shows that a different contract is materially better. Such work would be a new roadmap decision rather than continuation of P4-E1.

## Decision

**KEEP the current 23-operation narrow v1 execution surface.**

Rationale:

1. the current split preserves exact tool-level authorization and MCP risk annotations;
2. destructive, non-destructive, audit-only and true-read-only effects remain distinguishable before invocation;
3. partial-success and ambiguous-write/no-blind-replay semantics stay attached to the exact operation that owns them;
4. stable-ID and exact-target contracts remain small and explicit;
5. `grist_help` and `inspect_document` already provide compact progressive discovery/context without weakening execution semantics;
6. the evaluated manager patterns mostly move complexity from the tool list into tagged-union schemas and action dispatch, rather than removing semantic complexity;
7. no demonstrated product need justifies a v1 migration/deprecation cost.

## Consequences

- no MCP runtime code changes;
- no GPT Actions/OpenAPI compatibility changes;
- no public tool/schema removal or rename;
- no OAuth scope changes;
- no implementation slice follows from P4-E1;
- P4-E1 is complete once this decision passes independent review and is integrated;
- after integration, P4 requires its normal integrated tranche-completion review against exact `main` before being marked DONE.
