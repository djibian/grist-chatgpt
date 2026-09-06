# Upstream Grist MCP reconnaissance

Status: preliminary repository reconnaissance performed against the public `gristlabs/grist-core` tree.

## What is present in public grist-core

The public Community repository contains MCP-related configuration hooks.

### Feature flag

`app/server/lib/gristSettings.ts` reads:

```text
GRIST_MCP_ENABLED
```

with a default value of `false`.

### HTTP/CORS support

`app/server/lib/FlexServer.ts` conditionally allows the MCP protocol headers when that flag is enabled:

```text
mcp-protocol-version
mcp-session-id
```

The public README also documents `GRIST_MCP_ENABLED` and the OIDC/MCP-related environment variables used by the full product.

## What was not found

A search of the public `gristlabs/grist-core` codebase did not locate the actual MCP endpoint/server implementation or the OIDC server implementation corresponding to those documented flags.

This is consistent with Grist documentation describing the native self-hosted MCP/OAuth capability as a Full-edition feature.

It is not proof that no reusable implementation exists elsewhere. The next upstream step is to determine, with Grist Labs/DINUM:

1. whether the MCP implementation lives in non-public Full-edition modules;
2. whether those modules can be reused or upstreamed for the DINUM deployment;
3. whether a Community-compatible authorization adapter would be acceptable upstream;
4. whether `grist-chatgpt` should remain an external MCP-to-REST bridge or converge with the native Grist endpoint.

## Architectural consequence

For now, `grist-chatgpt` must not depend on private or unavailable Grist implementation details.

The V0 remains:

```text
MCP
 |
 v
explicit grist-chatgpt tools
 |
 v
public Grist REST API
```

while keeping its tool semantics narrow enough to converge later with the official Grist MCP model.

## Public source pointers

- `app/server/lib/gristSettings.ts`
- `app/server/lib/FlexServer.ts`
- Grist MCP documentation: https://support.getgrist.com/mcp/
- Grist OAuth apps documentation: https://support.getgrist.com/oauth-apps/
