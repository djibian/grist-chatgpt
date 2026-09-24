import assert from "node:assert/strict";
import test from "node:test";

import { AccessModelObserver } from "../src/grist/accessModelObserver.js";

class FakeReader {
  readonly maxReadRecords = 100;

  constructor(private readonly rules: unknown[]) {}

  async queryRecords(
    _documentId: string,
    tableId: string,
    _options: { limit?: number; hidden?: boolean; cellFormat?: "normal" | "typed" } = {}
  ): Promise<unknown> {
    if (tableId === "_grist_ACLResources") {
      return { records: [{ id: 1, fields: { tableId: "Stages", colIds: "*" } }] };
    }
    if (tableId === "_grist_ACLRules") return { records: this.rules };
    if (tableId === "_grist_Shares") return { records: [] };
    if (tableId === "_grist_DocInfo") {
      return { records: [{ id: 1, fields: { schemaVersion: 46 } }] };
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

function rule(fields: Record<string, unknown>) {
  return {
    id: 10,
    fields: {
      resource: 1,
      permissionsText: "+R",
      rulePos: 1,
      aclFormula: "user.LinkKey",
      aclFormulaParsed: JSON.stringify(["Attr", ["Name", "user"], "LinkKey"]),
      userAttributes: "",
      ...fields
    }
  };
}

test("J2-A treats valid JSON with an unsupported AST root as incomplete", async () => {
  const observation = await new AccessModelObserver(
    new FakeReader([rule({ aclFormulaParsed: JSON.stringify({ unexpected: true }) })])
  ).observe(authority);

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("acl_formula_dependency_unknown"));
  assert.equal(observation.rules[0]!.dependencyExtractionComplete, false);
  assert.deepEqual(observation.rules[0]!.dependencies.userAttributes, []);
});

test("J2-A refuses over-deep formula AST traversal instead of recursing without a bound", async () => {
  let ast: unknown = ["Name", "user"];
  for (let index = 0; index < 80; index += 1) {
    ast = ["Attr", ast, `Nested${index}`];
  }

  const observation = await new AccessModelObserver(
    new FakeReader([rule({ aclFormulaParsed: JSON.stringify(ast) })])
  ).observe(authority);

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("acl_formula_dependency_unknown"));
  assert.equal(observation.rules[0]!.dependencyExtractionComplete, false);
});

test("J2-A bounds JSON-bearing user-attribute metadata", async () => {
  const observation = await new AccessModelObserver(
    new FakeReader([rule({ aclFormula: "", aclFormulaParsed: "", userAttributes: "x".repeat(70_000) })])
  ).observe(authority);

  assert.equal(observation.completeness, "PARTIAL");
  assert.ok(observation.issues.includes("user_attribute_unknown"));
  assert.equal(observation.rules[0]!.dependencyExtractionComplete, false);
  assert.equal(observation.rules[0]!.userAttribute, null);
});
