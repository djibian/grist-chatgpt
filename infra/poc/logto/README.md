# Logto OSS POC environment

This directory supports **C4-P0 only**. It is a non-production environment used to prove the selected Logto -> ProConnect -> MCP architecture before full OAuth integration.

Pinned components:

- Logto OSS `1.43.0` (`ghcr.io/logto-io/logto:1.43.0`)
- PostgreSQL `16.15` (`postgres:16.15-alpine`)

The Compose stack deliberately publishes Logto and PostgreSQL on loopback only. Public HTTPS must terminate at an external reverse proxy. The Logto Admin Console should be reachable only through an administrative network control (VPN, allowlist, or equivalent), not exposed broadly to the Internet.

## 1. Prepare local configuration

```bash
cd infra/poc/logto
cp .env.example .env
openssl rand -hex 32
```

Put the generated URL-safe value in `LOGTO_DB_PASSWORD`, then set the two non-production HTTPS endpoints you control.

Never commit `.env`, ProConnect client secrets, OAuth tokens, authorization codes, cookies, or Grist API keys.

## 2. Start the stack

```bash
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

Logto's entrypoint follows the upstream `v1.43.0` demonstration startup pattern: seed the database idempotently, then start the service. PostgreSQL data is persisted in the `logto-postgres` named volume.

Useful checks:

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 logto
curl -fsS "${LOGTO_ENDPOINT}/oidc/.well-known/openid-configuration"
```

Stop without deleting the database:

```bash
docker compose --env-file .env down
```

Destroy the POC database only when intentionally resetting the experiment:

```bash
docker compose --env-file .env down -v
```

## 3. Configure ProConnect as upstream identity

For the OSS POC, use Logto's **generic social OIDC connector**, not the commercial Enterprise SSO feature.

In the ProConnect integration environment, register Logto as a non-production OIDC client. Copy the exact callback URI shown by the Logto OIDC connector into the ProConnect registration.

Configure in Logto only through the Admin Console using local secret handling:

- ProConnect integration issuer / discovery URL;
- client ID;
- client secret;
- Authorization Code flow;
- only identity scopes needed for the POC.

The ProConnect client secret must remain outside Git and outside model-visible conversation content.

Verify two complete login cycles for the same ProConnect user and record only sanitized identifiers/evidence in `docs/LOGTO-PROCONNECT-MCP-POC-RESULTS.md`.

## 4. Configure the MCP resource and scopes

Canonical POC resource:

```text
https://grist-chatgpt.loeildumaitre.fr/mcp
```

Required bridge scopes:

```text
doc:read
doc:write
doc.schema:write
```

Use a Logto third-party OAuth/OIDC application for the known ChatGPT test client. CIMD/dynamic-app support is an interoperability bonus, not a blocker for the initial pre-registered ChatGPT path.

Do not change the public scope vocabulary during the POC.

## 5. Run repository probes

After the HTTPS Logto endpoint is reachable:

```bash
npm run probe:logto -- metadata --issuer "$LOGTO_ENDPOINT/oidc"
```

The probe is intentionally read-only and credential-free. It checks the discovery contract that can be established without completing an OAuth flow. RFC 8707 acceptance, audience binding, refresh behavior, and ChatGPT interoperability remain live-flow evidence and must not be inferred from discovery alone.

## 6. Evidence rules

Record only PASS / FAIL / UNKNOWN with sanitized diagnostics. Never record raw:

- access tokens;
- refresh tokens;
- ID tokens;
- authorization codes;
- session cookies;
- ProConnect client secrets;
- Grist API keys.

The POC passes only when every mandatory criterion in `docs/LOGTO-PROCONNECT-MCP-POC.md` is demonstrated.
