import assert from "node:assert/strict";
import test from "node:test";

import { AccessModelObserver } from "../src/grist/accessModelObserver.js";

class AggregateMetadataReader {
  readonly maxReadRecords = 100;

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
            fields: {
              schemaVersion: 46,
              aggregateMetadata: Array.from({ length: 64 }, () => "x".repeat(20_000))
            }
          }
        ]
      };
    }
    return { records: [] };
  }
}

test("J2-A bounds cumulative fingerprint metadata even when every string is individually valid", async () => {
  const observation = await new AccessModelObserver(new AggregateMetadataReader()).observe({
    documentId: "synthetic-j2",
    principalId: "owner-test-principal",
    mandateId: "j2-a-observe",
    ownerAuthorized: true
  });

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("metadata_fingerprint_incomplete"));
  assert.match(observation.metadataFingerprint, /^[a-f0-9]{64}$/);
});
