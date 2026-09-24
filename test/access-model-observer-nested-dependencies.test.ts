import assert from "node:assert/strict";
import test from "node:test";

import { AccessModelObserver } from "../src/grist/accessModelObserver.js";

class NestedDependencyReader {
  readonly maxReadRecords = 100;

  async queryRecords(
    _documentId: string,
    tableId: string,
    _options: { limit?: number; hidden?: boolean; cellFormat?: "normal" | "typed" } = {}
  ): Promise<unknown> {
    if (tableId === "_grist_ACLResources") {
      return {
        records: [{ id: 1, fields: { tableId: "Stages", colIds: "*" } }]
      };
    }
    if (tableId === "_grist_ACLRules") {
      return {
        records: [
          {
            id: 1,
            fields: {
              resource: 1,
              rulePos: 1,
              permissionsText: "+R",
              aclFormula:
                "rec.Suivi_par == user.Teacher.id and user.Teacher.Acces_Stages_Actif",
              aclFormulaParsed: JSON.stringify([
                "And",
                [
                  "Eq",
                  ["Attr", ["Name", "rec"], "Suivi_par"],
                  ["Attr", ["Attr", ["Name", "user"], "Teacher"], "id"]
                ],
                [
                  "Attr",
                  ["Attr", ["Name", "user"], "Teacher"],
                  "Acces_Stages_Actif"
                ]
              ]),
              userAttributes: JSON.stringify({
                name: "Teacher",
                tableId: "Enseignants",
                lookupColId: "Token_Stages",
                charId: "LinkKey.Token"
              })
            }
          }
        ]
      };
    }
    if (tableId === "_grist_Shares") return { records: [] };
    if (tableId === "_grist_DocInfo") {
      return { records: [{ id: 1, fields: { schemaVersion: 46 } }] };
    }
    return { records: [] };
  }
}

test("J2-A recognizes nested teacher access-flag dependencies without flattening the path", async () => {
  const observation = await new AccessModelObserver(new NestedDependencyReader()).observe({
    documentId: "synthetic-j2",
    principalId: "owner-test-principal",
    mandateId: "j2-a-observe",
    ownerAuthorized: true
  });

  assert.equal(observation.completeness, "COMPLETE");
  assert.equal(observation.rules.length, 1);
  const dependencies = observation.rules[0]!.dependencies;
  assert.equal(dependencies.usesLinkKey, true);
  assert.equal(dependencies.usesSuiviPar, true);
  assert.equal(dependencies.usesAccesStagesActif, true);
  assert.ok(dependencies.userAttributes.includes("Teacher.Acces_Stages_Actif"));
  assert.equal(dependencies.userAttributes.includes("Acces_Stages_Actif"), false);
});
