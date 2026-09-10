# M3 — Public VPS deployment

## Objective

Validate a stable public HTTPS deployment of `grist-chatgpt` without exposing the Node.js listener directly to the Internet and without committing Grist or MCP secrets.

This milestone validates transport and deployment. It does **not** yet provide the OAuth 2.1 user authentication required for direct ChatGPT integration.

## Validated architecture

```text
remote MCP client
      |
      | HTTPS :443
      v
Caddy reverse proxy
      |
      | HTTP on loopback only
      v
grist-chatgpt :3000
      |
      | inbound MCP bearer token
      | Grist document allowlist
      v
Grist REST client
      |
      | GRIST_API_KEY stored outside the repository
      v
Grist Community DINUM
```

Development/demo endpoint validated on 2026-09-10:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

The hostname identifies the current development instance, not a guaranteed long-term institutional production endpoint.

## Host platform

The validated deployment runs on:

- Debian 13;
- Node.js 24;
- `systemd` for process supervision;
- Caddy for TLS termination and reverse proxying;
- nftables firewall;
- application bound to `127.0.0.1:3000` only.

Secrets are stored outside the Git checkout in a root-managed environment file under `/etc/grist-chatgpt/`.

## DNS rebinding protection

The MCP Express application keeps host validation enabled. Public reverse-proxy hostnames are configured through:

```text
MCP_ALLOWED_HOSTS=<comma-separated hostnames>
```

The application continues to allow localhost automatically. Public hostnames must be explicit hostnames, not URLs or paths.

For this development deployment:

```text
MCP_ALLOWED_HOSTS=grist-chatgpt.loeildumaitre.fr
```

## Validation performed

The following checks succeeded on 2026-09-10.

### Public health endpoint

`GET /healthz` over the public HTTPS hostname returned HTTP 200.

### Unauthenticated MCP request

A public MCP request without the inbound bearer token returned HTTP 401 with a `WWW-Authenticate: Bearer` challenge.

### Authenticated MCP discovery

An authenticated public `tools/list` call succeeded over the normal MCP SSE response transport and exposed the four bounded tools:

- `list_tables`;
- `query_records`;
- `create_records`;
- `update_records`.

### End-to-end Grist read

An authenticated public `query_records` call traversed the complete public path and returned the synthetic `MCP_Test` records from the DINUM Grist Community instance.

The response contained the previously validated synthetic records `Alpha`, `Beta` and `Gamma`. No real user, pupil, contact or production data was used.

This validates:

```text
Internet MCP client
      |
      v
public HTTPS endpoint
      |
      v
Caddy
      |
      v
MCP authentication
      |
      v
grist-chatgpt
      |
      v
Grist REST API
      |
      v
synthetic DINUM Grist document
```

## DINUM outage observed during validation

During validation, direct Grist API calls temporarily returned HTTP 500 with:

```text
Exceeded 10 attempts to lock the resource "workers-lock".
```

The Grist web interface also showed HTTP 502 during the same infrastructure incident. A subsequent MCP request and direct API request succeeded without changing the bridge, confirming that this failure was upstream and transient.

This incident is useful reliability evidence. Future resilience work may add bounded retries for safe read operations only. Write operations must not be retried automatically without an idempotency strategy because a network or upstream failure can occur after a write has already been applied.

## Security boundaries still in force

- the Grist API key is never supplied as an MCP tool argument;
- the Grist document allowlist is enforced before outbound requests;
- the application listener remains loopback-only;
- Caddy is the only public HTTP ingress;
- no delete, SQL, arbitrary HTTP or schema-mutation tool is exposed;
- the public MCP hostname is explicitly allowlisted;
- test data is synthetic.

## Exit criteria

M3 public deployment is considered validated because:

1. DNS resolves the public hostname to the VPS;
2. HTTPS terminates successfully at Caddy;
3. the application remains bound to loopback;
4. public host validation remains enabled;
5. unauthenticated MCP calls are rejected;
6. authenticated MCP discovery succeeds;
7. an authenticated public read reaches the DINUM Grist Community document end to end.

## Next milestone

The static inbound bearer token is suitable for controlled development but is not the target ChatGPT authentication model.

The next milestone is an OAuth 2.1 authorization boundary compatible with the MCP authorization specification and ChatGPT, including protected-resource metadata, authorization-server metadata, PKCE, access-token validation, scopes and revocation/refresh strategy.
