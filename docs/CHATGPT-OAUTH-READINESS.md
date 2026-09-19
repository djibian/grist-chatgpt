# ChatGPT MCP OAuth readiness — C4-P0

**Initial readiness check:** 2026-09-18  
**Live interoperability completed:** 2026-09-19  
**Scope:** non-production C4-P0 only

This document records the readiness contract that preceded the real ChatGPT MCP OAuth proof. C4-P0 is now complete; the final live results are in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

Never record OAuth access/refresh/ID tokens, authorization codes, PKCE verifiers, cookies, ProConnect/Logto client secrets, raw provider identities, or Grist API keys in this document, GitHub, chat, or test output.

## Bridge prerequisites proven

The bridge exposes the OAuth/MCP signals required by the tested ChatGPT flow:

1. RFC 9728 protected-resource metadata at:

   ```text
   /.well-known/oauth-protected-resource
   ```

2. OAuth `securitySchemes` on every tool in `tools/list`, derived from the normative operation registry and mirrored in `_meta` for compatibility.

3. Runtime `_meta["mcp/www_authenticate"]` insufficient-scope challenges with `resource_metadata`, `error`, `error_description`, and `scope`.

The bridge remains provider-neutral. No Logto SDK or client-registration behavior is embedded in bridge core.

## Client-registration path proven

The real ChatGPT Developer Mode connection used:

```text
MCP resource: https://grist-chatgpt.loeildumaitre.fr/mcp
Client registration: CIMD
Client metadata: https://chatgpt.com/oauth/client.json
Callback: https://chatgpt.com/connector_platform_oauth_redirect
```

Logto 1.43.0 Dynamic app / CIMD accepted the ChatGPT client metadata document. ChatGPT successfully discovered the authorization/token endpoints, resource URI, OIDC metadata, UserInfo endpoint and the three fixed MCP scopes.

## OIDC permissions discovered during the live test

The first real authorization attempt failed with `invalid_scope` for `email`. A direct sanitized authorization diagnostic reproduced the failure.

The cause was configuration, not bridge incompatibility: Logto advertised OIDC `email`, but the Dynamic app had not granted the corresponding user permission.

After enabling the minimum required OIDC user permissions (`email`, plus `profile` for the advertised profile path), the authorization request proceeded to sign-in and the complete ChatGPT -> Logto -> ProConnect -> Logto -> ChatGPT flow succeeded.

No public bridge scope or authorization boundary was weakened.

## Public readiness probe

The non-destructive readiness probe remains useful for future deployments:

```bash
MCP_RESOURCE_URI='https://grist-chatgpt.loeildumaitre.fr/mcp' \
  npm run probe:chatgpt-oauth-readiness
```

It checks protected-resource metadata, canonical resource matching, authorization-server discovery, fixed bridge scopes, CIMD support, PKCE `S256`, Authorization Code, refresh-token support and unauthenticated `/mcp` resource challenges.

An optional authenticated `tools/list` proof may use a fresh token through the local environment only. The probe must never print the token or perform Grist writes.

## Real ChatGPT result

The live-client contract is now PASS for:

```text
ChatGPT discovers protected MCP resource
ChatGPT CIMD client accepted by Logto
ChatGPT reaches Logto authorization
Logto -> ProConnect login completes
ChatGPT callback/code exchange completes
ChatGPT bearer reaches /mcp
Dynamic Principal/context is created
OAuth bearer remains outside the Grist credential boundary
read-only Grist calls
bounded additive write and targeted re-read
bounded destructive delete and targeted verification
session persistence without unnecessary full login
ChatGPT-side disconnect
Logto grant removal followed by access-token expiry forces reconnect
```

Configured access-token lifetime for the revocation proof was 3600 seconds. Removing the Logto grant did not invalidate an already-issued self-contained JWT immediately; once that token expired, ChatGPT could no longer continue silently and displayed a reconnect prompt.

## Boundary after C4-P0

C4-P0 is **DONE**.

The next platform task is C4 productionization. The live POC still used `StaticApiKeyCredentialProvider` for upstream Grist access, so per-user Grist credential onboarding/isolation remains a separate C5 requirement before multi-user operation.
