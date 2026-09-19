# OAuth operating model

This C4 slice makes configuration review repeatable without changing the proven architecture or declaring production multi-user readiness. Logto OSS remains the reference authorization server, ProConnect the upstream identity source, and the bridge a provider-neutral JWT/JWKS resource server. Public scopes remain exactly `doc:read`, `doc:write`, `doc.schema:write`.

## Offline deployment preflight

Run on the operator host with the intended protected environment already supplied through the deployment's secret mechanism:

```sh
npm ci
npm run check
npm test
npm run build
npm run check:oauth-deployment
```

For an existing protected `.env` file, the equivalent explicit invocation is:

```sh
node --env-file=.env --import tsx tools/oauth-deployment-preflight.ts
```

The npm command does not implicitly load `.env`. Do not paste credentials into shell commands, GitHub, evidence, chat or tool inputs. The preflight does not make network requests, start the server, mutate Grist or print configuration values. It reports fixed PASS/FAIL identifiers and exits nonzero on failed configuration checks. An invalid environment produces only `configuration_valid: FAIL`, because configuration parser exceptions may contain supplied values.

Required configuration boundaries:

| Setting | Operator requirement |
| --- | --- |
| `MCP_AUTH_MODE` | Explicitly `oauth`; omit `MCP_BEARER_TOKEN` |
| `OAUTH_ISSUER` | Exact configured issuer, including intentional path/trailing slash |
| `OAUTH_JWKS_URI` | Trusted issuer's HTTPS JWKS endpoint |
| `MCP_RESOURCE_URI` | Canonical public HTTPS URL ending in `/mcp`, no query/fragment/credentials; current target `https://grist-chatgpt.loeildumaitre.fr/mcp` |
| `MCP_ALLOWED_HOSTS` | Include that resource's hostname |
| `GRIST_BASE_URL` | Configured private Grist instance over HTTPS |
| Resource policy | At least one explicit document/workspace ceiling, as enforced by `loadConfig` |
| Operation limits | Positive read, write and schema maxima; unlimited settings fail this operating preflight |
| Secrets | `GRIST_API_KEY` and compatibility `GPT_ACTION_TOKEN` remain required by current startup; retain in operator secret storage only |

This is a stricter operating check, not a change to runtime development defaults or public authorization policy. It does not verify issuer/JWKS correspondence, remote availability, TLS/proxy correctness, token issuance, user isolation, or actual Grist ACLs. Passing exit status means only the offline configuration checks passed. The output always declares `multi_user_readiness: BLOCKED_C5_STATIC_GRIST_CREDENTIAL` and `live_oauth_validation: REQUIRED_SEPARATELY`.

## Unauthenticated operational smoke

After an authorized deployment or rollback, the public bridge surface can be checked without any OAuth token, Grist API key or synthetic document identifier:

```sh
MCP_RESOURCE_URI='https://example.invalid/mcp' npm run smoke:oauth-deployment
```

Supply the intended canonical public MCP resource URI through the operator environment; do not add credentials or query parameters. The smoke command performs only three public, non-mutating requests: `/healthz`, RFC 9728 protected-resource metadata, and an unauthenticated request to `/mcp`. It validates the service/version health payload, exact resource binding, the fixed three public scopes, one HTTPS authorization server, and the expected `WWW-Authenticate` resource-metadata challenge. It never accepts or sends a bearer token and prints only fixed PASS/FAIL identifiers.

A PASS proves only that the deployed public bridge and its published OAuth boundary are internally consistent at that instant. It does not validate token issuance, JWKS key acceptance, ProConnect federation, authenticated Grist access, per-user credential isolation or reviewer readiness. Use the authenticated probes separately where their stronger evidence is required.

## Release and evidence sequence

1. Resolve the exact candidate commit and successful CI on that head. Retain the previous working commit and its protected configuration as the rollback reference; never commit secret snapshots.
2. Run the offline preflight against the intended environment. Confirm the reverse proxy terminates HTTPS and forwards only to the existing localhost-bound server. Confirm issuer, canonical resource and fixed scopes against the operator's Logto resource configuration.
3. After the authorized release, run `smoke:oauth-deployment` against the canonical public MCP URI. Record only exact commit, UTC time, environment label and the fixed PASS/FAIL identifiers. This smoke is safe to repeat because it is unauthenticated and non-mutating.
4. In an isolated environment, run the existing `probe:oauth-bridge`, `probe:oauth-negative`, `probe:mcp-http-oauth` and `probe:chatgpt-oauth-readiness` procedures using their documented protected environment inputs. Follow [POC HTTP evidence](LOGTO-PROCONNECT-MCP-POC-HTTP-EVIDENCE.md) and [ChatGPT OAuth readiness](CHATGPT-OAUTH-READINESS.md); these probes are not invoked automatically by preflight or smoke. Inspect probe effects before running: authenticated probes can access the configured synthetic fixture. Never substitute real user data or replay a possibly completed write.
5. Record exact commit, UTC time, environment label, test/probe names and sanitized PASS/FAIL results only. Confirm wrong-resource and insufficient-scope rejection, metadata/challenges, valid signed token acceptance, and ChatGPT connection continuity. Keep subjects, principal IDs, tokens, codes, cookies and keys out of durable evidence.
6. Deployment remains an operator action. Do not replace the shared live POC endpoint to validate a feature branch. After an authorized release, use bounded reads against the synthetic fixture only when authenticated evidence is required; investigate ambiguous writes by targeted re-read, never automatic replay.
7. On failure, stop further operations and restore the previous reviewed application artifact and compatible protected environment using the operator's existing service procedure. Repeat the same preflight and unauthenticated smoke before stronger authenticated checks. Application rollback does not reverse Grist writes or Logto configuration changes; record and resolve these separately. Do not downgrade to static bearer to make OAuth checks pass.

## Remaining gates

C4 remains open until the operator has exercised this sequence on the intended deployment and recorded repeatable release/rollback, issuer/JWKS key-rotation and outage/recovery evidence. A controlled reboot is useful operating evidence, not a reason to reopen the completed C4-P0.

Logto grant removal does not revoke an already-issued self-contained JWT immediately. The POC proved expiration after its configured 3600-second lifetime and a reconnect prompt; retain this distinction when documenting logout and revocation expectations. Do not claim immediate revocation from offline checks.

C5 still requires human decisions for persistence and encryption/key management followed by per-user onboarding, credential removal and rotation. Until implemented, do not admit a second real user/reviewer under the static Grist credential path. S0 institutional/public-directory eligibility and C7 reviewer readiness remain separate gates. This runbook makes no hosting, institutional ownership, legal or publisher commitment.
