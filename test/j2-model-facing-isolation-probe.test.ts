import assert from "node:assert/strict";
import test from "node:test";

import { AuthorizationError } from "../src/auth/authorizationService.js";
import {
  J2HmacSyntheticLinkKeyVault,
  J2ModelFacingIsolationProbe,
  fingerprintJ2ModelFacingBridge
} from "../src/j2/modelFacingIsolationProbe.js";

const FINGERPRINT = fingerprintJ2ModelFacingBridge({
  gristBaseUrl: "https://grist.example.test/api/",
  allowedDocumentIds: ["allowed-doc"],
  allowedWorkspaceIds: ["42"]
});

test("bridge fingerprint is stable under allowlist ordering and changes with the resource boundary", () => {
  const first = fingerprintJ2ModelFacingBridge({
    gristBaseUrl: "https://grist.example.test/",
    allowedDocumentIds: ["b", "a", "a"],
    allowedWorkspaceIds: ["2", "1"]
  });
  const reordered = fingerprintJ2ModelFacingBridge({
    gristBaseUrl: "https://grist.example.test/path/ignored",
    allowedDocumentIds: ["a", "b"],
    allowedWorkspaceIds: ["1", "2"]
  });
  const changed = fingerprintJ2ModelFacingBridge({
    gristBaseUrl: "https://grist.example.test/",
    allowedDocumentIds: ["a", "b", "fixture-doc"],
    allowedWorkspaceIds: ["1", "2"]
  });

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(reordered, first);
  assert.notEqual(changed, first);
});

test("successful model-facing read is READABLE", async () => {
  const calls: unknown[][] = [];
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords(...args: unknown[]) {
        calls.push(args);
        return { records: [] };
      }
    } as never,
    FINGERPRINT,
    () => 1234
  );

  assert.deepEqual(await probe.checkFixtureRead("fixture123"), {
    documentId: "fixture123",
    verdict: "READABLE",
    checkedAt: 1234,
    bridgeConfigFingerprint: FINGERPRINT
  });
  assert.deepEqual(calls, [["fixture123", "Enseignants", { limit: 1 }]]);
});

test("only bridge-local authorization denial proves DENIED", async () => {
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        throw new AuthorizationError("not allowed");
      }
    } as never,
    FINGERPRINT,
    () => 2000
  );

  assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "DENIED");
});

test("upstream, transport and other failures remain UNKNOWN", async () => {
  for (const error of [new Error("upstream 403"), new TypeError("transport")]) {
    const probe = new J2ModelFacingIsolationProbe(
      {
        async queryRecords() {
          throw error;
        }
      } as never,
      FINGERPRINT,
      () => 3000
    );
    assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "UNKNOWN");
  }
});

test("probe rejects URLs and malformed fixture IDs before attempting a read", async () => {
  let called = false;
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        called = true;
        return { records: [] };
      }
    } as never,
    FINGERPRINT
  );

  await assert.rejects(
    () => probe.checkFixtureRead("https://grist.example.test/doc/fixture123"),
    /bounded Grist document ID/
  );
  assert.equal(called, false);
});

test("HMAC vault is stable, distinct per handle and fixture, and returns bounded secret material", async () => {
  const seed = "0123456789abcdef0123456789abcdef";
  const first = new J2HmacSyntheticLinkKeyVault(seed, "fixture123");
  const same = new J2HmacSyntheticLinkKeyVault(seed, "fixture123");
  const otherFixture = new J2HmacSyntheticLinkKeyVault(seed, "fixture456");

  const a = await first.getOrCreate("j2-linkkey-teacher-a");
  const aAgain = await same.getOrCreate("j2-linkkey-teacher-a");
  const b = await first.getOrCreate("j2-linkkey-teacher-b");
  const elsewhere = await otherFixture.getOrCreate("j2-linkkey-teacher-a");

  assert.equal(a, aAgain);
  assert.notEqual(a, b);
  assert.notEqual(a, elsewhere);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.includes(seed), false);
});
