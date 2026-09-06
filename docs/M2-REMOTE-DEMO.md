# M2 — Protected remote demo

## Objective

Expose the local MCP bridge through a temporary public HTTPS URL without:

- opening an inbound router port;
- publishing the Grist API key;
- allowing the bridge to access arbitrary Grist documents;
- relying on SSE support in the public tunnel.

M2 is a development/demo milestone, not a production deployment.

## Architecture

```text
remote MCP client
      |
      | HTTPS
      v
temporary tunnel
      |
      | HTTP to localhost only
      v
grist-chatgpt :3000
      |
      | inbound MCP bearer token
      | document allowlist
      v
Grist REST client
      |
      | local GRIST_API_KEY
      v
Grist Community DINUM
```

## Security boundaries

### Grist credential

`GRIST_API_KEY` remains in the local `.env` file only.

The tunnel process does not need the Grist API key.

### Inbound MCP authentication

Every request to `/mcp` must provide:

```http
Authorization: Bearer <MCP_BEARER_TOKEN>
```

The token is compared in constant time.

`/healthz` remains unauthenticated and reveals no Grist data or credentials.

### Document allowlist

`GRIST_ALLOWED_DOCUMENT_IDS` is a comma-separated list of document IDs.

Every Grist tool resolves the requested document ID and rejects the request before any Grist HTTP call unless the document is on that allowlist.

For the current demo the allowlist should contain only the synthetic test document.

### Local binding

The bridge still binds only to `127.0.0.1` / `localhost`.

Remote access must therefore pass through an explicit reverse tunnel.

## Response transport

The MCP handler uses JSON response mode.

The current tool surface only needs terminal request/response results and does not use progress notifications, server-to-client requests or subscriptions.

JSON response mode also makes the bridge usable through development tunnels that do not support Server-Sent Events.

## Environment

Example:

```text
GRIST_BASE_URL=https://grist.numerique.gouv.fr
GRIST_API_KEY=<local secret>
GRIST_ALLOWED_DOCUMENT_IDS=aGUygEv64sRs
MCP_BEARER_TOKEN=<random local secret, at least 32 characters>
PORT=3000
HOST=127.0.0.1
```

Generate the inbound demo token locally, for example:

```bash
openssl rand -hex 32
```

Never commit either secret.

## Temporary HTTPS tunnel

For M2 development, a Cloudflare Quick Tunnel can expose the local server without an account:

```bash
cloudflared tunnel --url http://localhost:3000
```

It returns a temporary random `https://*.trycloudflare.com` URL.

Quick Tunnels are intentionally temporary and have no SLA. They are not the M3/M4 production hosting solution.

## Remote verification

Given:

```text
PUBLIC_URL=https://example.trycloudflare.com
MCP_BEARER_TOKEN=<local secret>
```

A remote MCP request must include the inbound bearer token.

Requests with no token, a wrong token or a non-allowlisted document must fail.

A request with the correct token and the synthetic document ID must succeed.

## Exit criteria

M2 is validated when all of the following have been demonstrated:

1. local MCP calls require the inbound bearer token;
2. a non-allowlisted Grist document is rejected before an outbound Grist request;
3. the public HTTPS tunnel reaches `/healthz`;
4. an unauthenticated public `/mcp` request returns HTTP 401;
5. an authenticated public MCP read reaches the synthetic DINUM document;
6. no secret is committed or supplied to the tunnel provider.

## Not solved by M2

- OAuth;
- per-user Grist identity;
- public app submission;
- stable production hosting;
- service-account isolation;
- audit logging and rate limiting.

Those remain later milestones.
