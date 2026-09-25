# J2 model-facing fixture isolation probe

Status: **internal J2-B operator path; not a public MCP capability.**

J2 must not write synthetic LinkKeys into a fixture that any model-facing bridge path can read with the bridge's server-held Grist credential. The synthetic provisioner already fails closed unless a recent `DENIED` verdict is supplied for the exact fixture and bridge configuration. This document defines the concrete operator-side implementation of that verdict.

## What counts as `DENIED`

`J2ModelFacingIsolationProbe` is deliberately stricter than ordinary error handling. A runtime refusal is not permission evidence.

`DENIED` can be established only from static facts that put the fixture outside the deployed model-facing bridge boundary:

- the disposable fixture is on a different Grist origin from `GRIST_BASE_URL`; or
- the bridge and fixture share an origin, the bridge uses no workspace allowlist, and the exact fixture document ID is absent from the explicit document allowlist.

Those facts do not depend on upstream ACL behavior or successful authentication and cannot be changed by a Grist row-level rule.

For a different-origin fixture, no bridge read can address that Grist instance because the product has one fixed configured Grist origin. For every **same-origin** case, the operator command also constructs a deliberately strongest model-facing read principal with every configured document/workspace grant plus `doc:read` and attempts one bounded `Enseignants` read through the same `AuthorizedGristService.queryRecords` path used by public record reads.

A successful same-origin read is always `READABLE`, even if the separately supplied static boundary description claimed exclusion. An error becomes `DENIED` only when the document-only static exclusion independently proves that the target is outside the bridge; otherwise **every error is `UNKNOWN`**, including local authorization refusal, upstream HTTP/ACL denial, authentication failure, transport failure and missing-table behavior. None of those ambiguous errors can authorize provisioning.

This is intentionally conservative. In particular, a same-origin bridge with a workspace allowlist does not obtain `DENIED` merely because the fixture is currently outside an allowed workspace; workspace membership can change. Use a separate test origin or a document-only allowlist that statically excludes the fixture.

## Configuration fingerprint

The isolation evidence carries a SHA-256 fingerprint over non-secret model-facing bridge facts:

- normalized Grist origin;
- sorted allowed document IDs;
- sorted allowed workspace IDs;
- the probe contract/version and `doc:read` capability.

The upstream API key is deliberately not fingerprinted. A `DENIED` verdict depends only on static origin/resource-policy exclusion, so credential identity is not part of that proof. The provisioner already requires the probe fingerprint to match the fingerprint supplied for the current run and rejects stale evidence after 60 seconds.

## Synthetic LinkKey derivation

`J2HmacSyntheticLinkKeyVault` derives deterministic, fixture-namespaced synthetic LinkKeys from the server-held `J2_SYNTHETIC_LINKKEY_SEED`. HMAC evaluation is lazy: the existing provisioner asks the vault for secrets only after the fresh isolation probe returned `DENIED`.

The seed and derived LinkKeys must remain server-side. The command output contains only logical secret handles and bounded provisioning status/counts.

## Operator command

Run only in a protected environment containing the real bridge configuration plus a dedicated J2 owner credential for the disposable fixture:

```text
npm run j2:provision-synthetic-access
```

Required J2 environment values:

```text
J2_OWNER_AUTHORIZED=YES
J2_FIXTURE_DOCUMENT_ID=<bounded document id>
J2_GRIST_BASE_URL=<fixture Grist origin>
J2_GRIST_OWNER_API_KEY=<dedicated owner/test credential>
J2_OWNER_PRINCIPAL_ID=<bounded authority id>
J2_OWNER_MANDATE_ID=<bounded mandate id>
J2_SYNTHETIC_LINKKEY_SEED=<server-held secret, at least 32 characters>
```

The ordinary bridge environment (`GRIST_BASE_URL`, `GRIST_API_KEY`, allowed document/workspace IDs and the normal auth configuration required by `loadConfig`) must describe the deployed model-facing bridge being tested. Do not replace those values with fixture-owner settings merely to obtain a negative result.

The command first proves the exact disposable fixture identity with the dedicated owner client, then evaluates model-facing isolation. If the same-origin strongest path can read the fixture, the run refuses. If it errors in a configuration where static exclusion is not independently proven, the result remains `UNKNOWN` and the run also refuses. The HMAC vault is not called and no ACL or LinkKey is written unless a fresh `DENIED` result is established.

After isolation is proven, the existing J2 provisioner applies its bounded ACL-before-token action batch and exact-postcondition/no-blind-replay logic.

A successful command is J2-B fixture provisioning evidence only. It does not establish teacher-browser behavior, reference-fixture parity or J2 completion; J2-C and the remaining J2 evidence are still required.
