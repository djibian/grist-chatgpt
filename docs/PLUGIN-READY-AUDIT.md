# Plugin-ready audit — Grist Community / DINUM

**Status:** current product-readiness audit  
**Audit date:** 2026-09-17  
**Audit baseline:** `main` after C1, C2, C3, ProConnect/MCP compatibility research and the independent C6 timeout preparation.

This document is an assessment of the current repository and remaining gaps. It does not change runtime behavior, select an OAuth/identity provider, select credential persistence/encryption, add scopes, or create an institutional commitment.

## Executive assessment

`grist-chatgpt` has moved beyond the original single-client architecture prototype. The bounded Grist business surface, MCP contract, credential abstraction and per-principal context isolation are now integrated.

The critical path is no longer a Grist feature problem. It is an **identity and production-readiness problem**:

```text
C1 Credential abstraction       DONE
C2 MCP contract v1              DONE
C3 User-aware Grist context     DONE
C4 OAuth MCP identity           BLOCKED by human identity-provider decision
C5 Secure Grist onboarding      BLOCKED by C4 + human persistence/encryption decisions
C6 Production hardening         BLOCKED for finalization by C4/C5
C7 Reviewer fixture             BLOCKED by C4/C5
C8 Submission package           BLOCKED by C6/C7
```

The product target remains a multi-user MCP bridge for **one configured Grist Community DINUM instance**. Each authenticated production user must execute upstream Grist work with that user's own Grist API key; Grist remains authoritative for ACLs and the bridge may only reduce authority.

## Current readiness summary

| Domain | Current status | Assessment |
| --- | --- | --- |
| Product positioning | Green | MCP-first bridge for the Grist Community gap; initial target remains one configured DINUM instance |
| Public remote MCP over HTTPS | Green for prototype | End-to-end public bridge validation already exists; production identity remains unfinished |
| Grist business layer | Green | Records, schema, discovery and bounded document-UI operations are implemented |
| Bounded-operation security model | Green | No generic HTTP, raw SQL or arbitrary model-visible `/apply`/UserAction escape hatch |
| Credential abstraction (C1) | Green | `GristCredentialProvider` / `GristClientFactory` seam integrated; static provider preserves development deployment |
| Principal context isolation (C3) | Green | Credential-derived clients, discovery caches, access policies and service graphs are fresh per principal context |
| MCP contract v1 (C2) | Green | Registry-driven metadata, full-surface contract checks, structured stable successes and typed error direction integrated |
| OAuth ChatGPT/Codex -> bridge (C4) | Red / blocking | Production still uses static bearer principals; provider/architecture selection is human-gated |
| Per-user Grist credential onboarding (C5) | Red / blocking | Runtime seam exists, but secure collection/storage/disconnect is not implemented and storage/encryption are human-gated |
| ProConnect direct MCP compatibility | Ruled out for assessed configuration | Assessed ProConnect configuration disables RFC 8707 Resource Indicators required by MCP 2026-07-28 |
| Production timeouts | Partial green | Grist upstream abort timeout and inbound HTTP receive/header limits are integrated |
| Rate limiting / observability / release controls | Amber/red | Remaining C6 work; several parts depend on final dynamic-principal and deployment choices |
| Reviewer fixture | Red | Synthetic reviewer identity/data and reproducible positive/negative scenarios remain blocked by identity/onboarding |
| Submission package | Red / later | Publisher/domain/privacy/support/reviewer requirements must be revalidated at submission time |
| Apps SDK UI / skills | Not required initially | MCP-only remains sufficient for first product unless a demonstrated need changes scope |

## Integrated architecture to preserve

The current architecture is no longer a singleton Grist visibility model.

```text
MCP / GPT Actions
       |
       v
Principal + capabilities
       |
       v
GristContextFactory
       |
       +--> GristClientFactory
       |        |
       |        v
       |   GristCredentialProvider
       |
       +--> credential-derived GristClient
       +--> private GristResourceDiscovery cache
       +--> AccessPolicy
       +--> AuthorizationService
       +--> AuthorizedGristService
                    |
                    v
                GristService
                    |
                    v
          Grist Community DINUM
```

