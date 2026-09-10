# grist-chatgpt

Experimental open-source bridge for using Grist data and actions from MCP-compatible conversational clients, with ChatGPT distribution as the target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Status

**M1 validated on 2026-09-06 against Grist Community DINUM:** table discovery, record reads, record creation and record updates all succeeded end to end using synthetic data.

See [M1 validation evidence](docs/M1-VALIDATION.md).

## Goal

Provide a narrow, auditable MCP surface over the Grist REST API so a conversational assistant can:

- inspect a document's tables;
- read and filter records;
- create records;
- update records.

The first version deliberately excludes deletion, arbitrary HTTP calls, SQL execution, schema mutation, and unrestricted administration.

## Architecture

```text
ChatGPT / MCP client
        |
        v
grist-chatgpt MCP server
        |
        v
Grist REST API
        |
        v
Grist document permissions
```

For local development, the bridge can authenticate to Grist with an API key stored only in the process environment. **This is not the intended production authentication model.** Grist API keys inherit the full permissions of their owner. A public integration should use a scoped, revocable authorization mechanism or an institutionally approved gateway.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [OpenAI distribution study](docs/OPENAI-SUBMISSION.md)
- [M2 protected remote demo](docs/M2-REMOTE-DEMO.md)

## Current MCP tools

| Tool | Access | Purpose |
| --- | --- | --- |
| `list_tables` | read | List tables in one Grist document |
| `query_records` | read | Read/filter a bounded set of records |
| `create_records` | write | Add a bounded set of records |
| `update_records` | write | Modify a bounded set of existing records |

No delete tool is exposed.

## Local development

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `GRIST_BASE_URL`, `GRIST_API_KEY`, `GRIST_ALLOWED_DOCUMENT_IDS` and `MCP_BEARER_TOKEN`.

The Grist API key remains local. The bridge accepts requests only for allowlisted document IDs and requires the independent MCP bearer token on `/mcp`.

The MCP endpoint is:

```text
http://127.0.0.1:3000/mcp
```

The server intentionally binds to localhost. For a reverse-proxied public deployment, keep `HOST=127.0.0.1` and set `MCP_ALLOWED_HOSTS` to the comma-separated public hostname(s) accepted by the MCP HTTP endpoint, for example `MCP_ALLOWED_HOSTS=mcp.example.org`. Localhost hostnames remain allowed automatically. This preserves the SDK's DNS-rebinding protection while permitting the expected reverse-proxy `Host` header.

An SSE-capable reverse proxy or tunnel may expose the localhost service; OAuth and stable public deployment remain separate milestones.

## Design principles

1. **Least privilege first** — expose only actions needed for the use case.
2. **No arbitrary HTTP proxy** — tools map to explicit Grist operations.
3. **Writes are explicit** — read and write tools are separated and annotated.
4. **Bounded operations** — record counts are capped server-side.
5. **No secrets in prompts or repository** — credentials stay outside model-visible inputs.
6. **Upstream compatibility** — prefer convergence with Grist's official MCP/OAuth model where possible.

## Authoritative references

- Grist REST API: https://support.getgrist.com/api/
- Grist REST API usage: https://support.getgrist.com/rest-api/
- Grist OAuth apps: https://support.getgrist.com/oauth-apps/
- Grist MCP server: https://support.getgrist.com/mcp/
- OpenAI Apps SDK overview: https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk
- Apps/plugins in ChatGPT: https://help.openai.com/en/articles/11487775

## License

Apache-2.0.
