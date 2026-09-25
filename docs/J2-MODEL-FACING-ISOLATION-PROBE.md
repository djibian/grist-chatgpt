# J2 model-facing fixture isolation probe

Status: **internal J2-B operator path; not a public MCP capability.**

J2 must not write synthetic LinkKeys into a fixture that any model-facing bridge path can read with the bridge's server-held Grist credential. The synthetic provisioner already fails closed unless a recent `DENIED` verdict is supplied for the exact fixture and bridge configuration. This document defines the concrete operator-side implementation of that verdict.

## What counts as `DENIED`

`J2ModelFacingIsolationProbe` uses the same `AuthorizedGristService.queryRecords` boundary as model-facing record reads. The operator command constructs a deliberately strongest model-facing read principal with:

- every document ID allowed by the deployed bridge resource policy;
- every workspace ID allowed by that policy;
- `doc:read`, even if a deployed client has narrower capabilities.

The probe attempts one bounded read of `Enseignants` for the exact synthetic fixture document ID.

Only a bridge-local `AuthorizationError` is classified as `DENIED`. This proves that the deployment resource boundary rejects the target before the Grist API is called. A successful read is `READABLE`. Upstream HTTP errors, ACL denial, authentication failure, transport failure, missing-table behavior or any other exception are `UNKNOWN`; they cannot authorize provisioning.

This is intentionally conservative. It proves exclusion from the configured bridge resource boundary, not correctness of Grist ACLs.

## Configuration fingerprint

The isolation evidence carries a SHA-256 fingerprint over non-secret configuration facts that determine this resource boundary:

- normalized Grist origin;
- sorted allowed document IDs;
- sorted allowed workspace IDs;
- the probe contract/version and `doc:read` capability.

The upstream API key is deliberately not fingerprinted. A `DENIED` verdict is accepted only when the bridge rejected the document locally before an upstream request, so API-key identity is not part of that proof. The provisioner already requires the probe fingerprint to match the fingerprint supplied for the current run and rejects stale evidence after 60 seconds.

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

The command first proves the exact disposable fixture identity with the dedicated owner client, then evaluates the model-facing denial. If the fixture is reachable through the deployment allowlist, the run refuses before the HMAC vault is called and before any ACL or LinkKey write. If isolation is proven, the existing J2 provisioner applies its bounded ACL-before-token action batch and exact-postcondition/no-blind-replay logic.

A successful command is J2-B fixture provisioning evidence only. It does not establish teacher-browser behavior, reference-fixture parity or J2 completion; J2-C and the remaining J2 evidence are still required.
