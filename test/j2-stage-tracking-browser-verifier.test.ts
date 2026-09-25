import assert from "node:assert/strict";
import test from "node:test";

import {
  J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION,
  J2StageTrackingControlledBrowserVerifier,
  type J2BrowserSessionKind,
  type J2BrowserStageObservation,
  type J2ControlledBrowserSession,
  type J2ControlledBrowserSessionFactory,
  type J2ObservedAccess,
  type J2TraceMutation
} from "../src/j2/stageTrackingBrowserVerifier.js";
import type { J2StageId, J2TeacherId } from "../src/j2/stageTrackingFixture.js";

class FakeSession implements J2ControlledBrowserSession {
  public closed = false;

  constructor(
    private readonly kind: J2BrowserSessionKind,
    private readonly overrides: { rawDataRead?: J2ObservedAccess } = {}
  ) {}

  async observeStage(_stageId: J2StageId): Promise<J2BrowserStageObservation> {
    const allowed = this.kind === "teacher-a";
    return {
      protectedRead: allowed ? "ALLOW" : "DENY",
      stageIdentity: allowed ? "stage-a" : null,
      currentAssignment: allowed ? "teacher-a" : null,
      contactDateReachable: allowed ? true : null
    };
  }

  async writeTrace(_stageId: J2StageId, _mutation: J2TraceMutation): Promise<J2ObservedAccess> {
    return this.kind === "teacher-a" ? "ALLOW" : "DENY";
  }

  async attemptAssignmentChange(
    _stageId: J2StageId,
    _teacherId: J2TeacherId
  ): Promise<J2ObservedAccess> {
    return "DENY";
  }

  async observeRawData(_stageId: J2StageId): Promise<J2ObservedAccess> {
    if (this.overrides.rawDataRead !== undefined) return this.overrides.rawDataRead;
    return this.kind === "teacher-a" ? "ALLOW" : "DENY";
  }

