# Live POC handoff boundary

C4-P0 Logto / ProConnect / MCP interoperability is now **DONE**.

This file remains as the durable handoff from the non-production proof to production-oriented C4. At every fresh execution, resolve exact `main`, then read `AGENTS.md`, `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/LOGTO-PROCONNECT-MCP-POC.md`, `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`, `docs/LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md`, `docs/CHATGPT-OAUTH-READINESS.md`, and this file. Reconstruct mutable GitHub facts before any durable transition.

Never record ProConnect client secrets, OAuth tokens/codes/cookies, Logto/database/admin credentials, Grist API keys, raw Logto user IDs, raw provider subjects, or PKCE verifiers in GitHub, chat, logs, or evidence documents.

## Proven non-production architecture

```text
ChatGPT Developer Mode
        |
      OAuth
        v
Logto OSS 1.43.0
        |
   ProConnect OIDC
        |
        v
grist-chatgpt /mcp
        |
 dynamic Principal
        |
        v
Grist context
        |
StaticApiKeyCredentialProvider   <-- POC-only upstream credential model
        |
        v
Grist Community
```

Canonical resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Fixed public scopes:

```text
doc:read
doc:write
doc.schema:write
```

## C4-P0 exit evidence

All mandatory live-client checks are PASS:

```text
ChatGPT discovers protected MCP resource: PASS
ChatGPT CIMD client identity accepted by Logto: PASS
ChatGPT reaches Logto authorization: PASS
Logto -> ProConnect login completes: PASS
ChatGPT callback/code exchange completes: PASS
ChatGPT bearer reaches /mcp: PASS
Dynamic Principal/context constructed for ChatGPT request: PASS
OAuth bearer reaches Grist credential boundary: no
Read-only Grist operations: PASS
Bounded additive write + targeted re-read: PASS
Bounded destructive delete + targeted verification: PASS
Reconnect/session persistence without full reauthentication: PASS
ChatGPT-side disconnect removes connector availability: PASS
Removed Logto grant cannot silently renew after access-token expiry: PASS
Post-expiry reconnect required: yes
```

The configured access-token lifetime used for the revocation proof was 3600 seconds. Removing the Logto grant did not retroactively invalidate an already-issued self-contained JWT, but after expiry ChatGPT displayed a reconnect prompt and could no longer continue silently.

Detailed sanitized evidence is in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## Important limitation preserved

The live proof used the server's static Grist API key through `StaticApiKeyCredentialProvider`.

Therefore:

- ChatGPT <-> bridge OAuth identity is proven;
- bridge authorization/scopes are proven;
- per-user Grist credential isolation is **not** yet production-complete;
- do not onboard a second real user/reviewer as if upstream Grist credentials were isolated;
- C5 remains required before multi-user operation.

## Next platform chantier: C4

C4 is now **ELIGIBLE**.

Its purpose is productionization, not redesign. Preserve:

- ProConnect as upstream institutional identity;
- Logto OSS as reference MCP-facing authorization server;
- provider-neutral JWT/JWKS resource-server core;
- canonical RFC 8707 resource binding;
- the three fixed scopes only;
- CIMD compatibility proven with the real ChatGPT client;
- credential and OAuth-token invisibility;
- current wrong-resource / insufficient-scope failure semantics.

C4 should focus on repeatability and operations: production configuration boundaries, deploy/rollback procedure, explicit non-POC defaults, health/smoke checks and documentation needed before C5.

Do not choose credential persistence/encryption architecture inside C4. That remains a human gate for C5.

## Parallel product work

Per `docs/ROADMAP.md`, one product Worker may proceed independently while C4 advances.

Preferred first product tranche:

```text
P1 document UI parity
```

Start with non-destructive, bounded UI semantics such as richer widget inspection/configuration and explicit `select-by` option discovery. New destructive page/widget capabilities remain a human gate.

## Secondary follow-up, not C4-P0 blockers

Still useful later, but not reasons to reopen C4-P0:

- controlled full-host reboot/persistence exercise;
- explicitly isolated upstream ProConnect logout/re-authentication test;
- reviewer-specific OIDC/UserInfo proof for `email_verified: true` under S1/C7;
- final public-directory eligibility under S0.
