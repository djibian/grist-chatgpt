import assert from "node:assert/strict";
import test from "node:test";

import {
  J2HmacSyntheticLinkKeyVault,
  J2ModelFacingIsolationProbe,
  fingerprintJ2ModelFacingBridge
} from "../src/j2/modelFacingIsolationProbe.js";

const BRIDGE_ORIGIN = "https://grist.example.test/";
const FINGERPRINT = fingerprintJ2ModelFacingBridge({
  gristBaseUrl: BRIDGE_ORIGIN,
  allowedDocumentIds: ["allowed-doc"],
  allowedWorkspaceIds: ["42"]
});

function boundary(options: {
  fixtureBaseUrl?: string;
  allowedDocumentIds?: string[];
  allowedWorkspaceIds?: string[];
} = {}) {
  return {
    gristBaseUrl: BRIDGE_ORIGIN,
    fixtureBaseUrl: options.fixtureBaseUrl ?? BRIDGE_ORIGIN,
    allowedDocumentIds: options.allowedDocumentIds ?? ["allowed-doc"],
    allowedWorkspaceIds: options.allowedWorkspaceIds ?? ["42"]
  };
}

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

test("different Grist origin proves DENIED without touching the model-facing reader", async () => {
  let called = false;
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        called = true;
        return { records: [] };
      }
    } as never,
    boundary({ fixtureBaseUrl: "https://isolated-grist.example.test/" }),
    FINGERPRINT,
    () => 1000
  );

  assert.deepEqual(await probe.checkFixtureRead("fixture123"), {
    documentId: "fixture123",
    verdict: "DENIED",
    checkedAt: 1000,
    bridgeConfigFingerprint: FINGERPRINT
  });
  assert.equal(called, false);
});

test("same-origin document-only exclusion requires a negative strongest-path read", async () => {
  let called = false;
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        called = true;
        throw new Error("bridge resource policy refused target");
      }
    } as never,
    boundary({ allowedDocumentIds: ["allowed-doc"], allowedWorkspaceIds: [] }),
    FINGERPRINT,
    () => 1500
  );

  assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "DENIED");
  assert.equal(called, true);
});

test("same-origin static exclusion cannot hide a contradictory successful read", async () => {
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        return { records: [] };
      }
    } as never,
    boundary({ allowedDocumentIds: ["allowed-doc"], allowedWorkspaceIds: [] }),
    FINGERPRINT,
    () => 1750
  );

  assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "READABLE");
});

test("reachable same-origin fixture is READABLE", async () => {
  const calls: unknown[][] = [];
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords(...args: unknown[]) {
        calls.push(args);
        return { records: [] };
      }
    } as never,
    boundary({ allowedDocumentIds: ["fixture123"], allowedWorkspaceIds: [] }),
    FINGERPRINT,
    () => 2000
  );

  assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "READABLE");
  assert.deepEqual(calls, [["fixture123", "Enseignants", { limit: 1 }]]);
});

test("workspace-based or otherwise ambiguous read failure remains UNKNOWN", async () => {
  const probe = new J2ModelFacingIsolationProbe(
    {
      async queryRecords() {
        throw new Error("not allowed, unavailable or upstream failure");
      }
    } as never,
    boundary({ allowedDocumentIds: [], allowedWorkspaceIds: ["42"] }),
    FINGERPRINT,
    () => 3000
  );

  assert.equal((await probe.checkFixtureRead("fixture123")).verdict, "UNKNOWN");
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
    boundary(),
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
