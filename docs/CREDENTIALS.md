# Grist credential boundary

The runtime obtains upstream Grist credentials through `GristCredentialProvider`; business services must not read `GRIST_API_KEY` directly.

## Current development provider

`StaticApiKeyCredentialProvider` preserves the existing single-user deployment. It is initialized from the server-side `GRIST_API_KEY` configuration and returns the same key for every current static principal. This is a compatibility provider, not the production multi-user credential model.

## Provider contract

A provider receives a `GristCredentialContext` containing the current bridge `Principal` and asynchronously resolves that principal's Grist API key. `GristClientFactory` is the only runtime seam that turns the resolved credential into a `GristClient`.

Future user-aware providers are expected to:

- resolve credentials by the authenticated principal rather than from model input;
- keep API keys and storage/encryption material entirely server-side;
- never include credentials in tool schemas, tool results, logs, audit payloads or committed files;
- fail closed when no credential exists for the principal;
- return a credential only for the configured Grist instance;
- avoid cross-principal client or discovery-cache reuse.

Persistence technology, encryption/key management and the secure onboarding flow are deliberately not chosen by this abstraction. Those remain later human-gated decisions.

The minimum operator decision package is [C5-DECISION.md](C5-DECISION.md).

## Construction flow

```text
Principal
   |
   v
GristCredentialProvider
   |
   | server-side API key
   v
GristClientFactory
   |
   v
GristClient
   |
   v
AccessPolicy / GristService / AuthorizedGristService
```

The current static runtime may construct separate service contexts for the MCP and GPT Actions principals while both resolve to the same configured API key. The later user-aware tranche can replace the provider and lifecycle without redesigning the Grist business operations.
