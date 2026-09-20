# Public output minimization audit

Audit baseline: exact `main` `2b5e4c124b2e4d50c47d6aad1efd89b30fc75f2e`.

Purpose: satisfy the bounded S1 review of the current model-visible operation outputs. This audit asks whether the bridge returns fields that are unnecessary for the declared semantic operation. It does not redesign the stable v1 contract and does not treat explicitly requested Grist row contents as accidental disclosure.

## Scope

The audit covers the 22 operations in the normative operation registry at its recorded audit baseline and the common MCP error mapper:

- discovery: `list_documents`, `list_tables`, `list_columns`;
- data: `query_records`, `create_records`, `update_records`, `delete_records`;
- schema: `create_tables`, `update_tables`, `delete_table`, `create_columns`, `update_columns`, `rename_column`, `delete_columns`;
- context: `inspect_document`;
- UI: `get_pages`, `get_page_widgets`, `create_page`, `add_page_widget`, `rename_page`, `update_page_widget`;
- utility: `grist_help`;
- failure responses produced by `errorResult`.

This is a current-surface audit for that exact historical baseline. Deferred operations and hypothetical P4/P5/P6 surfaces were out of scope of the audit itself. `update_page_layout` was added later under the same bounded normalized-UI/minimization rules and is included in the subsequent P4-E1 surface evaluation.

## Results by surface

### Discovery

`list_documents` projects the allowed-document graph to functional organization/workspace/document identifiers, names/domains where applicable and access metadata. Arbitrary upstream extension fields are not forwarded.

`list_tables` and `list_columns` pass through `projectPublicTables` / `projectPublicColumns`. Public column metadata is limited to stable column ID plus `label`, `type`, `isFormula`, `formula`, `description` and `widgetOptions`. Internal numeric engine references remain server-side. Table metadata is limited to stable ID, `onDemand`, summary semantics expressed with stable table IDs, and optional projected columns.

Disposition: **acceptable and functionally justified**. Formula text and column widget options are document schema authored by the Grist user and are needed by the current schema/formula/UI assistance contract. No arbitrary upstream metadata is forwarded.

### Record reads

`query_records` intentionally returns Grist row contents because returning selected records is the semantic purpose of the operation. Reads remain document/table scoped and record-count bounded by the configured MCP read limit, with a default request limit of at most 50.

Disposition: **not a minimization finding**. Row data is model-visible only through an explicit row-read operation; `inspect_document`, page discovery and progressive help do not load it implicitly.

### Record and schema mutations

Successful update/delete operations return bounded semantic acknowledgements containing stable requested targets rather than raw upstream success bodies. Successful create operations project upstream results to the functional created record/table/column IDs and use `resultNormalizationIncomplete: true` when a successful upstream response cannot be normalized exactly instead of forwarding unknown fields or guessing completeness. Fixed internal Grist UserAction results are discarded.

Disposition: **pass**. No unnecessary upstream response fields were found in the current success outputs.

### Semantic document context

`inspect_document` exposes schema/formula/reference/UI metadata needed for compact document reasoning and does not indiscriminately read user-table rows. Normalized relation and UI state is emitted only when exact resolution is possible, with explicit incompleteness markers rather than guessed values.

Disposition: **pass**. Formula strings and schema/UI metadata are necessary inputs to the declared semantic-inspection operation.

### UI reads and mutation re-reads

The normalized UI views are data-minimized: stable widget/table/column IDs, normalized layout, saved sort, select-by metadata and bounded custom-widget settings are exposed without duplicating custom-widget URLs, plugin internals or arbitrary widget-owned values into `customWidgetSettings`.

The stable v1 page/widget output nevertheless retains historical raw/internal compatibility fields, including some of:

- `pageRecordId`;
- numeric `tableRef`;
- raw `layoutSpec`;
- raw widget `options`;
- raw `sortColRefs`;
- raw numeric select-by metadata (`sourceSectionId`, `sourceColumnRef`, `targetColumnRef`).

`options` is the broadest compatibility field and may contain existing custom-widget URL/plugin/widget-owned configuration that is deliberately excluded from the normalized semantic view. These values are document metadata already readable by a principal with `doc:read`; they are not bridge credentials, OAuth tokens or Grist API keys. They are nevertheless broader than the minimum needed by the newer normalized UI contract.

Finding **S1-OUT-1 — accepted compatibility debt**:

- do not remove these fields inside S1 because the repository explicitly documents them as v1 compatibility state and silent removal would be a breaking public-contract change;
- do not add new product behavior that depends on the raw compatibility fields when a normalized stable-ID equivalent exists;
- new UI capabilities should extend the normalized bounded view rather than add new arbitrary raw option payloads.

P4-E1 follow-up, evaluated against exact `main` `d6375dc56179258218792740f1fb37ab1cffd1e3`:

- P4-E1 selects **KEEP** for the current 23-operation narrow v1 execution surface;
- that decision does not silently remove or rewrite the raw v1 compatibility fields identified here;
- `S1-OUT-1` therefore remains accepted v1 compatibility debt rather than an implicit P4 implementation task;
- any future removal/deprecation of those fields requires a separate explicit versioned output migration/deprecation contract and tests.

Disposition: **explicitly dispositioned; no S1 or P4-E1 runtime patch**.

### Progressive help

`grist_help` returns the bounded operation registry, category counts/filters and optional registry-derived workflow metadata. It does not expose credentials, document contents or operation payload instances.

Disposition: **pass**.

### Error outputs

Known Grist API failures expose only the generic bridge message and HTTP status. The upstream response body is retained on the internal `GristApiError` object for bridge use but is not copied into the MCP error body. Partial-write errors expose only the bounded progress data required to prevent blind replay. UI verification failures expose the semantic operation and, when relevant, the created ID needed to reason about ambiguous success. Unknown bridge errors return the exception message but not stack traces or arbitrary object serialization.

Disposition: **pass for the current mapper**. Future error types must preserve the same rule: never forward arbitrary upstream bodies or secret-bearing objects as model-visible error payloads.

## Audit conclusion

The recorded public surface satisfies the S1 minimization audit with one concrete compatibility finding, `S1-OUT-1`. P4-E1 subsequently evaluates the now-23-operation execution surface and selects KEEP; the finding remains deliberately retained for v1 and is not converted into a silent breaking change. No current success/error output was found to expose Grist API keys, OAuth credentials, raw arbitrary upstream success bodies or indiscriminately loaded user rows.

No runtime change is required by this audit or by P4-E1. The remaining S1 evidence item is external: prove and record `email` with `email_verified: true` on the final reviewer-compatible UserInfo path.
