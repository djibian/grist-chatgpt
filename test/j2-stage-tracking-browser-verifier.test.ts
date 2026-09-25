import assert from "node:assert/strict";
import test from "node:test";

import {
  J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION,
  J2StageTrackingControlledBrowserVerifier,
  type J2BrowserSessionKind,
  type J2BrowserStageObservation,
  type J2BrowserMutationObservation,
  type J2ControlledBrowserSession,
  type J2ControlledBrowserSessionFactory,
  type J2MutationApplication,
  type J2ObservedAccess,
  type J2TraceMutation
} from "../src/j2/stageTrackingBrowserVerifier.js";
import type { J2StageId, J2TeacherId } from "../src/j2/stageTrackingFixture.js";

class FakeSession implements J2ControlledBrowserSession {
  public closed = false;

  constructor(
    private readonly kind: J2BrowserSessionKind,
    private readonly overrides: {
      rawDataRead?: J2ObservedAccess;
      traceApplication?: J2MutationApplication;
      assignmentApplication?: J2MutationApplication;
      allowed?: boolean;
    } = {}
  ) {}

  async observeStage(_stageId: J2StageId): Promise<J2BrowserStageObservation> {
    const allowed = this.overrides.allowed ?? this.kind === "teacher-a";
    return {
      protectedRead: allowed ? "ALLOW" : "DENY",
      stageIdentity: allowed ? "stage-a" : null,
      currentAssignment: allowed ? "teacher-a" : null,
      contactDateReachable: allowed ? true : null
    };
  }

  async writeTrace(_stageId: J2StageId, _mutation: J2TraceMutation): Promise<J2BrowserMutationObservation> {
    return this.kind === "teacher-a"
      ? { access: "ALLOW", application: this.overrides.traceApplication ?? "APPLIED" }
      : { access: "DENY", application: "NOT_APPLIED" };
  }

