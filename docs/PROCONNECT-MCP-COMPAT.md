# ProConnect / MCP compatibility probe

**Status:** non-committing compatibility research. This work does not select ProConnect as the MCP authorization server and does not select any fallback authorization-server product.

**Research baseline:** MCP `2026-07-28`, ProConnect Internet integration environment, 2026-09-17.

## Decision this probe supports

Before introducing a dedicated MCP authorization server, determine whether ProConnect can itself satisfy the OAuth behavior required by the MCP boundary.

The preferred decision sequence is:

```text
ProConnect direct
      |
compatibility probe
      |
  +---+---+
  |       |
 PASS    FAIL on a mandatory MCP requirement
  |       |
  v       v
use A   evaluate B: dedicated MCP authorization server federated to ProConnect
```

A documentation omission is not treated as a protocol failure. Conversely, a successful ordinary OIDC login is not sufficient evidence of MCP compatibility.

## Fixed project invariants

This probe does not change:

- the per-user Grist API-key model;
- the public bridge scopes `doc:read`, `doc:write`, `doc.schema:write`;
- the C3 principal/context isolation boundary;
- production authentication;
- any ProConnect production/DataPass commitment.

No OAuth token or client secret may be committed, pasted into MCP/model-visible content, or recorded in general logs.

## Public evidence already established

Current ProConnect documentation establishes:

- Internet integration domain: `fca.integ01.dev-agentconnect.fr`;
- OIDC discovery URL: `https://fca.integ01.dev-agentconnect.fr/api/v2/.well-known/openid-configuration`;
- Authorization Code Flow for service providers;
- registered `client_id`, `client_secret` and exact redirect URIs;
- access tokens, refresh tokens and a documented Resource Server mode using token introspection.

Current service-provider documentation does **not** document `resource`, `code_challenge`, `code_challenge_method` or `code_verifier` in its accepted authorization/token parameters. It also says unsupported authorization parameters may produce `Y000400 Bad Request`.

Those documentation facts justify testing; they do not by themselves prove incompatibility.

Official references:

- https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/implementation_technique
- https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/resource_server
- https://partenaires.proconnect.gouv.fr/docs/ressources/valeur_ac_domain
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

## Compatibility matrix

| Requirement | Evidence before live probe | Required result |
| --- | --- | --- |
| OIDC issuer + authorization/token endpoints | documented/discovery | PASS |
| Authorization Code Flow | documented | PASS |
| PKCE `S256` advertised or demonstrably accepted | not yet proven | PASS |
| RFC 8707 `resource` accepted at authorization endpoint | not yet proven | PASS |
| RFC 8707 `resource` accepted at token endpoint | not yet proven | PASS |
| resulting access token bound to the canonical MCP resource/audience | not yet proven | PASS |
| dynamic user identity recoverable from validated token/introspection | ProConnect Resource Server mode documented | PASS |
| existing bridge scopes can be represented/enforced without broadening authority | not yet proven | PASS or a precise safe mapping |
| refresh/re-authentication UX acceptable | refresh exists; lifetime policy must be measured/confirmed | acceptable human decision |
| RFC 9207 `iss` behavior | not yet proven | desirable / record actual behavior |

A mandatory FAIL on PKCE or RFC 8707 resource/audience handling is enough to reject **direct ProConnect as the MCP authorization server**. It does not reject ProConnect as the upstream identity source.

## Probe tooling

The repository includes:

```text
src/compat/proconnectMcp.ts
tools/proconnect-mcp-probe.ts
test/proconnect-mcp-compat.test.ts
```

Run public discovery analysis with no credentials:

```bash
npm run probe:proconnect -- metadata
```

The evaluator reports only what metadata can prove. In particular, RFC 8707 acceptance and audience binding remain `UNKNOWN` until a live flow is performed.

## Live A/B authorization probe

A registered **integration** client and redirect URI are required. Do not use production credentials.

The four variants isolate which parameter changes behavior:

```text
baseline  = documented ProConnect OIDC parameters only
pkce      = baseline + code_challenge + code_challenge_method=S256
resource  = baseline + RFC 8707 resource
mcp       = baseline + PKCE S256 + RFC 8707 resource
```

