import assert from "node:assert/strict";
import test from "node:test";

import { AccessModelObserver } from "../src/grist/accessModelObserver.js";

class FakeReader {
  readonly maxReadRecords = 100;
  readonly calls: string[] = [];

  constructor(private readonly tables: Record<string, unknown>) {}

  async queryRecords(
    _documentId: string,
    tableId: string,
    _options: { limit?: number; hidden?: boolean; cellFormat?: "normal" | "typed" } = {}
  ): Promise<unknown> {
    this.calls.push(tableId);
    return this.tables[tableId] ?? { records: [] };
  }
}

function authority() {
  return {
    documentId: "synthetic-j2",
    principalId: "owner-test-principal",
    mandateId: "j2-a-observe",
    ownerAuthorized: true
  } as const;
}

function baselineTables(): Record<string, unknown> {
  return {
    _grist_ACLResources: {
      records: [
        { id: 1, fields: { tableId: "Stages", colIds: "*" } },
        { id: 2, fields: { tableId: "*", colIds: "*" } }
      ]
    },
    _grist_ACLRules: {
      records: [
        {
          id: 10,
          fields: {
            resource: 1,
            permissionsText: "+RU",
            rulePos: 1,
            aclFormula: 'user.LinkKey == "SYNTHETIC-SECRET" and rec.Suivi_par == user.Teacher.Ref',
            aclFormulaParsed: JSON.stringify([
              "And",
              ["Eq", ["Attr", ["Name", "user"], "LinkKey"], ["Const", "SYNTHETIC-SECRET"]],
              [
                "Eq",
                ["Attr", ["Name", "rec"], "Suivi_par"],
                ["Attr", ["Attr", ["Name", "user"], "Teacher"], "Ref"]
              ]
            ]),
            userAttributes: JSON.stringify({
              name: "Teacher",
              tableId: "Enseignants",
              lookupColId: "LinkKey",
              charId: "LinkKey"
            })
          }
        },
        {
          id: 11,
          fields: {
            resource: 2,
            permissionsText: "none",
            rulePos: 2,
            aclFormula: "",
            aclFormulaParsed: "",
            userAttributes: ""
          }
        }
      ]
    },
    _grist_Shares: { records: [] },
    _grist_DocInfo: { records: [{ id: 1, fields: { schemaVersion: 46 } }] }
  };
}

test("J2-A normalizes ACL semantics without exposing formula constants", async () => {
  const reader = new FakeReader(baselineTables());
  const observation = await new AccessModelObserver(reader).observe(authority());

  assert.equal(observation.completeness, "COMPLETE");
  assert.equal(observation.schemaVersion, 46);
  assert.match(observation.metadataFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(reader.calls.sort(), [
    "_grist_ACLResources",
    "_grist_ACLRules",
    "_grist_DocInfo",
    "_grist_Shares"
  ].sort());

  const stageRule = observation.rules[0]!;
  assert.equal(stageRule.resourceId, 1);
  assert.equal(stageRule.permissions.read, "allow");
  assert.equal(stageRule.permissions.update, "allow");
  assert.equal(stageRule.permissions.create, "unchanged");
  assert.deepEqual(stageRule.dependencies.recordFields, ["Suivi_par"]);
  assert.deepEqual(stageRule.dependencies.userAttributes, ["LinkKey", "Teacher", "Teacher.Ref"]);
  assert.equal(stageRule.dependencies.usesLinkKey, true);
  assert.equal(stageRule.dependencies.usesSuiviPar, true);
  assert.equal(stageRule.userAttribute?.tableId, "Enseignants");

  const serialized = JSON.stringify(observation);
  assert.equal(serialized.includes("SYNTHETIC-SECRET"), false);
  assert.equal(serialized.includes("aclFormula"), false);
  assert.equal(serialized.includes("aclFormulaParsed"), false);
});

test("J2-A marks formula/share uncertainty instead of inventing completeness", async () => {
  const tables = baselineTables();
  tables._grist_ACLRules = {
    records: [
      {
        id: 10,
        fields: {
          resource: 1,
          permissionsText: "+R",
          rulePos: 1,
          aclFormula: "rec.Suivi_par == 1",
          aclFormulaParsed: "not-json",
          userAttributes: ""
        }
      }
    ]
  };
  tables._grist_Shares = {
    records: [
      {
        id: 3,
        fields: {
          linkId: "SYNTHETIC-SHARE-SECRET",
          options: JSON.stringify({ publish: true, token: "DO-NOT-EXPOSE" })
        }
      }
    ]
  };

  const observation = await new AccessModelObserver(new FakeReader(tables)).observe(authority());

  assert.equal(observation.completeness, "PARTIAL");
  assert.equal(observation.sharing.shareCount, 1);
  assert.equal(observation.sharing.publishedShareCount, 1);
  assert.equal(observation.sharing.virtualRuleContext, "UNKNOWN");
  assert.ok(observation.issues.includes("acl_formula_dependency_unknown"));
  assert.ok(observation.issues.includes("virtual_share_rules_unknown"));
  assert.equal(observation.rules[0]!.dependencyExtractionComplete, false);
  const serialized = JSON.stringify(observation);
  assert.equal(serialized.includes("SYNTHETIC-SHARE-SECRET"), false);
  assert.equal(serialized.includes("DO-NOT-EXPOSE"), false);
});

test("J2-A refuses non-owner and secret-bearing target contexts before metadata reads", async () => {
  const reader = new FakeReader(baselineTables());
  const observer = new AccessModelObserver(reader);

  await assert.rejects(
    observer.observe({ ...authority(), ownerAuthorized: false }),
    /explicit owner authorization/
  );
  await assert.rejects(
    observer.observe({ ...authority(), documentId: "https://grist.example/doc/x?LinkKey=secret" }),
    /bounded non-URL identifier/
  );
  assert.deepEqual(reader.calls, []);
});

test("J2-A treats a metadata read at the hard/bridge limit as potentially incomplete", async () => {
  const tables = baselineTables();
  tables._grist_ACLResources = {
    records: Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      fields: { tableId: `T${index + 1}`, colIds: "*" }
    }))
  };
  tables._grist_ACLRules = { records: [] };
  const observation = await new AccessModelObserver(new FakeReader(tables)).observe(authority());

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("metadata_limit_reached"));
});
