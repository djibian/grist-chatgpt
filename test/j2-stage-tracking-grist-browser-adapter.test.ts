import assert from "node:assert/strict";
import test from "node:test";

import {
  J2StageTrackingGristBrowserFactory,
  validateJ2GristBrowserAdapterConfig,
  type J2GristBrowserOwnerClient
} from "../src/j2/stageTrackingGristBrowserAdapter.js";
import type { J2SyntheticLinkKeyVault } from "../src/j2/stageTrackingSyntheticAccess.js";

const DOCUMENT_ID = "fixtureDoc123";
const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

class FixtureVault implements J2SyntheticLinkKeyVault {
  async getOrCreate(handle: string): Promise<string> {
    if (handle.includes("teacher-a")) return KEY_A;
    if (handle.includes("teacher-b")) return KEY_B;
    throw new Error("unexpected handle");
  }
}

class FixtureOwnerClient implements J2GristBrowserOwnerClient {
  applyCalls = 0;
  throwAfterApply = false;
  readonly teachers = [
    { id: 11, fields: { Fixture_Id: "teacher-a", Token_Stages: KEY_A, Acces_Stages_Actif: true } },
    { id: 12, fields: { Fixture_Id: "teacher-b", Token_Stages: KEY_B, Acces_Stages_Actif: true } }
  ];
  readonly stages = [
    {
      id: 21,
      fields: {
        Fixture_Id: "stage-a",
        Eleve: "Élève Alpha (synthétique)",
        Suivi_par: 11,
        Type_de_contact: "Visite",
        Date_du_contact: 1789516800,
        Ponctuel: "Oui",
        Implication: "Très satisfaisante",
        Commentaire: "Modification humaine synthétique à préserver"
      }
    },
    {
      id: 22,
      fields: {
        Fixture_Id: "stage-b",
        Eleve: "Élève Bêta (synthétique)",
        Suivi_par: 12,
        Type_de_contact: null,
        Date_du_contact: null,
        Ponctuel: null,
        Implication: null,
        Commentaire: null
      }
    }
  ];

  async queryRecords(_documentId: string, tableId: string): Promise<unknown> {
    return { records: tableId === "Stages" ? this.stages : this.teachers };
  }

  async applyUserActions(_documentId: string, actions: unknown[][]): Promise<unknown> {
    this.applyCalls += 1;
    const action = actions[0];
    assert.deepEqual(action?.slice(0, 3), ["UpdateRecord", "Enseignants", 11]);
    this.teachers[0]!.fields.Token_Stages = "";
    if (this.throwAfterApply) throw new Error("synthetic response loss");
    return null;
  }
}

function config() {
  return {
    gristOrigin: "https://grist.example.test",
    documentId: DOCUMENT_ID,
    documentPath: `/o/test/${DOCUMENT_ID}/J2-stage-tracking-fixture`,
    teacherPageRef: 7,
    alternatePageRef: 8,
    chromiumExecutable: "/usr/bin/chromium",
    gristVersion: "1.7.3",
    selectorProfile: "grist-core-b393db7" as const
  };
}

test("browser adapter accepts only one bounded fixture path and supported selector profile", () => {
  assert.deepEqual(validateJ2GristBrowserAdapterConfig(config()), config());
  assert.throws(
    () => validateJ2GristBrowserAdapterConfig({ ...config(), documentPath: "/o/test/anotherDoc/J2" }),
    /exact configured fixture document ID/
  );
  assert.throws(
    () => validateJ2GristBrowserAdapterConfig({
      ...config(),
      selectorProfile: "unreviewed-profile" as never
    }),
    /unsupported/
  );
  assert.throws(
    () => validateJ2GristBrowserAdapterConfig({ ...config(), documentPath: `${config().documentPath}?Token_=secret` }),
    /without query or fragment/
  );
});

test("browser adapter verifies exact server-held synthetic key provisioning and fingerprints without key material", async () => {
  const owner = new FixtureOwnerClient();
  const factory = new J2StageTrackingGristBrowserFactory(config(), owner, new FixtureVault());
  await factory.assertProvisionedFixture();
  const revision = await factory.fixtureRevision();
  assert.match(revision, /^[a-f0-9]{64}$/);
  assert.equal(revision.includes(KEY_A), false);
  owner.teachers[0]!.fields.Token_Stages = "wrong";
  await assert.rejects(() => factory.assertProvisionedFixture(), /exact provisioned synthetic access state/);
});

test("teacher A revocation is a one-shot owner effect with exact postcondition", async () => {
  const owner = new FixtureOwnerClient();
  const factory = new J2StageTrackingGristBrowserFactory(config(), owner, new FixtureVault());
  assert.equal(await factory.revokeTeacherALinkKey(), "APPLIED");
  assert.equal(owner.applyCalls, 1);
  assert.equal(owner.teachers[0]!.fields.Token_Stages, "");
  assert.equal(await factory.revokeTeacherALinkKey(), "UNKNOWN");
  assert.equal(owner.applyCalls, 1, "revocation must not blindly replay after the exact state changed");
});

test("ambiguous revocation response is resolved by one post-read without replay", async () => {
  const owner = new FixtureOwnerClient();
  owner.throwAfterApply = true;
  const factory = new J2StageTrackingGristBrowserFactory(config(), owner, new FixtureVault());
  assert.equal(await factory.revokeTeacherALinkKey(), "APPLIED");
  assert.equal(owner.applyCalls, 1);
});
