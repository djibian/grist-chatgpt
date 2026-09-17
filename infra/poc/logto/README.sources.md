# Source baseline for the Logto POC environment

This file records the public source assumptions used to build `infra/poc/logto/`.

- Logto release pinned for the POC: `v1.43.0`.
- Upstream `v1.43.0` demonstration Compose starts Logto with `npm run cli db seed -- --swe && npm start`.
- Logto OSS deployment documentation requires PostgreSQL `^14.0`, supports custom `ENDPOINT` / `ADMIN_ENDPOINT`, and recommends an external HTTPS reverse proxy when `TRUST_PROXY_HEADER=1` is used.
- PostgreSQL `16.15` was the current supported minor release when this POC baseline was prepared.
- The OSS identity-federation path selected for the POC is Logto's generic social OIDC connector, which uses Authorization Code and supports arbitrary OIDC identity providers.

These are environment facts only. They do not constitute PASS evidence for ProConnect federation, MCP RFC 8707 behavior, token audience binding, or ChatGPT interoperability; those remain live POC checks.
