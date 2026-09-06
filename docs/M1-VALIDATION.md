# M1 validation — Grist Community DINUM

Date: 2026-09-06

## Scope

M1 validates the smallest useful end-to-end path between the local MCP server and a real Grist Community deployment operated by DINUM.

No production data was used. The test document contained only synthetic records.

## Environment

Target host:

```text
https://grist.numerique.gouv.fr
```

Test document:

```text
Test ChatGPT MCP
```

Test table:

```text
MCP_Test
```

Columns:

- `Nom`
- `Nombre`
- `Statut`

Initial rows:

```text
Alpha | 1 | Initial
Beta  | 2 | Initial
```

The local bridge used an API key stored only in the local `.env` file. The key was never committed or copied into the repository.

## Results

### 1. Discover tables — PASS

`list_tables` returned:

```text
MCP_Test
```

### 2. Read records — PASS

`query_records` returned the two initial rows:

```text
Alpha | 1 | Initial
Beta  | 2 | Initial
```

### 3. Create a record — PASS

`create_records` created:

```text
Gamma | 3 | Créé par MCP
```

Grist returned record ID `3`.

### 4. Update a record — PASS

`update_records` modified record `3`.

Grist returned an empty successful response, which the client normalizes to `null`.

### 5. Re-read after update — PASS

A subsequent `query_records` confirmed the persisted state:

```text
Gamma | 30 | Modifié par MCP
```

## Conclusion

The following path is now proven against a real Grist Community DINUM instance:

```text
MCP client
   |
   v
grist-chatgpt
   |
   v
Grist REST API
   |
   v
Grist Community DINUM
```

The bridge can:

- discover tables;
- read records;
- create records;
- update records.

This proves technical feasibility for the core read/write use case.

## What M1 does not prove

M1 does not validate:

- public deployment;
- OAuth or per-user authorization;
- ChatGPT Plugin/App distribution;
- multi-user permission mapping;
- rate limiting;
- audit logging;
- destructive actions.

Those remain later milestones.

## Regression coverage

The repository now includes mocked HTTP tests for:

- document ID URL construction;
- DINUM-style document URL extraction;
- foreign-origin URL rejection;
- query filtering and limits;
- POST record creation;
- PATCH record updates with empty successful response.
