# M3 — Public VPS deployment

> **Historical snapshot.** This document records the bridge state validated on **2026-09-10**. Capabilities have expanded since then. For the current implementation, use `README.md`, `docs/ARCHITECTURE.md` and `docs/SECURITY.md`.

## Objective

Validate a stable public HTTPS deployment of `grist-chatgpt` without exposing the Node.js listener directly to the Internet and without committing Grist or MCP secrets.

This milestone validated transport and deployment. It did not yet provide the multi-user institutional authentication model targeted for a future DINUM deployment.

## Validated architecture at that milestone

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

The hostname identifies the development instance, not a guaranteed long-term institutional production endpoint.

## Host platform

The validated deployment used:

- Debian 13;
- Node.js 24;
- `systemd` for process supervision;
- Caddy for TLS termination and reverse proxying;
- nftables firewall;
- application bound to `127.0.0.1:3000` only.

Secrets were stored outside the Git checkout in a root-managed environment file under `/etc/grist-chatgpt/`.

## DNS rebinding protection

The MCP Express application kept host validation enabled. Public reverse-proxy hostnames were configured through:

```text
MCP_ALLOWED_HOSTS=<comma-separated hostnames>
```

Localhost entries were added automatically. For the development deployment:

```text
MCP_ALLOWED_HOSTS=grist-chatgpt.loeildumaitre.fr
```

## Validation performed on 2026-09-10

The following checks succeeded:

- `GET /healthz` over public HTTPS returned HTTP 200;
- unauthenticated `/mcp` returned HTTP 401 with `WWW-Authenticate: Bearer`;
- authenticated MCP `tools/list` succeeded over the normal MCP SSE transport;
- authenticated `query_records` reached the DINUM Grist Community instance and returned only synthetic test records.

At that time, the MCP surface contained four tools:

- `list_tables`;
- `query_records`;
- `create_records`;
- `update_records`.

The current v0.4.0 surface is intentionally broader and is documented elsewhere.

## DINUM outage observed during validation

During validation, direct Grist API calls temporarily returned HTTP 500 with:

```text
Exceeded 10 attempts to lock the resource "workers-lock".
```

The Grist web interface also showed HTTP 502 during the same infrastructure incident. A later MCP request and direct API request succeeded without changing the bridge, confirming that the failure was upstream and transient.

This remains useful reliability evidence: safe reads may eventually use bounded retry logic, while writes must not be retried automatically without an idempotency strategy because an upstream/network failure can occur after a write has already been applied.

## Security boundaries validated at that milestone

At the time of M3 validation:

- the Grist API key was never supplied as an MCP tool argument;
- the configured document allowlist was enforced before outbound requests;
- the application listener remained loopback-only;
- Caddy was the only public HTTP ingress;
- the public MCP hostname was explicitly allowlisted;
- test data was synthetic;
- deletion and schema mutation had not yet been added to the bridge.

Those last capability limitations are historical and no longer describe v0.4.0.

## Exit criteria

M3 was considered validated because DNS, HTTPS, loopback binding, host validation, bearer authentication, MCP discovery and an end-to-end Grist read all succeeded on the public deployment.

## Subsequent evolution

Later milestones added GPT Actions, document/workspace policy, configurable guardrails, explicit record deletion, bulk batching and schema management. See the current architecture and security documents for the authoritative state.
