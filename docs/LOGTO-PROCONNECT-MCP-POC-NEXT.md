# Live POC handoff boundary

The repository-side preparation intentionally stops before any secret-bearing or institutionally registered live step.

The next live actions require a non-production Logto HTTPS endpoint plus a ProConnect integration client created outside Git. Once those exist, run the credential-free Logto metadata probe first, then complete the OIDC login and MCP OAuth flows defined in `docs/LOGTO-PROCONNECT-MCP-POC.md`.

Do not paste ProConnect client secrets, OAuth tokens, authorization codes, cookies, or Grist API keys into GitHub, ChatGPT, issue comments, or model-visible tool inputs.

The repository-side work may continue independently on provider-neutral validation and tests, but full C4 must remain blocked until the live evidence ledger has no mandatory `UNKNOWN` entries.
