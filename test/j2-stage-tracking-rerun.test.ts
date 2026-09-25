import assert from "node:assert/strict";
import test from "node:test";

import {
  J2_STAGE_TRACKING_FIXTURE_STATES,
  J2_STAGE_TRACKING_TRANSFORMATION_ORACLE
} from "../src/j2/stageTrackingFixture.js";

test("J2-B rerun starts from an already managed structural post-state", () => {
  const rerun = J2_STAGE_TRACKING_TRANSFORMATION_ORACLE.find(
    (scenario) => scenario.id === "TRANSFORM-RERUN"
  );
  assert.ok(rerun);
  assert.equal(rerun.startingState, "managed-rerun");

  const state = J2_STAGE_TRACKING_FIXTURE_STATES[rerun.startingState];
  assert.equal(state.contactDateFieldPresent, true);
  assert.equal(rerun.expected.contactDateFieldCount, 1);
  assert.equal(rerun.expected.addedHistoricalAuthorFieldCount, 0);
  assert.equal(state.humanLayoutMarker, "fixture-human-layout-v1");
});

test("J2-B managed rerun preserves the human-modified business state", () => {
  const humanModified = J2_STAGE_TRACKING_FIXTURE_STATES["date-present-human-modified"];
  const managedRerun = J2_STAGE_TRACKING_FIXTURE_STATES["managed-rerun"];

  assert.deepEqual(managedRerun.stages, humanModified.stages);
  assert.equal(managedRerun.humanLayoutMarker, humanModified.humanLayoutMarker);
  assert.equal(humanModified.contactDateFieldPresent, true);
  assert.equal(managedRerun.contactDateFieldPresent, true);
});