`DeploymentResourcePolicy` contains only deployment-level document/workspace ceilings and is safe to share. Every `GristContextFactory.create(principal)` call creates fresh credential-derived state for that principal. The factory deliberately does not keep a cross-principal context cache.

The current development deployment still resolves both static principals through one configured `GRIST_API_KEY` via `StaticApiKeyCredentialProvider`. That is a backward-compatible development substitution, not the final multi-user credential model.

## Effective authorization model

Production authority remains the intersection of:

```text
current user's Grist permissions
∩ deployment resource policy
∩ principal resource grants
∩ required operation capability / OAuth scope
```

Current bridge capability vocabulary:

```text
doc:read
doc:write
doc.schema:write
```

No current work authorizes changing that public scope set.

Important invariants already present:

- destructive operations use named, bounded targets;
- partial/non-atomic writes are explicit and must not be blindly replayed;
- ambiguous UI writes are independently re-read and verified;
- functional document/table/column/record/page/widget IDs may remain model-visible when needed for safe follow-up calls;
- credentials and session secrets never belong in model-visible inputs/outputs or audit payloads.

## C1 — credential abstraction: integrated

The earlier audit described a future credential-provider seam. That seam now exists.

`StaticApiKeyCredentialProvider` preserves the current development deployment, while `GristClientFactory` accepts a principal-aware credential context. The remaining production work is **not** to redesign Grist business operations; it is to supply a user-aware credential provider after secure onboarding/persistence decisions are made.

The production invariant remains:

> a principal may receive only the Grist credential associated with that same authenticated user.

## C2 — MCP contract v1: integrated

MCP is the normative public product direction. The operation registry now carries product-level metadata used to keep public MCP definitions and authorization intent aligned.

Integrated direction includes:

- user-intent-oriented titles/descriptions;
- risk annotations checked across the surface;
- structured success results where stable/useful;
- typed error categories without secrets/stacks;
- text-only error envelopes where success `outputSchema` validation would otherwise make recoverable tool errors become protocol failures;
- preservation of explicit partial/ambiguous write semantics.

Further contract refinement may happen later, but C2 is not the current blocking dependency.

## C3 — user-aware Grist context: integrated

The earlier singleton discovery/cache risk has been removed architecturally.

For each principal context the bridge creates fresh:

- `GristClient`;
- `GristResourceDiscovery` cache;
- `AccessPolicy`;
- `AuthorizationService`;
- Grist service/UI adapter graph;
- `AuthorizedGristService` bound to that exact principal.

Cross-user tests demonstrate that resources learned through one synthetic user's credential do not appear in another principal's discovery/cache state.

This means C5 can later provide different per-user credentials without first redesigning cache isolation.

## C4 — OAuth MCP identity: current blocking gate

Production MCP still authenticates with a static bearer principal. The target is an OAuth-authenticated dynamic `Principal` whose token is validated for issuer, resource/audience, expiry and scopes as required by the current MCP authorization contract.

The decision package is maintained in `docs/OAUTH-IDP-DECISION.md`.

### ProConnect compatibility finding

Repository compatibility work established for the assessed public ProConnect configuration:

- PKCE `S256` support is present;
- RFC 8707 Resource Indicators are explicitly disabled (`resourceIndicators: { enabled: false }`).

MCP `2026-07-28` requires the MCP client to send the target `resource` and requires resource-bound token acquisition. Therefore **direct ProConnect as the MCP-facing authorization server is ruled out for the assessed configuration**.

This finding does not select a replacement architecture and does not decide whether ProConnect remains the upstream identity source.

### Human decision still required

Provider-specific C4 implementation must not start until an authorized human decides at least:

- whether ProConnect is required as the production identity source;
- whether an MCP-specific authorization server should federate to ProConnect or another identity/provider should be used;
- who operates a separate authorization server (managed/self-hosted/either);
- whether only ChatGPT/Codex pre-registration is required or broader MCP client registration interoperability is required;
- acceptable refresh/reauthentication behavior;
- ownership of any production OAuth/ProConnect registration or institutional approval.

## C5 — secure Grist onboarding: blocked

The credential seam is ready, but secure per-user credential lifecycle is intentionally not implemented before the human decisions on persistence/encryption.

Required production behavior remains:

1. authenticate the bridge user;
2. collect the user's Grist API key outside the model conversation/tool surface;
3. validate it directly against the configured DINUM Grist instance;
4. associate verified Grist identity with the authenticated principal;
5. store credential material encrypted at rest;
6. resolve it only for that principal's upstream requests;
7. provide disconnect/removal and lifecycle/revalidation handling;
8. never log, audit, return or prompt the credential through model-visible surfaces.

Persistence technology and encryption/key-management architecture are explicit human gates.

## C6 — production hardening

C6 cannot be finalized before C4/C5, but identity-independent timeout preparation is integrated.

### Integrated

- Grist upstream requests use an explicit 10-second abort timeout;
- inbound Node HTTP request reception is bounded to 120 seconds;
- inbound HTTP header reception is bounded to 60 seconds;
- these receive-side limits do not cap MCP streaming response duration.

### Remaining

- per-principal rate limiting after dynamic principal semantics are final;
- operational metrics and alerting;
- structured audit export where required;
- secret/key rotation procedure;
- documented deployment and rollback procedure;
- protected release workflow / `main` protections;
- post-deploy synthetic smoke tests.

Do not pre-select institutional monitoring, secret-management or deployment products merely to close these bullets.

## C7 — reviewer fixture

The reviewer environment remains blocked by C4/C5 because a realistic reviewer must authenticate without using real educational/administrative identities or data and must receive a safely isolated Grist credential/data fixture.

Planned positive scenarios include:

1. inspect structure, relations, pages and widgets;
2. query/filter records;
3. create a table, columns and records;
4. perform bounded data/schema updates;
5. create a page, add widgets, configure direct `select-by`, and verify by independent re-read.

Planned negative scenarios include:

1. insufficient scope for write;
2. resource outside deployment/principal permission;
3. invalid/nonexistent UI linkage target with no unintended write.

These scenarios should become both automated integration coverage and reviewer instructions once identity/onboarding are available.

## C8 — submission package

Submission-specific requirements change independently of this repository and must be revalidated close to submission.

Expected package areas include:

- stable public HTTPS MCP endpoint;
- developer/publisher identity and required permissions;
- domain verification;
- public metadata and example prompts;
- support contact/website;
- privacy policy and terms;
- reviewer credentials and instructions;
- availability/country settings;
- tool/security scan findings;
- accurate non-misleading relationship statements regarding Grist Labs, DINUM / La Suite numérique and OpenAI.

The repository must not claim an official institutional relationship that has not been explicitly established.

## Deliberate non-goals and deferred breadth

The current critical path does not include:

- arbitrary multi-instance Grist routing;
- generic HTTP forwarding;
- raw SQL;
- arbitrary UserActions or generic `/apply` access;
- user/ACL administration;
- layout mutation;
- page/widget deletion;
- generated executable custom widgets;
- Apps SDK UI;
- skills.

Additional Grist feature breadth should not displace identity/security readiness unless the authoritative roadmap changes.

## Current critical-path conclusion

The repository has the core Grist/MCP service architecture needed to proceed. C1-C3 are integrated and the direct-ProConnect compatibility uncertainty has been materially reduced.

The next blocking transition is now explicitly human:

> choose and durably record the production identity-source / MCP authorization-server architecture for C4.

Until that gate is resolved, useful autonomous work should be limited to genuinely independent low-risk preparation already permitted by the roadmap and documentation/consistency fixes. It must not silently commit to a provider, persistence/encryption architecture, new scopes, a changed Grist credential model, new generic/destructive power, or an institutional obligation.

## Authoritative companion documents

- `AGENTS.md` — execution contract and human gates;
- `docs/PRODUCT_VISION.md` — product target and invariants;
- `docs/ROADMAP.md` — eligibility/dependencies;
- `docs/ARCHITECTURE.md` — current and target architecture;
- `docs/SECURITY.md` — security doctrine;
- `docs/OAUTH-IDP-DECISION.md` — C4 human decision package;
- `docs/PROCONNECT-MCP-COMPAT-RESULTS.md` — current direct-ProConnect compatibility evidence;
- `docs/OPENAI-SUBMISSION.md` — submission planning, to be revalidated near submission.