  async observeAlternateView(_stageId: J2StageId): Promise<J2ObservedAccess> {
    return this.kind === "teacher-a" ? "ALLOW" : "DENY";
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeFactory implements J2ControlledBrowserSessionFactory {
  public readonly sessions: FakeSession[] = [];

  constructor(private readonly overrides: { teacherBRawDataRead?: J2ObservedAccess } = {}) {}

  async open(kind: J2BrowserSessionKind): Promise<J2ControlledBrowserSession> {
    const sessionOverrides =
      kind === "teacher-b" && this.overrides.teacherBRawDataRead !== undefined
        ? { rawDataRead: this.overrides.teacherBRawDataRead }
        : {};
    const session = new FakeSession(kind, sessionOverrides);
    this.sessions.push(session);
    return session;
  }
}

const context = Object.freeze({
  fixtureId: "fixture-j2-stage-tracking",
  fixtureRevision: "fixture-rev-2026-09-25",
  gristVersion: "1.7.3",
  contractVersion: J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION
});

test("J2-C verifier executes the fixed browser oracle and emits contextualized verified evidence", async () => {
  const factory = new FakeFactory();
  const verifier = new J2StageTrackingControlledBrowserVerifier(() => 1_790_331_200_000);

  const report = await verifier.verify(factory, context);

  assert.equal(report.verdict, "VERIFIED");
  assert.deepEqual(
    report.evidence.map((item) => item.scenarioId),
    ["BROW-A", "BROW-B", "BROW-C", "BROW-D", "BROW-E", "BROW-F", "BROW-G"]
  );
  assert.ok(report.evidence.every((item) => item.verdict === "VERIFIED"));
  assert.ok(report.evidence.every((item) => item.completeness === "COMPLETE"));
  assert.ok(report.evidence.every((item) => item.method === "CONTROLLED_BROWSER"));
  assert.ok(report.evidence.every((item) => item.checkedAt === 1_790_331_200_000));
  assert.ok(
    report.evidence.every(
      (item) => item.contractVersion === J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION
    )
  );
  assert.ok(report.evidence.every((item) => item.actingContext.length > 0));
  assert.ok(
    report.evidence.every(
      (item) =>
        item.propertyCriticality.length === item.propertyIds.length &&
        item.propertyCriticality.every(
          (property, index) => property.propertyId === item.propertyIds[index]
        )
    )
  );
  assert.ok(
    report.evidence.every(
      (item) =>
        item.evidenceInputs.includes("J2_STAGE_TRACKING_BROWSER_ORACLE") &&
        item.evidenceInputs.some((input) => input.startsWith("controlled-browser:"))
    )
  );
  assert.ok(factory.sessions.length >= 8, "missing and invalid keys must be separate sessions");
  assert.ok(factory.sessions.every((session) => session.closed));

  const browB = report.evidence.find((item) => item.scenarioId === "BROW-B");
  assert.ok(browB);
  assert.equal(browB.observed.protectedRead, "DENY");
  assert.equal(browB.observed.traceRemainsOnSameStage, true);
  assert.ok(browB.evidenceInputs.includes("raw-data-negative-control"));
  assert.ok(browB.evidenceInputs.includes("alternate-view-negative-control"));

  const browG = report.evidence.find((item) => item.scenarioId === "BROW-G");
  assert.ok(browG);
  assert.deepEqual(browG.propertyCriticality, [
    { propertyId: "STAGE-U1", criticality: "IMPORTANT" },
    { propertyId: "STAGE-B2", criticality: "CRITICAL" }
  ]);
});

test("J2-C negative controls fail when Raw Data exposes a protected Stage", async () => {
  const verifier = new J2StageTrackingControlledBrowserVerifier(() => 1);
  const report = await verifier.verify(new FakeFactory({ teacherBRawDataRead: "ALLOW" }), context);

  const browB = report.evidence.find((item) => item.scenarioId === "BROW-B");
  assert.ok(browB);
  assert.equal(browB.verdict, "VIOLATED");
  assert.equal(browB.observed.rawDataRead, "ALLOW");
  assert.equal(report.verdict, "VIOLATED");
});

test("J2-C browser failures remain UNKNOWN and do not echo secret error material", async () => {
  const factory: J2ControlledBrowserSessionFactory = {
    async open(kind) {
      if (kind === "invalid-key") {
        throw new Error("https://fixture.invalid/?LinkKey_Token=DO-NOT-ECHO");
      }
      return new FakeSession(kind);
    }
  };
  const verifier = new J2StageTrackingControlledBrowserVerifier(() => 2);

  const report = await verifier.verify(factory, context);
  const browC = report.evidence.find((item) => item.scenarioId === "BROW-C");

  assert.ok(browC);
  assert.equal(browC.verdict, "UNKNOWN");
  assert.equal(browC.completeness, "PARTIAL");
  assert.equal(report.verdict, "UNKNOWN");
  assert.equal(JSON.stringify(report).includes("DO-NOT-ECHO"), false);
  assert.equal(JSON.stringify(report).includes("LinkKey_Token"), false);
});

test("J2-C rejects unbounded context markers before opening any browser session", async () => {
  const factory = new FakeFactory();
  const verifier = new J2StageTrackingControlledBrowserVerifier();

  await assert.rejects(
    verifier.verify(factory, { ...context, fixtureId: "https://example.invalid/doc/secret" }),
    /bounded identifier/
  );
  assert.equal(factory.sessions.length, 0);
});

test("J2-C refuses evidence labeled with any contract version other than the accepted oracle version", async () => {
  const factory = new FakeFactory();
  const verifier = new J2StageTrackingControlledBrowserVerifier();

  await assert.rejects(
    verifier.verify(factory, { ...context, contractVersion: "caller-selected-version" as never }),
    /accepted stage-tracking contract/
  );
  assert.equal(factory.sessions.length, 0);
});
