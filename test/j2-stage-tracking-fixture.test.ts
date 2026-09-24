import assert from "node:assert/strict";
import test from "node:test";

import {
  J2_STAGE_TRACKING_BROWSER_ORACLE,
  J2_STAGE_TRACKING_FIXTURE_STATES,
  J2_STAGE_TRACKING_REQUIRED_BINDINGS,
  J2_STAGE_TRACKING_TRANSFORMATION_ORACLE,
  J2_STAGE_TRACKING_UNRESOLVED_POLICIES
} from "../src/j2/stageTrackingFixture.js";

test("J2-B fixture uses two fictional teachers with distinct server-side key handles", () => {
  for (const fixture of Object.values(J2_STAGE_TRACKING_FIXTURE_STATES)) {
    assert.deepEqual(fixture.teachers.map((teacher) => teacher.id), ["teacher-a", "teacher-b"]);
    assert.equal(new Set(fixture.teachers.map((teacher) => teacher.linkKeyHandle)).size, 2);
    assert.ok(fixture.teachers.every((teacher) => teacher.displayName.includes("synthétique")));
    assert.ok(fixture.stages.every((stage) => stage.studentLabel.includes("synthétique")));
  }
});

test("J2-B keeps the two committed starting states semantically distinct", () => {
  const absent = J2_STAGE_TRACKING_FIXTURE_STATES["date-absent"];
  const present = J2_STAGE_TRACKING_FIXTURE_STATES["date-present-human-modified"];

  assert.equal(absent.contactDateFieldPresent, false);
  assert.equal(absent.historicalAuthorBindingPresent, false);
  assert.equal(absent.humanLayoutMarker, null);

  assert.equal(present.contactDateFieldPresent, true);
  assert.equal(present.historicalAuthorBindingPresent, false);
  assert.ok(present.humanLayoutMarker);
  assert.equal(present.stages[0]!.trace.contactDate, "2026-09-15");
  assert.equal(present.stages[0]!.trace.historicalAuthor, null);
});

test("J2-B browser oracle covers exactly BROW-A through BROW-G", () => {
  assert.deepEqual(
    J2_STAGE_TRACKING_BROWSER_ORACLE.map((scenario) => scenario.id),
    ["BROW-A", "BROW-B", "BROW-C", "BROW-D", "BROW-E", "BROW-F", "BROW-G"]
  );
});

test("J2-B denial controls cannot be weakened by fixture observation", () => {
  for (const id of ["BROW-B", "BROW-C", "BROW-D", "BROW-E"] as const) {
    const scenario = J2_STAGE_TRACKING_BROWSER_ORACLE.find((candidate) => candidate.id === id);
    assert.ok(scenario);
    assert.equal(scenario.expected.protectedRead, "DENY");
    assert.equal(scenario.expected.protectedWrite, "DENY");
    assert.equal(scenario.expected.assignmentWrite, "DENY");
    assert.equal(scenario.policyKnowledge, "ACCEPTED");
  }
});

test("J2-B reassignment preserves A's authorship and moves responsibility-derived access to B", () => {
  const scenario = J2_STAGE_TRACKING_BROWSER_ORACLE.find((candidate) => candidate.id === "BROW-F");
  assert.ok(scenario);

  assert.equal(scenario.expected.traceRemainsOnSameStage, true);
  assert.equal(scenario.expected.currentAssignmentAfter, "teacher-b");
  assert.equal(scenario.expected.historicalAuthorAfter, "teacher-a");
  assert.deepEqual(scenario.expected.postReassignmentAccess, {
    "teacher-a": { protectedRead: "DENY", protectedWrite: "DENY" },
    "teacher-b": { protectedRead: "ALLOW", protectedWrite: "ALLOW" }
  });
  assert.equal(scenario.policyKnowledge, "UNKNOWN_POLICY");
  assert.equal(J2_STAGE_TRACKING_UNRESOLVED_POLICIES.reassignmentAuthority, "UNKNOWN_POLICY");
  assert.equal(
    J2_STAGE_TRACKING_UNRESOLVED_POLICIES.replacementByNewTeacherChangesHistoricalAuthor,
    "UNKNOWN_POLICY"
  );
});

test("J2-B transformation oracle preserves human/business state and never invents legacy authors", () => {
  assert.deepEqual(
    J2_STAGE_TRACKING_TRANSFORMATION_ORACLE.map((scenario) => scenario.id),
    ["TRANSFORM-DATE-ABSENT", "TRANSFORM-DATE-PRESENT", "TRANSFORM-RERUN"]
  );

  for (const scenario of J2_STAGE_TRACKING_TRANSFORMATION_ORACLE) {
    assert.equal(scenario.expected.contactDateFieldCount, 1);
    assert.equal(scenario.expected.historicalAuthorBindingCount, 1);
    assert.equal(scenario.expected.preserveBusinessRows, true);
    assert.equal(scenario.expected.preserveUntargetedSchema, true);
    assert.equal(scenario.expected.preserveHumanLayout, true);
    assert.equal(scenario.expected.inventLegacyAuthors, false);
    assert.equal(scenario.expected.duplicateStageOrTrace, false);
  }
});

test("J2-B requires explicit access/UI binding before fixture parity can be claimed", () => {
  assert.deepEqual(J2_STAGE_TRACKING_REQUIRED_BINDINGS, [
    "Stage.table",
    "Stage.currentTeacherRelation",
    "Stage.followUpFields",
    "Stage.historicalContactAuthorBinding",
    "Teacher.table",
    "Teacher.linkKeyAttribute",
    "AccessModel.stageProtection",
    "UI.teacherFollowUpPage",
    "UI.teacherFollowUpWidget",
    "UI.contactDateField"
  ]);
});

test("J2-B manifest contains no concrete LinkKey/token secret values", () => {
  const serialized = JSON.stringify({
    states: J2_STAGE_TRACKING_FIXTURE_STATES,
    browser: J2_STAGE_TRACKING_BROWSER_ORACLE,
    transformations: J2_STAGE_TRACKING_TRANSFORMATION_ORACLE
  });

  assert.equal(/https?:\/\//i.test(serialized), false);
  assert.equal(/[?&](?:linkkey|token)=/i.test(serialized), false);
  assert.equal(/bearer\s+/i.test(serialized), false);
});
