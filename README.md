# grist-chatgpt

Experimental open-source bridge for using Grist data and actions from conversational clients, with ChatGPT compatibility as the target.

> [!IMPORTANT]
> This repository is an independent prototype. It is not an official Grist Labs, DINUM / La Suite numérique, or OpenAI integration.

## Status

**M1 validated on 2026-09-06 against Grist Community DINUM:** table discovery, record reads, record creation and record updates all succeeded end to end using synthetic data.

**M3 public deployment validated on 2026-09-10:** a public HTTPS MCP endpoint behind Caddy successfully authenticated an MCP client and read the synthetic DINUM Grist document end to end over SSE while the Node.js service remained bound to localhost.

**GPT Actions compatibility validated on ChatGPT Plus on 2026-09-10:** a custom GPT successfully called the public `/healthz` endpoint. The bridge now exposes an authenticated REST/OpenAPI façade over the same bounded Grist operations for direct GPT Actions use.

See:

- [M1 validation evidence](docs/M1-VALIDATION.md)
- [M2 protected remote demo](docs/M2-REMOTE-DEMO.md)
- [M3 public VPS deployment](docs/M3-PUBLIC-DEPLOYMENT.md)
- [GPT Actions REST interface](docs/GPT-ACTIONS.md)

## Goal

Provide narrow, auditable access to the Grist REST API so a conversational assistant can:

- inspect a document's tables;
- read and filter records;
- create records;
- update records.

The first version deliberately excludes deletion, arbitrary HTTP calls, SQL execution, schema mutation, and unrestricted administration.

## Architecture

```text
ChatGPT custom GPT / MCP client
             |
             v
grist-chatgpt bridge
   |                 |
   | /api/v1         | /mcp
   | GPT Actions     | MCP
   +--------+--------+
            |
            v
      shared GristClient
            |
            v
       Grist REST API
```

The Grist API key is stored only in the bridge environment and is never supplied to ChatGPT or MCP tool inputs. The bridge accepts only explicitly allowlisted Grist document IDs.

## Current MCP tools

| Tool | Access | Purpose |
| --- | --- | --- |
| `list_tables` | read | List tables in one Grist document |
| `query_records` | read | Read/filter a bounded set of records |
| `create_records` | write | Add a bounded set of records |
| `update_records` | write | Modify a bounded set of existing records |

## GPT Actions REST API

The same four capabilities are exposed for custom GPT Actions:

| Operation ID | Method/path | Access |
| --- | --- | --- |
| `listGristTables` | `GET /api/v1/documents/{documentId}/tables` | read |
| `queryGristRecords` | `POST /api/v1/documents/{documentId}/tables/{tableId}/query` | read |
| `createGristRecords` | `POST /api/v1/documents/{documentId}/tables/{tableId}/records` | write |
| `updateGristRecords` | `PATCH /api/v1/documents/{documentId}/tables/{tableId}/records` | write |

`GET /openapi.json` serves the OpenAPI 3.1 schema used by GPT Actions. The REST API requires a dedicated `GPT_ACTION_TOKEN` bearer token distinct from the MCP token. Read calls are marked non-consequential in the OpenAPI schema; create/update calls are marked consequential.

No delete operation is exposed.

## Local development

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Set:

- `GRIST_BASE_URL`
- `GRIST_API_KEY`
- `GRIST_ALLOWED_DOCUMENT_IDS`
- `MCP_BEARER_TOKEN`
- `GPT_ACTION_TOKEN`

Both bridge-facing bearer tokens must be at least 32 characters and must be different.

The MCP endpoint is:

```text
http://127.0.0.1:3000/mcp
```

The GPT Actions API starts under:

```text
http://127.0.0.1:3000/api/v1
```

The server intentionally binds to localhost. For a reverse-proxied public deployment, keep `HOST=127.0.0.1` and set `MCP_ALLOWED_HOSTS` to the comma-separated public hostname(s), for example `MCP_ALLOWED_HOSTS=mcp.example.org`. Localhost hostnames remain allowed automatically.

## Design principles

1. **Least privilege first** — expose only actions needed for the use case.
2. **One Grist core** — MCP and GPT Actions share the same `GristClient` implementation.
3. **No arbitrary HTTP proxy** — operations map to explicit Grist actions.
4. **Writes are explicit** — read and write operations are separated and annotated.
5. **Bounded operations** — reads are capped at 200 records and writes at 50 records per call.
6. **No secrets in prompts or repository** — credentials stay outside model-visible inputs.
7. **Upstream compatibility** — preserve MCP as the future publication path while supporting GPT Actions today.

## Authoritative references

- Grist REST API: https://support.getgrist.com/api/
- Grist REST API usage: https://support.getgrist.com/rest-api/
- Grist OAuth apps: https://support.getgrist.com/oauth-apps/
- Grist MCP server: https://support.getgrist.com/mcp/
- OpenAI GPT Actions: https://help.openai.com/en/articles/9442513
- OpenAI Apps SDK overview: https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk

## License

Apache-2.0.
