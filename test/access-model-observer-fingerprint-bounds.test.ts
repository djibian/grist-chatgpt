import assert from "node:assert/strict";
import test from "node:test";

import { AccessModelObserver } from "../src/grist/accessModelObserver.js";

class FakeReader {
  readonly maxReadRecords = 100;

  constructor(private readonly docInfoExtra: Record<string, unknown>) {}

  async queryRecords(
    _documentId: string,
    tableId: string,
    _options: { limit?: number; hidden?: boolean; cellFormat?: "normal" | "typed" } = {}
  ): Promise<unknown> {
    if (tableId === "_grist_ACLResources") {
      return { records: [{ id: 1, fields: { tableId: "Stages", colIds: "*" } }] };
    }
    if (tableId === "_grist_ACLRules") return { records: [] };
    if (tableId === "_grist_Shares") return { records: [] };
    if (tableId === "_grist_DocInfo") {
      return {
        records: [
          {
            id: 1,
            fields: { schemaVersion: 46, ...this.docInfoExtra }
          }
        ]
      };
    }
    return { records: [] };
  }
}

const authority = {
  documentId: "synthetic-j2",
  principalId: "owner-test-principal",
  mandateId: "j2-a-observe",
  ownerAuthorized: true
} as const;

test("J2-A marks an oversized raw fingerprint field partial without returning it", async () => {
  const secret = `SECRET-${"x".repeat(70_000)}`;
  const observation = await new AccessModelObserver(
    new FakeReader({ unexpectedDiagnostic: secret })
  ).observe(authority);

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("metadata_fingerprint_incomplete"));
  assert.match(observation.metadataFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(observation).includes(secret), false);
});

test("J2-A bounds unexpectedly deep raw metadata during fingerprinting", async () => {
  let nested: unknown = "leaf";
  for (let index = 0; index < 80; index += 1) {
    nested = { next: nested };
  }

  const observation = await new AccessModelObserver(
    new FakeReader({ unexpectedNestedMetadata: nested })
  ).observe(authority);

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("metadata_fingerprint_incomplete"));
  assert.match(observation.metadataFingerprint, /^[a-f0-9]{64}$/);
});
