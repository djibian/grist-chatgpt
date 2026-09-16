# User-aware Grist contexts

C3 separates static deployment policy from all state derived from a user's Grist credential.

## Context boundary

`GristContextFactory` creates one complete service graph for one bridge `Principal`:

```text
Principal
   |
   v
GristClientFactory
   |
   | credential resolved for this principal
   v
GristClient
   |
   +--> GristResourceDiscovery (private cache for this context)
   |          |
   |          v
   |    AccessPolicy
   |          ^
   |          |
   |   DeploymentResourcePolicy
   |   (shared static ceiling only)
   |
   +--> GristService / GristUiActionsAdapter
              |
              v
       AuthorizedGristService
```

The factory deliberately keeps no cache of user contexts. Calling `create(principal)` produces a fresh client, discovery cache, access policy and service graph. This makes the lifecycle safe for later request/session-scoped authenticated principals without allowing state learned through one credential to appear in another principal's context.

## Shared versus principal-bound state

Safe to share:

- `DeploymentResourcePolicy`: configured document/workspace ceiling;
- `AuditLogger`: receives only non-secret audit metadata;
- immutable service limits and configuration;
- the credential-provider interface itself, provided its implementation enforces principal isolation.

Must remain principal/context bound:

- resolved Grist credential;
- `GristClient`;
- discovered organizations, workspaces and documents;
- discovery cache;
- `AccessPolicy` instance using that discovery;
- authorization/service graph bound to the current `Principal`.

## Effective authority

The deployment policy is only a maximum boundary. A resource is usable only when all applicable layers permit it:

```text
current user's Grist ACLs (enforced upstream with that user's key)
∩ deployment resource policy
∩ principal resource grants
∩ operation capability
```

An explicitly configured document ID may still bypass discovery, preserving the existing bridge behavior, but the actual Grist operation continues to use the current principal's credential, so Grist remains authoritative and may reject access.

## Current static deployment

The development/backward-compatible server still creates two startup contexts for the existing static MCP and GPT Actions principals. Both currently resolve through `StaticApiKeyCredentialProvider`, so public behavior is unchanged.

The architectural difference is that context construction is now principal-aware and reusable by the future authenticated request path. Replacing static authentication with OAuth does not require redesigning Grist business services or sharing a singleton discovery cache.

## Deliberately not decided here

C3 does not choose or implement:

- an OAuth or identity provider;
- credential persistence or encryption;
- a user onboarding flow for Grist API keys;
- new public scopes or capabilities;
- a new destructive or generic operation.

Those remain later roadmap items and human-gated decisions where specified.
