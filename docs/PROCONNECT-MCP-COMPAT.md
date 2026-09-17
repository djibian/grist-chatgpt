# ProConnect / MCP compatibility probe

**Status:** non-committing compatibility research. This work does not select ProConnect as the production identity source, does not select an MCP authorization-server architecture/product, and does not create any production/DataPass commitment.

**Research baseline:** MCP `2026-07-28`, ProConnect public federation implementation assessed on 2026-09-17.

## Question this probe answers

The probe answers one technical question only:

> Can the current ProConnect OIDC authorization server itself satisfy the mandatory OAuth behavior required by MCP 2026-07-28?

A negative answer excludes that direct protocol arrangement for the assessed configuration. It does **not** select a different identity source, a federation architecture, or an authorization-server product. Those remain human decisions under `AGENTS.md`.

## Fixed project invariants

This research does not change:

- the per-user Grist API-key model;
- the public bridge scopes `doc:read`, `doc:write`, `doc.schema:write`;
- the C3 principal/context isolation boundary;
- production authentication;
- identity-provider selection;
- authorization-server selection;
- any institutional registration or DataPass commitment.

No OAuth token, authorization code, client secret or session secret may be committed, pasted into model-visible content, or recorded in general logs.

## Current public-source result

The assessed ProConnect federation source provides positive evidence for PKCE S256 and explicitly configures:

```text
resourceIndicators: { enabled: false }
```

MCP 2026-07-28 requires clients to send the RFC 8707 `resource` parameter in both authorization and token requests for the canonical MCP resource. Therefore, for the public configuration assessed here, **direct ProConnect as the MCP-facing authorization server is not compatible with the mandatory MCP 2026-07-28 resource-indicator flow**.

This conclusion concerns ProConnect only in the role of the MCP-facing authorization server. It neither selects nor rejects ProConnect as an upstream identity source in some other architecture.

Durable evidence is recorded in `docs/PROCONNECT-MCP-COMPAT-RESULTS.md`.

## Revalidation tooling

The repository includes:

```text
src/compat/proconnectMcp.ts
tools/proconnect-mcp-probe.ts
test/proconnect-mcp-compat.test.ts
```

Run public discovery analysis without credentials:

```bash
npm run probe:proconnect -- metadata
```

The evaluator reports only what discovery metadata can establish. RFC 8707 acceptance and resource/audience binding remain `UNKNOWN` when discovery alone cannot prove them.

A live probe is useful only if ProConnect later enables Resource Indicators or there is evidence that a deployed environment differs from the assessed public configuration.

## Controlled authorization variants

A registered non-production integration client and redirect URI are required for live revalidation. The variants are:

```text
baseline  = ordinary Authorization Code request
pkce      = baseline + code_challenge + S256
resource  = baseline + RFC 8707 resource
mcp       = baseline + PKCE S256 + RFC 8707 resource
```

Example:

```bash
npm run probe:proconnect -- authorize \
  --variant mcp \
  --client-id "$PROCONNECT_CLIENT_ID" \
  --redirect-uri "https://YOUR-REGISTERED-CALLBACK.example/callback" \
  --resource "https://grist-chatgpt.loeildumaitre.fr/mcp"
```

The authorize command stores only local transient state/nonce/PKCE material in `.proconnect-probe-session.json`, which is ignored by Git and forced to mode `0600`.

Do not paste authorization codes, cookies, client secrets or tokens into an issue, chat, shell command line, or committed file.

## Token exchange for future revalidation

If a future revalidation reaches the registered callback with an authorization code, keep both the code and client secret in local environment variables rather than command-line arguments:

```bash
read -r -s PROCONNECT_AUTHORIZATION_CODE
export PROCONNECT_AUTHORIZATION_CODE
export PROCONNECT_CLIENT_SECRET='set-locally-without-committing-it'
npm run probe:proconnect -- exchange
unset PROCONNECT_AUTHORIZATION_CODE PROCONNECT_CLIENT_SECRET
```

The command may instead be pointed at differently named environment variables with `--authorization-code-env` and `--client-secret-env`.

The probe never prints or persists raw access, refresh or ID tokens. If the access token is JWT-shaped, it may print only decoded `iss`, `aud`, `scope` and `exp` fields as **unverified diagnostics**. Those decoded fields are not cryptographic validation evidence; production or compatibility conclusions about audience/issuer must rely on validated JWT/JWKS processing or trusted introspection.

After receiving a token-endpoint response, the probe removes its local session file on a best-effort basis.

## Decision rule

This probe never selects a product or architecture.

- A mandatory protocol **FAIL** removes the tested direct arrangement from the current technical candidate set.
- A **PASS** only means the tested arrangement is technically viable enough to remain a candidate for the human decision.
- `UNKNOWN` remains unknown and must not be promoted to PASS or FAIL by inference.

For the assessed ProConnect configuration, RFC 8707 Resource Indicators are explicitly disabled, so the direct ProConnect authorization-server arrangement is currently excluded on protocol grounds. The project human gate remains responsible for the identity source and the remaining OAuth architecture/provider choices.

## Sources

- MCP authorization specification 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- ProConnect service-provider implementation documentation: https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/implementation_technique
- ProConnect public federation commit assessed: `0ddb96fc538834409866dd6c8c7d1313cff44e6d`
- ProConnect OIDC provider configuration: `back/libs/oidc-provider/src/services/oidc-provider-config.service.ts`
