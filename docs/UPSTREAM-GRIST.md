# Upstream Grist MCP reconnaissance

> **Historical reconnaissance.** This file records the upstream Grist investigation that informed the initial bridge architecture. The current implementation is documented in `README.md` and `docs/ARCHITECTURE.md`.

Status: preliminary repository reconnaissance performed against the public `gristlabs/grist-core` tree.

## What was observed

The public Community repository exposed MCP-related configuration hooks such as `GRIST_MCP_ENABLED`, and conditional MCP protocol headers were visible in the public server code.

The actual native MCP/OIDC implementation was not found in the public Community code inspected at that time, which was consistent with Grist documentation describing those capabilities as part of the Full self-hosted offering.

This investigation established an important constraint for this project: the bridge must not depend on private or unavailable Grist implementation details when targeting a Community deployment.

## Architectural consequence

The project therefore uses explicit bridge operations backed by the public Grist REST API:

```text
GPT Actions / MCP
        |
        v
explicit grist-chatgpt operations
        |
        v
public Grist REST API
```

Since this reconnaissance, the bridge has grown well beyond the initial four-tool V0. The current v0.4.0 implementation includes document/workspace policy, record deletion, bulk handling and schema management while preserving the same architectural principle: every exposed operation is named and bounded.

## Institutional consequence

For the target DINUM Grist Community deployment, the preferred future architecture is not to depend on Full-edition native MCP. Instead, the institutional question is whether DINUM can host the bridge and preserve/delegate the authenticated user's identity to Grist Community so existing Grist permissions remain authoritative.

## Public source pointers

- `app/server/lib/gristSettings.ts`
- `app/server/lib/FlexServer.ts`
- Grist MCP documentation: https://support.getgrist.com/mcp/
- Grist OAuth apps documentation: https://support.getgrist.com/oauth-apps/
- Grist REST API documentation: https://support.getgrist.com/api/
