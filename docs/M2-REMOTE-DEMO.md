# M2 — Protected remote demo

> **Historical snapshot.** This document records the temporary-tunnel milestone that preceded the public VPS deployment. It is retained as validation evidence, not as current deployment guidance. See `README.md`, `docs/ARCHITECTURE.md` and `docs/M3-PUBLIC-DEPLOYMENT.md` for the current architecture and later deployment state.

## Objective at the time

Expose the local MCP bridge through a temporary public HTTPS URL without opening an inbound router port, publishing the Grist API key, allowing arbitrary document access, or degrading MCP transport semantics.

M2 was a development/demo milestone, not a production deployment.

## Architecture validated at that milestone

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

## Security boundaries validated

- `GRIST_API_KEY` remained local to the bridge process;
- `/mcp` required `Authorization: Bearer <MCP_BEARER_TOKEN>`;
- the bearer token was compared in constant time;
- `/healthz` remained unauthenticated and exposed no Grist data or credentials;
- only explicitly allowlisted synthetic documents were reachable;
- the Node service remained bound to loopback.

At this milestone the resource policy was document-only. v0.4.0 later generalized it to explicit document IDs and/or workspace IDs.

## Transport validation

The bridge preserved the MCP SDK's normal HTTP/SSE behavior. The temporary tunnel therefore had to forward streamed HTTP/SSE without rewriting it.

An ngrok development endpoint was used for this proof. It was never intended as the stable hosting model.

## Exit criteria

M2 was considered validated when:

1. local MCP calls required the bearer token;
2. a non-allowlisted document was rejected before an outbound Grist request;
3. the public tunnel reached `/healthz`;
4. unauthenticated public `/mcp` returned HTTP 401;
5. an authenticated public MCP read reached the synthetic DINUM document;
6. no Grist or MCP secret was committed or supplied to the tunnel provider.

## Not solved by M2

M2 did not solve per-user institutional identity, stable production hosting, public plugin distribution, service-account isolation, or institutional audit policy. Later milestones replaced the tunnel with the public VPS deployment and substantially expanded the bridge capabilities.
