import assert from "node:assert/strict";
import test from "node:test";

import {
  J2StageTrackingSyntheticAccessProvisioner,
  type J2SyntheticAccessClient,
  type J2SyntheticLinkKeyVault
} from "../src/j2/stageTrackingSyntheticAccess.js";

const SECRET_A = "A_0123456789abcdefghijklmnopqrstuvwxyz";
const SECRET_B = "B_0123456789abcdefghijklmnopqrstuvwxyz";

interface MutableRecord {
  id: number;
  fields: Record<string, unknown>;
}

function copyRecords(records: MutableRecord[]): MutableRecord[] {
  return records.map((record) => ({ id: record.id, fields: { ...record.fields } }));
}

class FixtureClient implements J2SyntheticAccessClient {
  readonly observedActions: unknown[][][] = [];
  applyMode: "success" | "uncertain-after-apply" = "success";
  includeHistoricalAuthor = false;

  private readonly tables = new Map<string, MutableRecord[]>([
    [
      "Enseignants",
      [
        {
          id: 11,
          fields: {
            Fixture_Id: "teacher-a",
            Token_Stages: "",
            Acces_Stages_Actif: true
          }
        },
        {
          id: 12,
          fields: {
            Fixture_Id: "teacher-b",
            Token_Stages: "",
            Acces_Stages_Actif: true
          }
        }
      ]
    ],
    [
      "_grist_ACLResources",
      [{ id: 1, fields: { tableId: "", colIds: "" } }]
    ],
    [
      "_grist_ACLRules",
      [
        {
          id: 1,
          fields: {
            resource: 1,
            permissions: 63,
            principals: "[1]",
            permissionsText: "",
            aclFormula: "",
            userAttributes: ""
          }
        }
      ]
    ]
  ]);

  async queryRecords(
    _documentIdOrUrl: string,
    tableId: string
  ): Promise<unknown> {
    return { records: copyRecords(this.tables.get(tableId) ?? []) };
  }

  async listColumns(
    _documentIdOrUrl: string,
    tableId: string
  ): Promise<unknown> {
    if (tableId === "Stages") {
      const columns = [
        ["Fixture_Id", "Text"],
        ["Eleve", "Text"],
        ["Suivi_par", "Ref:Enseignants"],
        ["Type_de_contact", "Choice"],
        ["Date_du_contact", "Date"],
        ["Ponctuel", "Choice"],
        ["Implication", "Choice"],
        ["Commentaire", "Text"]
      ];
      if (this.includeHistoricalAuthor) columns.push(["Auteur_du_contact", "Ref:Enseignants"]);
      return {
        columns: columns.map(([id, type]) => ({ id, fields: { type } }))
      };
    }
    if (tableId === "Enseignants") {
      return {
        columns: [
          { id: "Fixture_Id", fields: { type: "Text" } },
          { id: "Token_Stages", fields: { type: "Text" } },
          { id: "Acces_Stages_Actif", fields: { type: "Bool" } }
        ]
      };
    }
    return { columns: [] };
  }

  async applyUserActions(_documentIdOrUrl: string, actions: unknown[][]): Promise<unknown> {
    this.observedActions.push(actions);
    for (const action of actions) this.apply(action);
    if (this.applyMode === "uncertain-after-apply") {
      throw new Error("synthetic response loss");
    }
    return { actionNum: 1 };
  }

  setNonPristineAcl(): void {
    this.tables.get("_grist_ACLResources")!.push({
      id: 2,
      fields: { tableId: "Stages", colIds: "*" }
    });
  }

  private apply(action: unknown[]): void {
    const [name, tableId, rowId, fields] = action;
    assert.equal(typeof tableId, "string");
    assert.equal(typeof rowId, "number");
    const records = this.tables.get(tableId as string);
    assert.ok(records, `unexpected table ${String(tableId)}`);

    if (name === "UpdateRecord") {
      const record = records.find((candidate) => candidate.id === rowId);
      assert.ok(record, `missing row ${String(rowId)}`);
      assert.ok(fields && typeof fields === "object" && !Array.isArray(fields));
      Object.assign(record.fields, fields as Record<string, unknown>);
      return;
    }
    if (name === "RemoveRecord") {
      const index = records.findIndex((candidate) => candidate.id === rowId);
      assert.notEqual(index, -1, `missing row ${String(rowId)}`);
      records.splice(index, 1);
      return;
    }
    if (name === "AddRecord") {
      assert.ok(fields && typeof fields === "object" && !Array.isArray(fields));
      records.push({ id: rowId as number, fields: { ...(fields as Record<string, unknown>) } });
      return;
    }
    assert.fail(`unsupported synthetic action ${String(name)}`);
  }
}

