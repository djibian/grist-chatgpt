# Operational observability contract

This document defines the implementation-neutral observability vocabulary for the C6 production-hardening track. It does **not** select Prometheus, OpenTelemetry, a log backend, an alerting service or a retention product, and it does not add runtime instrumentation by itself.

The objective is to make future metrics and audit export comparable, bounded and non-secret while preserving the existing authorization model.

## Separation of concerns

Operational metrics and audit events serve different purposes and must not be collapsed into one stream:

- **metrics** answer aggregate operational questions such as request volume, latency and failure rate;
- **audit events** retain request-level security/accountability context for an authorized operator;
- **application logs** remain diagnostic and must not become an informal credential or payload archive.

Metrics must be low-cardinality and must not identify users or Grist documents. Audit events may contain bounded identifiers required for traceability, but their sink, access and retention require production operator policy.

## Metric vocabulary

The names below are the normative semantic vocabulary. A concrete exporter may apply its normal naming conventions (for example `_total` counters or `_seconds` histograms) as long as the meanings and allowed dimensions stay equivalent.

### Operation requests

`grist_bridge_operation_requests`

Counter of completed semantic bridge operations.

Allowed dimensions:

- `operation`: operation name from the normative operation registry only;
- `transport`: bounded transport enum (`mcp` or the compatibility adapter value already represented by `Principal.transport`);
- `capability`: one of `doc:read`, `doc:write`, `doc.schema:write`;
- `status`: `success` or `error`;
- `error_class`: absent on success; on error, one of the bounded classes defined below.

### Operation duration

`grist_bridge_operation_duration`

Histogram of completed semantic operation duration, derived from the same execution boundary as the current audit `durationMs` value.

Allowed dimensions:

- `operation`;
- `transport`;
- `capability`;
- `status`.

Exporter-specific histogram buckets are an operational tuning choice and are not fixed here.

### Operation item count

`grist_bridge_operation_items`

Optional histogram for the bounded `itemCount` already carried by write/schema audit events. It is intended to expose workload shape and limit pressure, not record-level identity.

Allowed dimensions:

- `operation`;
- `transport`;
- `capability`;
- `status`.

Do not add table IDs, record IDs or document IDs as dimensions.

### HTTP service requests

`grist_bridge_http_requests`

Optional counter for the outer HTTP boundary when instrumentation is added.

Allowed dimensions:

- `route_class`: a bounded route template/category defined in code, never the raw URL;
- `method`: bounded HTTP method;
- `status_class`: `2xx`, `3xx`, `4xx` or `5xx`.

Raw path parameters, query strings, hostnames supplied by clients and OAuth codes/tokens are forbidden dimensions.

### Upstream failures

`grist_bridge_upstream_failures`

Optional counter for failures at an external dependency boundary when the implementation can classify them without exposing upstream payloads.

Allowed dimensions:

- `dependency`: bounded enum such as `grist`, `oauth_jwks` or another explicitly configured production dependency;
- `failure_class`: bounded enum such as `timeout`, `network`, `http_4xx`, `http_5xx`, `invalid_response`.

Do not use upstream URLs, response bodies, token claims, issuer-specific user identifiers or exception messages as dimensions.

## Bounded metric error classes

The current audit stream records `errorType` from the JavaScript `Error.name`. That value is useful in request-level audit evidence but is not guaranteed to stay low-cardinality enough for a metric label. Metrics must map runtime failures into this bounded vocabulary:

- `validation` — invalid bounded input before an upstream effect;
- `authorization` — deployment/principal/capability denial;
- `upstream_timeout` — bounded upstream timeout/abort;
- `upstream_http` — classified upstream HTTP failure not represented more specifically;
- `write_verification` — post-write state could not be verified and blind replay is unsafe;
- `protocol` — OAuth/MCP/protocol contract rejection;
- `internal` — uncategorized internal failure.

A future implementation may refine this list through a reviewed change, but must not fall back to exception messages or arbitrary user-derived strings as label values.

## Forbidden metric dimensions and values

The following must never become metric labels, metric names or exemplars exported to a general monitoring backend:

- `principal` or any email / OIDC subject / user identifier;
- `documentId`, workspace ID, table ID, column ID, record ID, page ID or widget ID;
- `requestId`;
- Grist API keys, OAuth/JWT/bearer tokens, authorization codes, cookies, encryption keys or session secrets;
- request/response bodies or formula contents;
- raw URLs, query strings or user-supplied error messages.

This restriction prevents both sensitive-data leakage and unbounded time-series cardinality.

## Audit event review

The current `AuditEvent` contract is:

- `requestId`;
- `principal`;
- `transport`;
- `operation`;
- `capability`;
- optional `documentId`;
- optional `itemCount`;
- `status`;
- `durationMs`;
- optional `errorType`.

`AuditLogger` emits these fields as a structured `grist.audit` JSON event with a timestamp. The current event does not include request/response bodies, credentials, bearer tokens, OAuth authorization codes, cookies or error messages. This is the correct default boundary and must be preserved.

### Audit fields that require protected handling

`principal`, `documentId` and `requestId` are intentionally **audit-only** identifiers. Depending on deployment identity mapping they may be personal or pseudonymous operational data. They therefore require:

- access-controlled operator storage;
- a documented retention period;
- no model-visible retrieval surface;
- no reuse as general metric labels;
- no inclusion in public issue/PR evidence unless replaced with synthetic values.

The production retention duration and audit sink are operator/institutional decisions and are not selected in this tranche.

### Error representation

Audit events currently record only `errorType`, not the exception message. Preserve that distinction. If structured audit export later requires a richer reason, use a reviewed bounded error code/class. Do not export upstream response bodies, stack traces containing secrets, OAuth claims or arbitrary exception messages by default.

### Item count

`itemCount` is acceptable audit/aggregate metadata because it records the requested bounded operation size rather than row contents. It must remain numeric and must not be replaced by lists of record identifiers.

## Correlation

`requestId` is the request-level correlation key for protected audit/debug workflows. It is not a metric dimension. A monitoring implementation may correlate an aggregate alert with protected audit data by time window and operation; direct user/document identifiers are not required in the metric stream.

## Implementation constraints for later C6 work

When runtime instrumentation/export is implemented after the relevant C4/C5 dependencies:

1. derive operation names/capabilities from the normative registry or authorized execution boundary rather than free-form strings;
2. keep metric dimensions within the bounded sets above;
3. keep audit and metric exporters independent enough that a metrics backend never needs `principal` or `documentId`;
4. never log/export secrets or model-visible credentials;
5. preserve principal isolation when per-principal rate limiting is added, even though the principal identifier itself must not become a metric label;
6. document concrete exporter, retention, scrape/export authentication and alert thresholds as deployment decisions rather than silently embedding them into the product contract.

## C6 boundary after this preparation

This document completes the currently independent **metrics vocabulary** and **audit event format review** preparation items. It does not complete C6.

C6 finalization still depends on C4/C5 for per-principal rate limiting, operational instrumentation/alerting, any required structured audit export, secret/key rotation procedure, controlled production deployment/rollback evidence and authenticated post-deploy synthetic smoke evidence.