Example, starting with the baseline:

```bash
npm run probe:proconnect -- authorize \
  --variant baseline \
  --client-id "$PROCONNECT_CLIENT_ID" \
  --redirect-uri "https://YOUR-REGISTERED-CALLBACK.example/callback"
```

Then test PKCE:

```bash
npm run probe:proconnect -- authorize \
  --variant pkce \
  --client-id "$PROCONNECT_CLIENT_ID" \
  --redirect-uri "https://YOUR-REGISTERED-CALLBACK.example/callback"
```

Then RFC 8707 alone:

```bash
npm run probe:proconnect -- authorize \
  --variant resource \
  --client-id "$PROCONNECT_CLIENT_ID" \
  --redirect-uri "https://YOUR-REGISTERED-CALLBACK.example/callback" \
  --resource "https://grist-chatgpt.loeildumaitre.fr/mcp"
```

Finally the MCP-shaped request:

```bash
npm run probe:proconnect -- authorize \
  --variant mcp \
  --client-id "$PROCONNECT_CLIENT_ID" \
  --redirect-uri "https://YOUR-REGISTERED-CALLBACK.example/callback" \
  --resource "https://grist-chatgpt.loeildumaitre.fr/mcp"
```

Each command writes ephemeral `state`, `nonce` and PKCE verifier material to `.proconnect-probe-session.json` with mode `0600`; that file is ignored by Git.

Open the printed authorization URL in a browser and record:

- whether ProConnect rejects the request immediately;
- any stable error code such as `Y000400`;
- whether normal authentication begins;
- whether the registered callback ultimately receives `code` and `state`;
- whether an `iss` parameter is returned.

Do not paste authorization codes, cookies or tokens into an issue or chat.

## Token endpoint probe

If a variant reaches the callback with an authorization code, keep the client secret only in a local environment variable:

```bash
export PROCONNECT_CLIENT_SECRET='...'
npm run probe:proconnect -- exchange --code 'LOCAL_CODE'
```

The exchange reproduces the parameters belonging to the saved variant:

- PKCE variants send `code_verifier`;
- resource variants send the same RFC 8707 `resource` value.

The tool intentionally prints only a sanitized result:

- HTTP status;
- token type and expiry;
- whether access/refresh/ID tokens were returned;
- if the access token is a JWT, only `iss`, `aud`, `scope` and `exp` claims.

Raw access tokens, refresh tokens and ID tokens are never printed or persisted by the probe.

If ProConnect returns an opaque access token, audience/resource binding will require its documented Resource Server introspection path and suitable integration registration; do not infer audience from successful token issuance alone.

## Recording results

Record each result as `PASS`, `FAIL` or `UNKNOWN` with exact evidence, date, environment and variant. Prefer protocol facts such as HTTP status/error code/metadata fields over interpretations.

A useful result table is:

| Probe | Result | Evidence |
| --- | --- | --- |
| discovery / issuer/endpoints | UNKNOWN | run `metadata` |
| discovery / PKCE S256 | UNKNOWN | run `metadata` |
| baseline authorize | UNKNOWN | integration client required |
| PKCE authorize | UNKNOWN | integration client required |
| RFC8707 resource authorize | UNKNOWN | integration client required |
| MCP authorize | UNKNOWN | integration client required |
| token + PKCE verifier | UNKNOWN | successful auth code required |
| token + resource | UNKNOWN | successful auth code required |
| MCP audience binding | UNKNOWN | token/JWT or introspection evidence required |
| bridge scope representation | UNKNOWN | provider behavior/configuration evidence required |

## Decision rule

After the live probe:

- if ProConnect satisfies the mandatory MCP OAuth behavior, record architecture **A — ProConnect directly as MCP authorization server**;
- if ProConnect fails a mandatory requirement that cannot be safely configured, record architecture **B — dedicated MCP authorization server federated to ProConnect**;
- only after B is selected should the project compare concrete authorization-server products.

Until that result is durable, C4 provider-specific implementation remains blocked.
