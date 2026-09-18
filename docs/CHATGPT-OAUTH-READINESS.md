# ChatGPT MCP OAuth readiness — C4-P0

**Date checked:** 2026-09-18  
**Scope:** non-production C4-P0 only

This document is the bounded handoff between the completed provider-neutral `/mcp` OAuth proof and the first real ChatGPT MCP OAuth interoperability test.

Never record OAuth access/refresh/ID tokens, authorization codes, PKCE verifiers, cookies, ProConnect/Logto client secrets, raw provider identities, or Grist API keys in this document, GitHub, chat, or test output.

## Bridge prerequisites now integrated

As of `main` `92224af0da8a454d1312be01ff52b56229ec49c6`, the bridge contains the three signals required by current OpenAI MCP OAuth guidance:

1. RFC 9728 protected-resource metadata at:

   ```text
   /.well-known/oauth-protected-resource
   ```

2. OAuth `securitySchemes` on every tool in `tools/list`, derived from the normative operation registry and mirrored in `_meta` for compatibility.

3. Runtime `_meta["mcp/www_authenticate"]` `insufficient_scope` challenges for actual tool errors caused by a missing OAuth capability, with `resource_metadata`, `error`, `error_description`, and `scope`.

The bridge remains provider-neutral. No Logto SDK or client-registration behavior is embedded in bridge core.

## Current OpenAI client-registration model

Current OpenAI documentation states that ChatGPT can identify/register an OAuth client through:

- Client ID Metadata Documents (CIMD);
- Dynamic Client Registration (DCR);
- a pre-registered OAuth client.

For CIMD-capable authorization servers, ChatGPT can use an HTTPS client metadata document as `client_id`. Current documentation identifies a stable ChatGPT CIMD URL when issuer-identification requirements are met and a callback-specific CIMD URL otherwise. The actual URL and callback exposed by the ChatGPT connection UI must be treated as authoritative during the live test.

Official references checked on 2026-09-18:

```text
https://developers.openai.com/plugins/build/auth
https://developers.openai.com/api/docs/mcp
```

## Logto 1.43.0 selected path: Dynamic app / CIMD

Logto 1.43.0 supports **Dynamic app (CIMD)** for MCP/agent clients. In this mode:

- the client uses its public HTTPS metadata-document URL as `client_id`;
- no client secret is used;
- clients use Authorization Code + PKCE;
- refresh tokens are supported;
- redirect URIs come from the client metadata document;
- the Dynamic app defines one shared maximum permission set for dynamic clients;
- Logto must have OIDC-provider SSRF protection enabled because it fetches remote client metadata.

Official Logto reference checked on 2026-09-18:

```text
https://docs.logto.io/integrate-logto/third-party-applications/dynamic-apps
```

### Human/operator gate

Before the first ChatGPT test, enable the tenant-level **Dynamic app** in the non-production Logto Admin Console and grant it **only**:

```text
doc:read
doc:write
doc.schema:write
```

Do not make these scopes defaults and do not add unrelated permissions.

This is an operator action because it changes the live authorization-server tenant. It does not require a bridge code change.

## Public readiness probe

After deploying the current `main` to the public POC MCP endpoint and enabling Logto Dynamic app, run:

```bash
MCP_RESOURCE_URI='https://grist-chatgpt.loeildumaitre.fr/mcp' \
  npm run probe:chatgpt-oauth-readiness
```

The command prints only sanitized PASS/FAIL/yes/no diagnostics. It checks:

- RFC 9728 protected-resource metadata is publicly reachable;
- the canonical resource URI matches exactly;
- the authorization server and the three fixed scopes are advertised;
- authorization-server discovery matches its issuer;
- CIMD support is advertised;
- public-client token authentication method `none` is advertised;
- PKCE `S256`, Authorization Code, and refresh-token grants are advertised;
- whether RFC 9207 authorization-response issuer identification is advertised;
- unauthenticated `/mcp` returns a 401 challenge pointing to the protected-resource metadata.

### Optional authenticated `tools/list` proof

If a fresh canonical-resource access token is already available locally, it may be supplied **only through the local environment**:

```bash
MCP_RESOURCE_URI='https://grist-chatgpt.loeildumaitre.fr/mcp' \
OAUTH_ACCESS_TOKEN="$OAUTH_ACCESS_TOKEN" \
  npm run probe:chatgpt-oauth-readiness
```

The probe never prints the token. It additionally verifies that:

- authenticated `tools/list` succeeds;
- every normative MCP tool is present;
- root `securitySchemes` match the operation registry;
- the compatibility `_meta.securitySchemes` mirror matches.

The probe performs no Grist write and must not be extended into a destructive public test.

## First real ChatGPT test

Only after the public readiness probe is PASS:

1. enable ChatGPT Developer mode if required by the current UI;
2. add/connect the non-production MCP server using:

   ```text
   https://grist-chatgpt.loeildumaitre.fr/mcp
   ```

3. use the callback URI and CIMD/client information displayed by ChatGPT as the observed client facts; do not guess them in advance;
4. trigger an authenticated read-only tool first;
5. complete Logto -> ProConnect -> Logto consent/login;
6. verify subsequent MCP requests use the resulting OAuth bearer without exposing it;
7. test reconnect/refresh behavior;
8. revoke/logout and verify subsequent MCP access is stopped as required by the POC contract.

Record only sanitized outcomes:

```text
ChatGPT discovers protected MCP resource: PASS/FAIL
ChatGPT reaches Logto authorization: PASS/FAIL
Logto -> ProConnect login completes: PASS/FAIL
ChatGPT callback/code exchange completes: PASS/FAIL
Access token is bound to canonical MCP resource: PASS/FAIL
ChatGPT bearer reaches /mcp: PASS/FAIL
Dynamic Principal/context constructed for ChatGPT request: PASS/FAIL
OAuth bearer reaches Grist credential boundary: yes/no
Reconnect/refresh avoids unnecessary full reauthentication: PASS/FAIL
Logout/revocation stops subsequent MCP access: PASS/FAIL
```

Expected safe value for `OAuth bearer reaches Grist credential boundary` is `no`.

## Boundary

This readiness work does **not** complete C4-P0 by itself. C4-P0 remains ACTIVE until the real ChatGPT interoperability, refresh/reconnect, and revocation evidence is recorded as required by `docs/LOGTO-PROCONNECT-MCP-POC.md`.

Full production-oriented C4 remains blocked until those mandatory exit criteria are PASS.