class FixtureVault implements J2SyntheticLinkKeyVault {
  async getOrCreate(handle: string): Promise<string> {
    if (handle === "fixture:teacher-a-link-key") return SECRET_A;
    if (handle === "fixture:teacher-b-link-key") return SECRET_B;
    throw new Error(`unexpected handle ${handle}`);
  }
}

const AUTHORITY = Object.freeze({
  documentId: "synthetic-j2",
  principalId: "owner-test-principal",
  mandateId: "j2-b-provision",
  ownerAuthorized: true
});

test("J2-B provisions only the bounded synthetic LinkKey AccessModel and does not return secrets", async () => {
  const client = new FixtureClient();
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(client, new FixtureVault());

  const outcome = await provisioner.provision(AUTHORITY);

  assert.equal(outcome.status, "PROVISIONED");
  assert.equal(outcome.accessModel, "J2_SYNTHETIC_ORACLE_POLICY_V1");
  assert.equal(outcome.aclResourceCount, 5);
  assert.equal(outcome.aclRuleCount, 13);
  assert.equal(client.observedActions.length, 1);
  assert.equal(client.observedActions[0]!.length, 22);

  const serializedResult = JSON.stringify(outcome);
  assert.equal(serializedResult.includes(SECRET_A), false);
  assert.equal(serializedResult.includes(SECRET_B), false);

  const serializedActions = JSON.stringify(client.observedActions[0]);
  assert.match(serializedActions, /LinkKey\.Token/);
  assert.match(serializedActions, /rec\.Suivi_par == user\.Teacher\.id/);
  assert.match(serializedActions, /user\.Teacher\.Acces_Stages_Actif/);
  assert.match(serializedActions, /"Suivi_par"/);
  assert.match(serializedActions, /Type_de_contact,Date_du_contact,Ponctuel,Implication,Commentaire/);
  assert.ok(serializedActions.includes(SECRET_A));
  assert.ok(serializedActions.includes(SECRET_B));

  const second = await provisioner.provision(AUTHORITY);
  assert.equal(second.status, "ALREADY_PROVISIONED");
  assert.equal(client.observedActions.length, 1, "exact managed state must not be replayed");
});

test("J2-B confirms exact postcondition after an uncertain apply response without replay", async () => {
  const client = new FixtureClient();
  client.applyMode = "uncertain-after-apply";
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(client, new FixtureVault());

  const outcome = await provisioner.provision(AUTHORITY);

  assert.equal(outcome.status, "PROVISIONED_AFTER_UNCERTAIN_RESPONSE");
  assert.equal(client.observedActions.length, 1);
});

test("J2-B refuses to overwrite a non-pristine unknown AccessModel", async () => {
  const client = new FixtureClient();
  client.setNonPristineAcl();
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(client, new FixtureVault());

  await assert.rejects(
    () => provisioner.provision(AUTHORITY),
    /neither pristine nor the exact managed J2 policy/
  );
  assert.equal(client.observedActions.length, 0);
});

test("J2-B requires the date-present initial state to leave historical author binding absent", async () => {
  const client = new FixtureClient();
  client.includeHistoricalAuthor = true;
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(client, new FixtureVault());

  await assert.rejects(
    () => provisioner.provision(AUTHORITY),
    /must not pre-provision the historical author binding/
  );
  assert.equal(client.observedActions.length, 0);
});

test("J2-B requires explicit owner authority", async () => {
  const client = new FixtureClient();
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(client, new FixtureVault());

  await assert.rejects(
    () => provisioner.provision({ ...AUTHORITY, ownerAuthorized: false }),
    /requires explicit owner authorization/
  );
  assert.equal(client.observedActions.length, 0);
});
