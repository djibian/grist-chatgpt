# GPT Actions REST interface

## Purpose

Provide a ChatGPT Plus-compatible path to Grist through a custom GPT Action while preserving the MCP endpoint for future distribution.

The GPT never receives the Grist API key. It authenticates to the bridge with an independent bearer token.

```text
ChatGPT custom GPT
       |
       | HTTPS + GPT_ACTION_TOKEN
       v
grist-chatgpt /api/v1
       |
       | shared GristClient
       | GRIST_ALLOWED_DOCUMENT_IDS
       v
Grist REST API
       |
       | GRIST_API_KEY (server-side only)
       v
Grist Community
```

## Authentication

Configure a random `GPT_ACTION_TOKEN` of at least 32 characters. It must differ from `MCP_BEARER_TOKEN`.

Example generation:

```bash
openssl rand -hex 32
```

Do not commit or paste the generated value into documentation or issues.

In the custom GPT Action editor, configure authentication as:

- Authentication type: API key
- Auth type: Bearer
- Secret: the value of `GPT_ACTION_TOKEN`

## OpenAPI schema

The bridge serves its OpenAPI 3.1 document at:

```text
GET /openapi.json
```

For a public deployment this can be imported directly by URL, for example:

```text
https://bridge.example.org/openapi.json
```

The schema contains no credentials.

## Operations

### `listGristTables`

```text
GET /api/v1/documents/{documentId}/tables
```

Read-only. Lists the Grist tables available in one allowlisted document.

### `queryGristRecords`

```text
POST /api/v1/documents/{documentId}/tables/{tableId}/query
```

Read-only despite using POST. Optional JSON body:

```json
{
  "filter": {
    "Statut": ["Initial"]
  },
  "limit": 50
}
```

`limit` defaults to 50 and cannot exceed 200.

The operation is explicitly marked `x-openai-isConsequential: false` because it performs no write.

### `createGristRecords`

```text
POST /api/v1/documents/{documentId}/tables/{tableId}/records
```

Body:

```json
{
  "records": [
    {
      "fields": {
        "Nom": "Delta",
        "Nombre": 4,
        "Statut": "Créé par GPT Action"
      }
    }
  ]
}
```

At most 50 records per request. Marked consequential.

### `updateGristRecords`

```text
PATCH /api/v1/documents/{documentId}/tables/{tableId}/records
```

Body:

```json
{
  "records": [
    {
      "id": 4,
      "fields": {
        "Statut": "Modifié par GPT Action"
      }
    }
  ]
}
```

At most 50 records per request. Marked consequential.

## Server-side authorization

`documentId` is model-supplied input, but it is not an authorization boundary. Every REST request uses the same `GristClient` as MCP, and the client refuses document IDs not present in `GRIST_ALLOWED_DOCUMENT_IDS` before making a Grist HTTP request.

The REST API exposes no delete, schema mutation, SQL, or arbitrary HTTP operation.

## Initial validation sequence

Use only a synthetic allowlisted document for the first tests.

1. Import `/openapi.json` into the custom GPT Action editor.
2. Configure `GPT_ACTION_TOKEN` as a Bearer API key.
3. Ask the GPT to list tables.
4. Ask it to read the synthetic test table.
5. Create one synthetic record and confirm the consequential action prompt.
6. Re-read and verify the new record.
7. Update only that synthetic record and confirm again.
8. Re-read and verify the update.

Do not add real personal or student data to the allowlist until the authorization and privacy model for that use case has been explicitly reviewed.
