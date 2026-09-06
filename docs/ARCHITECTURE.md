# Architecture V0

## Objective

Create the smallest useful and reviewable bridge between MCP and Grist Community's REST API.

The project must prove that a conversational client can safely perform useful read/write work on Grist without turning the MCP server into an unrestricted HTTP proxy.

## V0 data path

```text
MCP client
   |
   | explicit tool call
   v
MCP tool layer
   |
   | validated arguments
   v
GristClient
   |
   | HTTPS + Bearer credential
   v
Grist REST API
```

The MCP layer knows the semantics of each operation. The Grist client only performs explicit REST operations.

## V0 tool surface

### Read

- `list_tables(documentId)`
- `query_records(documentId, tableId, filter?, limit?)`

### Write

- `create_records(documentId, tableId, records)`
- `update_records(documentId, tableId, records)`

## Explicit non-goals

V0 does not expose:

- record deletion;
- arbitrary URL fetching;
- arbitrary Grist API paths;
- arbitrary SQL;
- table or column creation/modification;
- document administration;
- user or permission administration;
- webhooks;
- attachments.

These can be considered later as separate, reviewable capabilities.

## Authentication

### Development

A local process may use:

```text
GRIST_BASE_URL
GRIST_API_KEY
```

The key is never accepted as a tool argument and must never appear in model-visible content.

### Production

API-key authentication is not a satisfactory public-user model because a Grist API key carries the permissions of its owner.

The production design must preserve user identity, scope and revocability. Preferred paths, in order:

1. use Grist OAuth / connected-app semantics where available;
2. use Grist's official MCP server when the target deployment supports it;
3. for Community deployments without OAuth, use an institutionally controlled authorization gateway that maps authenticated users to narrowly scoped Grist access.

A single wide-permission shared account is not a target architecture.

## Grist Community compatibility

Community exposes the REST API needed for V0. The upstream Grist documentation currently places OAuth apps and the native self-hosted MCP server in the full self-hosted edition.

Therefore the bridge is useful specifically for Community deployments, but its production authentication layer cannot simply copy the full-edition architecture without additional server-side support.

## Deployment milestones

### M0 — repository bootstrap

- architecture and security model;
- local MCP server;
- explicit Grist client;
- four bounded tools.

### M1 — local functional proof — VALIDATED 2026-09-06

- connected to a synthetic Grist Community DINUM test document;
- verified list/read/create/update end to end;
- re-read persisted state after update;
- added automated regression tests around validation and REST requests;
- validation evidence: [M1-VALIDATION.md](M1-VALIDATION.md).

### M2 — safe remote demo — IN PROGRESS

- keep the Grist API key only on the local machine;
- restrict the bridge to explicit synthetic document IDs;
- protect `/mcp` with an independent inbound bearer token;
- use JSON-only MCP responses for the simple tool surface;
- expose localhost temporarily through an HTTPS reverse tunnel;
- validate public read access only against synthetic data.

See [M2-REMOTE-DEMO.md](M2-REMOTE-DEMO.md).

### M3 — provider alignment

- validate branding and distribution with Grist Labs and/or DINUM;
- decide whether to upstream, integrate with, or remain compatible with Grist's official MCP implementation;
- settle the Community authentication model.

### M4 — ChatGPT submission candidate

- production domain;
- privacy policy and terms;
- reviewer-safe demo account/data;
- tool metadata and write annotations;
- conformance and adversarial tests;
- submission package following current OpenAI requirements.

## Architectural invariant

No feature may weaken this rule:

> Every capability exposed to the model must correspond to a named, bounded Grist operation with explicit authorization and predictable effects.