  async attemptAssignmentChange(
    _stageId: J2StageId,
    _teacherId: J2TeacherId
  ): Promise<J2BrowserMutationObservation> {
    return { access: "DENY", application: this.overrides.assignmentApplication ?? "NOT_APPLIED" };
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
  public readonly opened: J2BrowserSessionKind[] = [];
  public revocationCount = 0;
  private revoked = false;

  constructor(private readonly overrides: {
    teacherBRawDataRead?: J2ObservedAccess;
    missingRawDataRead?: J2ObservedAccess;
    invalidKeyFails?: boolean;
    traceApplication?: J2MutationApplication;
    teacherBAssignmentApplication?: J2MutationApplication;
    revocationResult?: "APPLIED" | "UNKNOWN";
    denyRevocationPrecondition?: boolean;
  } = {}) {}

  async open(kind: J2BrowserSessionKind): Promise<J2ControlledBrowserSession> {
    this.opened.push(kind);
    if (kind === "invalid-key" && this.overrides.invalidKeyFails) {
      throw new Error("Synthetic invalid-key browser failure");
    }
    if (kind === "revoked-key" && !this.revoked) {
      throw new Error("Synthetic key was never revoked");
    }
    const sessionOverrides = {
      rawDataRead: kind === "teacher-b" ? this.overrides.teacherBRawDataRead
        : kind === "missing-key" ? this.overrides.missingRawDataRead : undefined,
      traceApplication: kind === "teacher-a" ? this.overrides.traceApplication : undefined,
      assignmentApplication: kind === "teacher-b" &&
        this.opened.filter((item) => item === "teacher-b").length === 2
        ? this.overrides.teacherBAssignmentApplication : undefined,
      allowed: kind === "teacher-a" && this.overrides.denyRevocationPrecondition &&
        this.opened.filter((item) => item === "teacher-a").length === 4 ? false : undefined
    };
    const session = new FakeSession(kind, sessionOverrides);
    this.sessions.push(session);
    return session;
  }

  async revokeTeacherALinkKey(): Promise<"APPLIED" | "UNKNOWN"> {
    this.revocationCount += 1;
    if (this.overrides.revocationResult === "UNKNOWN") return "UNKNOWN";
    this.revoked = true;
    return "APPLIED";
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
  assert.equal(factory.revocationCount, 1);
  assert.equal(factory.opened.at(-1), "revoked-key", "revocation must follow A-positive scenarios");

  const browB = report.evidence.find((item) => item.scenarioId === "BROW-B");
  assert.ok(browB);
  assert.equal(browB.observed.protectedRead, "DENY");
  assert.equal(browB.observed.traceRemainsOnSameStage, true);
  assert.ok(browB.evidenceInputs.includes("raw-data-negative-control"));
  assert.ok(browB.evidenceInputs.includes("alternate-view-negative-control"));

  const browG = report.evidence.find((item) => item.scenarioId === "BROW-G");
  assert.ok(browG);
  assert.deepEqual(browG.propertyCriticality, [
    { propertyId: "STAGE-U1", criticality: "CRITICAL" },
    { propertyId: "STAGE-B2", criticality: "CRITICAL" }
  ]);
});

test("J2-C reports a definite missing-key data leak even if the invalid-key session is unavailable", async () => {
  const factory = new FakeFactory({ missingRawDataRead: "ALLOW", invalidKeyFails: true });
  const report = await new J2StageTrackingControlledBrowserVerifier().verify(factory, context);
  const browC = report.evidence.find((item) => item.scenarioId === "BROW-C");

  assert.ok(browC);
  assert.equal(browC.verdict, "VIOLATED");
  assert.equal(browC.observed.rawDataRead, "ALLOW");
  assert.equal(report.verdict, "VIOLATED");
});

test("J2-C cannot verify revocation without a proven prior grant or confirmed same-key revocation", async () => {
  const noPriorGrant = new FakeFactory({ denyRevocationPrecondition: true });
  const first = await new J2StageTrackingControlledBrowserVerifier().verify(noPriorGrant, context);
  assert.equal(first.evidence.find((item) => item.scenarioId === "BROW-D")?.verdict, "UNKNOWN");
  assert.equal(noPriorGrant.revocationCount, 0);

  const uncertainRevocation = new FakeFactory({ revocationResult: "UNKNOWN" });
  const second = await new J2StageTrackingControlledBrowserVerifier().verify(uncertainRevocation, context);
  assert.equal(second.evidence.find((item) => item.scenarioId === "BROW-D")?.verdict, "UNKNOWN");
  assert.equal(uncertainRevocation.opened.includes("revoked-key"), false);
});

test("J2-C will not certify an allowed edit without a persisted trace postcondition", async () => {
  const factory = new FakeFactory({ traceApplication: "UNKNOWN" });
  const report = await new J2StageTrackingControlledBrowserVerifier().verify(factory, context);

  for (const id of ["BROW-A", "BROW-F", "BROW-G"]) {
    assert.equal(report.evidence.find((item) => item.scenarioId === id)?.verdict, "UNKNOWN");
  }
  assert.equal(report.verdict, "UNKNOWN");
});

test("J2-C detects an applied self-assignment even if the browser reports denial", async () => {
  const factory = new FakeFactory({ teacherBAssignmentApplication: "APPLIED" });
  const report = await new J2StageTrackingControlledBrowserVerifier().verify(factory, context);

  assert.equal(report.evidence.find((item) => item.scenarioId === "BROW-E")?.verdict, "VIOLATED");
  assert.equal(report.verdict, "VIOLATED");
});

test("J2-C negative controls fail when Raw Data exposes a protected Stage", async () => {
  const verifier = new J2StageTrackingControlledBrowserVerifier(() => 1);
  const factory = new FakeFactory({ teacherBRawDataRead: "ALLOW" });
  const report = await verifier.verify(factory, context);

  const browB = report.evidence.find((item) => item.scenarioId === "BROW-B");
  assert.ok(browB);
  assert.equal(browB.verdict, "VIOLATED");
  assert.equal(browB.observed.rawDataRead, "ALLOW");
  assert.equal(report.verdict, "VIOLATED");
  assert.equal(factory.opened.includes("missing-key"), false, "later mutating scenarios must suspend");
  assert.equal(report.evidence.find((item) => item.scenarioId === "BROW-F")?.verdict, "UNKNOWN");
  assert.equal(report.evidence.find((item) => item.scenarioId === "BROW-F")?.method, "NOT_EXECUTED");
});

test("J2-C browser failures remain UNKNOWN and do not echo secret error material", async () => {
  const factory: J2ControlledBrowserSessionFactory = {
    async open(kind) {
      if (kind === "invalid-key") {
        throw new Error("https://fixture.invalid/?LinkKey_Token=DO-NOT-ECHO");
      }
      return new FakeSession(kind);
    },
    async revokeTeacherALinkKey() {
      return "APPLIED";
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
