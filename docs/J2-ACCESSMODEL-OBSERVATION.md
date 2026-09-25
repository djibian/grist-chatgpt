# J2 AccessModel observation

Status: **J2-A implementation foundation; controlled live Grist proof still required.**

This document records the bounded internal observation contract introduced for J2. It does not add a public MCP operation and does not claim that the DINUM stage-tracking reference has been verified.

## Purpose

J2 needs a semantic description of the Grist access policy that can be compared with an independently accepted `BehavioralContract`. The implementation may read Grist's internal ACL metadata with an explicitly owner-authorized document context, but raw metadata is not itself model-facing evidence.

The first adapter is `src/grist/accessModelObserver.ts`.

## Owner-scoped fixture probe

`npm run j2:observe-fixture` is an internal, read-only entry point for exercising that adapter. Supply `J2_GRIST_BASE_URL` (HTTPS origin, or local HTTP loopback), `J2_FIXTURE_DOCUMENT_ID` (plain ID, not a URL) and `J2_GRIST_OWNER_API_KEY` through a protected runtime environment. The key must belong to the disposable fixture's owner and must never be placed in the command line, repository, logs or model input. The script does not use the public MCP operation or the bridge's shared development credential.

Before any internal table read, it discovers the document with that credential and requires exactly one match named `J2-stage-tracking-fixture` in workspace `ChatGPT` with `owners` access. It then permits hidden, capped reads only of the four metadata tables below and the exact fixture ID. The JSON output contains normalized AccessModel data, completeness/issues, a metadata fingerprint and a digest of the document ID; it omits the raw document ID, rule formulas, literal secrets and LinkKeys. Error output does not include upstream response bodies or URLs. A failure is not an instruction to fall back to a public `_grist_*` query.

The probe has not been run against Grist from this repository execution: no dedicated fixture-owner credential is available in this environment. Its local tests verify target/owner preflight, internal read bounds and secret-free output, but cannot certify the remote version, effective teacher permissions, sharing, or fixture/reference parity. After an authorized run, record its bounded result and Grist version if available; keep raw secrets and document identifiers outside repository evidence.

## Upstream reference review

Bounded reference review used Grist's current public `grist-core` implementation:

- `app/common/schema.ts` — `_grist_ACLRules`, `_grist_ACLResources`, `_grist_Shares` and `_grist_DocInfo` persisted fields;
- `app/common/ACLPermissions.ts` — `permissionsText` syntax (`C`, `R`, `U`, `D`, `S`, plus `all` / `none` aliases);
- `app/common/ACLRulesReader.ts` — rule ordering and the fact that share handling may add **virtual**, non-persisted ACL resources/rules;
- `app/client/aclui/AccessRules.ts` — `user.LinkKey` and user-attribute structure used by Grist's access-rule UI.

Classification: **REIMPLEMENT**. These sources are the behavioral/schema oracle only; no Grist source code is copied into this repository.

## Authority boundary

An observation requires an explicit internal context containing:

- normalized non-URL document identifier;
- bridge principal identifier;
- mandate identifier;
- `ownerAuthorized: true`.

The adapter reads through the already resource-bounded internal `GristService`, not through `AuthorizedGristService.queryRecords()`. The latter continues to reject `_grist_*` table targets at the public/model-facing boundary.

This context is a necessary bridge-side guard, not proof that an arbitrary principal owns the Grist document. The controlled J2-A run must additionally establish that the configured upstream Grist credential is the intended owner-authorized fixture credential. The present shared development credential must not be used to reveal ACL state across bridge principals.

## Observed metadata

The first adapter reads only:

- `_grist_ACLResources`;
- `_grist_ACLRules`;
- `_grist_Shares`;
- `_grist_DocInfo`.

Reads are hidden/internal and capped at `min(GRIST_MAX_READ_RECORDS, 2000)` when a positive bridge limit exists, otherwise 2000. Reaching that cap makes the observation `PARTIAL`.

The semantic output contains:

- resources by internal row id, table id and bounded column ids;
- ordered rules and normalized create/read/update/delete/schema-edit decisions;
- validated user-attribute metadata;
- dependency identifiers extracted from `aclFormulaParsed`, including `user.LinkKey`, `rec.Suivi_par` and `Acces_Stages_Actif` when present;
- document schema version when available;
- share counts and whether published shares exist;
- one aggregate SHA-256 metadata fingerprint for change detection;
- explicit completeness/issues.

Fingerprint construction is itself bounded by finite string, array, object-key, node and depth budgets. If raw metadata exceeds those budgets or contains an unsupported value, the observer hashes only a bounded marker representation, records `metadata_fingerprint_incomplete`, and reports the overall observation as `PARTIAL`; it never falls back to returning the oversized/deep raw value.

## Data minimization

The output deliberately omits:

- `aclFormula`;
- the parsed formula tree;
- literal constants from either representation;
- principals text and rule memos;
- share `linkId`, labels, descriptions and raw options;
- LinkKey values, URLs, credentials or cookies;
- arbitrary upstream response fields.

Tests place synthetic secret markers in formulas and share metadata and assert that none reaches the normalized observation.

## Conservative unknowns

Persisted ACL tables are not always the complete effective AccessModel. In current Grist, share processing can synthesize virtual rules on top of persisted rules. Therefore any observed share makes `virtualRuleContext = UNKNOWN` and the overall observation `PARTIAL` until a separately versioned adapter can reproduce or obtain the effective virtual context safely.

Likewise, malformed/unsupported formula ASTs, user-attribute specs, permission strings, resource references, rule positions, schema-version metadata, fingerprint-budget exhaustion or limit saturation remain explicit issues. The adapter does not fall back to exposing raw rules to recover certainty.

## Evidence still required for J2-A

Before J2-A can be called complete, a controlled synthetic Grist Community fixture must establish, for the target deployment/version:

1. the owner-authorized bridge path can actually read the required internal ACL metadata;
2. the observation records the intended fixture/document and supported version context;
3. the normalized output is complete enough for the stage-tracking dependency set, or remaining constructs are explicitly `UNKNOWN`;
4. no raw formula/literal/LinkKey/credential leaks through model output or audit;
5. fixture/reference parity is not claimed until the real reference receives its own authorized observation.

A public `query_records` call against `_grist_*` is intentionally not an acceptable substitute: that surface must continue to reject internal metadata tables.
