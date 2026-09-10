# Security model

## Security objective

The bridge must not turn natural-language access into broader authority than the configured Grist principal and server-side document allowlist provide.

## Main risks

### Over-broad Grist credentials

A Grist API key has the permissions of its owner. A leaked or shared key can therefore expose all resources available to that account.

**Control:** the Grist API key is an environment-only server secret. It is never an MCP parameter, GPT Action parameter, OpenAPI value, or model-visible input.

### Bridge credential confusion

The MCP endpoint and GPT Actions API are distinct trust boundaries.

**Control:** `/mcp` uses `MCP_BEARER_TOKEN`; `/api/v1` uses a separate `GPT_ACTION_TOKEN`. Both must be at least 32 characters and configuration rejects identical values.

### Prompt-driven arbitrary network access

A generic HTTP tool could be repurposed for SSRF or calls outside Grist.

**Control:** there is no arbitrary URL or method tool. `GRIST_BASE_URL` is process configuration, not user input.

### Write amplification

A model could accidentally create or modify a very large number of rows.

**Control:** the bridge enforces hard per-call limits shared by MCP and GPT Actions. Bulk writes above the limit are rejected.

### Destructive actions

Delete operations are difficult to reverse and unnecessary for the proof of concept.

**Control:** no delete tool or REST route is exposed.

### Cross-document confusion

Document IDs and table IDs supplied by the model may target the wrong resource.

**Control:** all MCP and REST operations pass through the same `GristClient`, which rejects any document not present in `GRIST_ALLOWED_DOCUMENT_IDS` before the Grist request is sent.

### Unintended writes from ChatGPT

An HTTP POST used only for querying might otherwise be treated like a write, while actual create/update calls need stronger user awareness.

**Control:** the OpenAPI schema marks `queryGristRecords` as `x-openai-isConsequential: false`, while create and update operations are marked `true`.

### Sensitive-data leakage in logs

Responses can contain personal or operational data.

**Control:** production logging must record request IDs, status, latency and operation names, not credentials or full row contents.

### Malicious cell content / prompt injection

Grist cells can contain untrusted text that attempts to influence the assistant.

**Control:** data returned by Grist is data, not trusted instructions. MCP tool and GPT Action descriptions state this explicitly. Authorization checks remain server-side regardless of model instructions.

## Current limits

- maximum 200 records returned by one read operation;
- maximum 50 records in one create call;
- maximum 50 records in one update call;
- no delete;
- no SQL;
- no arbitrary HTTP;
- no schema mutation;
- explicit document allowlist.

## Secret handling

Never commit or paste:

- Grist API keys;
- `MCP_BEARER_TOKEN`;
- `GPT_ACTION_TOKEN`;
- OAuth client secrets;
- access or refresh tokens;
- session cookies;
- private signing keys.

Use `.env` locally and a root-controlled environment file or secret manager in deployed environments.

## Deployment requirements

For an Internet-facing deployment:

- HTTPS only;
- Node service bound to localhost behind a reverse proxy;
- explicit public host allowlist for DNS-rebinding protection;
- explicit Grist document allowlist;
- independent MCP and GPT Actions bearer credentials;
- credential rotation/revocation path;
- request-size limits before using the bridge with substantial production data;
- rate limiting before broad/public use;
- structured audit events for write actions before broad/public use;
- privacy review for any personal data crossing the bridge boundary.

The current single-user GPT Actions setup is an authenticated prototype, not a multi-user authorization system. A broadly shared/public integration requires per-user authorization or an institutionally controlled account/authorization model.
