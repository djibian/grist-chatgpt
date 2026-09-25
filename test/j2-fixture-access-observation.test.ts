import assert from "node:assert/strict";
import test from "node:test";

import {
  observeJ2FixtureAccess,
  type J2FixtureObservationClient
} from "../src/j2/fixtureAccessObservation.js";

const DOCUMENT_ID = "fixture123456789";
const SECRET = "SHOULD_NOT_LEAVE_INTERNAL_METADATA";

class FixtureClient implements J2FixtureObservationClient {
  readonly reads: Array<{ documentId: string; tableId: string; limit?: number; hidden?: boolean }> = [];
  documentName = "J2-stage-tracking-fixture";
  documentAccess = "owners";

  async listOrgs() {
    return [{ id: 1 }];
  }

  async listWorkspaces() {
    return [{
      id: 1,
      name: "ChatGPT",
      docs: [{ id: DOCUMENT_ID, name: this.documentName, access: this.documentAccess }]
    }];
  }

  async queryRecords(
    documentId: string,
    tableId: string,
    options: { limit?: number; hidden?: boolean } = {}
  ): Promise<unknown> {
    this.reads.push({ documentId, tableId, ...options });
    if (tableId === "_grist_ACLResources") {
      return { records: [{ id: 1, fields: { tableId: "Stages", colIds: "*" } }] };
    }
    if (tableId === "_grist_ACLRules") {
      return { records: [{
        id: 1,
        fields: {
          resource: 1,
          permissionsText: "+R",
          rulePos: 1,
          aclFormula: `user.LinkKey.Token == "${SECRET}"`,
          aclFormulaParsed: JSON.stringify([
            "Eq", ["Attr", ["Attr", ["Name", "user"], "LinkKey"], "Token"],
            ["Const", SECRET]
          ])
        }
      }] };
    }
    if (tableId === "_grist_Shares") return { records: [] };
    if (tableId === "_grist_DocInfo") {
      return { records: [{ id: 1, fields: { schemaVersion: 46 } }] };
    }
    throw new Error("Unexpected metadata table");
  }
}

test("J2-A fixture probe verifies owner-visible fixture identity and emits bounded evidence", async () => {
  const client = new FixtureClient();
  const evidence = await observeJ2FixtureAccess(client, DOCUMENT_ID);

  assert.equal(evidence.target, "J2-stage-tracking-fixture");
  assert.match(evidence.targetIdSha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.observation.completeness, "COMPLETE");
  assert.equal(evidence.observation.rules[0]?.dependencies.usesLinkKey, true);
  assert.equal(client.reads.length, 4);
  assert.ok(client.reads.every((read) =>
    read.documentId === DOCUMENT_ID && read.hidden === true &&
    Number.isInteger(read.limit) && read.limit! <= 2_000
  ));

  const output = JSON.stringify(evidence);
  assert.equal(output.includes(DOCUMENT_ID), false);
  assert.equal(output.includes(SECRET), false);
  assert.equal(output.includes("aclFormula"), false);
});

test("J2-A fixture probe refuses a URL and a document without confirmed owner fixture identity", async () => {
  const client = new FixtureClient();
  await assert.rejects(
    observeJ2FixtureAccess(client, `https://grist.example/doc/${DOCUMENT_ID}?LinkKey=secret`),
    /bounded Grist document ID/
  );
  assert.deepEqual(client.reads, []);

  client.documentName = "suivi des stages chatgpt";
  await assert.rejects(observeJ2FixtureAccess(client, DOCUMENT_ID), /identity could not be established/);
  client.documentName = "J2-stage-tracking-fixture";
  client.documentAccess = "viewers";
  await assert.rejects(observeJ2FixtureAccess(client, DOCUMENT_ID), /identity could not be established/);
  assert.deepEqual(client.reads, []);
});
