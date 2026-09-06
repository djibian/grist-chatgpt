# Security model

## Security objective

The bridge must not turn natural-language access into broader authority than the authenticated Grist principal already has.

## Main risks

### Over-broad credentials

A Grist API key has the permissions of its owner. A leaked or shared key can therefore expose all resources available to that account.

**Control:** API keys are development-only, environment-only secrets. They are never MCP parameters.

### Prompt-driven arbitrary network access

A generic HTTP tool could be repurposed for SSRF or calls outside Grist.

**Control:** there is no arbitrary URL or method tool. `GRIST_BASE_URL` is process configuration, not user input.

### Write amplification

A model could accidentally create or modify a very large number of rows.

**Control:** V0 enforces hard per-call limits. Bulk writes above the limit are rejected.

### Destructive actions

Delete operations are difficult to reverse and unnecessary for the proof of concept.

**Control:** no delete tool in V0.

### Cross-document confusion

Document IDs and table IDs supplied by the model may target the wrong resource.

**Control:** tools require explicit document/table identifiers. Production authorization must constrain accessible resources server-side; prompt wording alone is never an authorization boundary.

### Sensitive-data leakage in logs

Responses can contain personal or operational data.

**Control:** production logging must record request IDs, status, latency and tool names, not credentials or full row contents.

### Malicious cell content / prompt injection

Grist cells can contain untrusted text that attempts to influence the assistant.

**Control:** data returned by Grist is data, not trusted instructions. Tool descriptions and future plugin guidance must state this explicitly. Authorization checks remain server-side regardless of model instructions.

## V0 limits

- maximum 200 records returned by one read operation;
- maximum 50 records in one create call;
- maximum 50 records in one update call;
- no delete;
- no SQL;
- no arbitrary HTTP;
- no schema mutation.

## Secret handling

Never commit or paste:

- Grist API keys;
- OAuth client secrets;
- access or refresh tokens;
- session cookies;
- private signing keys.

Use `.env` locally and a secret manager in deployed environments.

## Production requirements

Before a public deployment:

- HTTPS only;
- scoped/revocable user authorization;
- explicit allow-list of target Grist hosts;
- rate limiting;
- request-size limits;
- structured audit events for write actions;
- credential rotation/revocation path;
- synthetic reviewer environment;
- privacy review for any personal data crossing the MCP boundary.
