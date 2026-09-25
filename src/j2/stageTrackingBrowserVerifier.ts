import {
  J2_STAGE_TRACKING_BROWSER_ORACLE,
  type J2AccessExpectation,
  type J2BrowserExpectation,
  type J2StageId,
  type J2TeacherId
} from "./stageTrackingFixture.js";

export const J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION = "j2-stage-tracking-accepted-v1" as const;

export type J2ObservedAccess = J2AccessExpectation | "UNKNOWN";
export type J2BrowserVerificationVerdict = "VERIFIED" | "VIOLATED" | "UNKNOWN";
export type J2BrowserSessionKind =
  | "teacher-a"
  | "teacher-b"
  | "missing-key"
  | "invalid-key"
  | "revoked-key";
export type J2TraceMutation = "ENTER" | "CORRECT" | "CLEAR" | "CONTACT_DATE";
export type J2PropertyCriticality = "CRITICAL" | "IMPORTANT" | "INFORMATIONAL";
export type J2MutationApplication = "APPLIED" | "NOT_APPLIED" | "UNKNOWN";

/** APPLIED / NOT_APPLIED require a checked, persisted fixture postcondition. */
export interface J2BrowserMutationObservation {
  access: J2ObservedAccess;
  application: J2MutationApplication;
}

export interface J2BrowserStageObservation {
  protectedRead: J2ObservedAccess;
  stageIdentity: J2StageId | null;
  currentAssignment: J2TeacherId | null;
  contactDateReachable: boolean | null;
}

/**
 * Deliberately narrow browser port. Concrete adapters may drive a real browser,
 * but callers cannot provide URLs, JavaScript, selectors, arbitrary commands or
 * credentials through this interface.
 *
 * Mutations must separately report the observed access decision and a checked,
 * persisted application postcondition. A button or response alone is not proof
 * that ENTER/CORRECT/CLEAR/CONTACT_DATE took effect, or that a denial left the
 * Stage unchanged. Any unverifiable postcondition is UNKNOWN.
 */
export interface J2ControlledBrowserSession {
  observeStage(stageId: J2StageId): Promise<J2BrowserStageObservation>;
  writeTrace(stageId: J2StageId, mutation: J2TraceMutation): Promise<J2BrowserMutationObservation>;
  attemptAssignmentChange(stageId: J2StageId, teacherId: J2TeacherId): Promise<J2BrowserMutationObservation>;
  observeRawData(stageId: J2StageId): Promise<J2ObservedAccess>;
  observeAlternateView(stageId: J2StageId): Promise<J2ObservedAccess>;
  close(): Promise<void>;
}

export interface J2ControlledBrowserSessionFactory {
  open(kind: J2BrowserSessionKind): Promise<J2ControlledBrowserSession>;
  /**
   * Test-only, owner-authorized effect on the configured isolated fixture.
   * teacher-a before revocation and revoked-key after revocation MUST use the
   * same server-held synthetic key. APPLIED means the exact revocation
   * postcondition was checked; uncertain effects remain UNKNOWN, never retried
   * blindly. The verifier runs this last so A's positive tests stay valid.
   */
  revokeTeacherALinkKey(): Promise<"APPLIED" | "UNKNOWN">;
}

export interface J2BrowserVerificationContext {
  fixtureId: string;
  fixtureRevision: string;
  gristVersion: string;
  contractVersion: typeof J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION;
}

export interface J2BrowserObservedOutcome {
  protectedRead: J2ObservedAccess;
  protectedWrite: J2ObservedAccess;
  assignmentWrite: J2ObservedAccess;
  traceRemainsOnSameStage: boolean | null;
  currentAssignmentAfter?: J2TeacherId | null;
  contactDateReachable?: boolean | null;
  otherTeacherReadAfter?: J2ObservedAccess;
  otherTeacherWriteAfter?: J2ObservedAccess;
  alternateViewRead?: J2ObservedAccess;
  rawDataRead?: J2ObservedAccess;
  preRevocationRead?: J2ObservedAccess;
  revocationApplied?: boolean | null;
}

export interface J2PropertyCriticalityEvidence {
  propertyId: string;
  criticality: J2PropertyCriticality;
}

export interface J2BrowserScenarioEvidence {
  scenarioId: J2BrowserExpectation["id"];
  propertyIds: readonly string[];
  propertyCriticality: readonly J2PropertyCriticalityEvidence[];
  actingContext: J2BrowserExpectation["actingContext"];
  evidenceInputs: readonly string[];
  verdict: J2BrowserVerificationVerdict;
  expected: J2BrowserExpectation["expected"];
  observed: J2BrowserObservedOutcome;
  method: "CONTROLLED_BROWSER" | "NOT_EXECUTED";
  completeness: "COMPLETE" | "PARTIAL";
  reasonCodes: readonly string[];
  fixtureId: string;
  fixtureRevision: string;
  gristVersion: string;
  contractVersion: typeof J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION;
  checkedAt: number;
}

export interface J2BrowserVerificationReport {
  verdict: J2BrowserVerificationVerdict;
  evidence: readonly J2BrowserScenarioEvidence[];
}

const FIXTURE_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const REVISION_PATTERN = /^[A-Za-z0-9._:-]{4,128}$/;
const VERSION_PATTERN = /^[A-Za-z0-9._+:-]{1,64}$/;

const PROPERTY_CRITICALITY: Readonly<Record<string, J2PropertyCriticality>> = Object.freeze({
  "STAGE-B1": "CRITICAL",
  "STAGE-B2": "CRITICAL",
  "STAGE-B3": "CRITICAL",
  "STAGE-B4": "CRITICAL",
  "STAGE-B5": "CRITICAL",
  "STAGE-B6": "CRITICAL",
  "STAGE-B10": "CRITICAL",
  "STAGE-A1": "CRITICAL",
  "STAGE-A4": "CRITICAL",
  "STAGE-U1": "CRITICAL"
});

function validateContext(context: J2BrowserVerificationContext): void {
  if (!FIXTURE_ID_PATTERN.test(context.fixtureId)) {
    throw new Error("J2 browser fixture identity must be one bounded identifier.");
  }
  if (!REVISION_PATTERN.test(context.fixtureRevision)) {
    throw new Error("J2 browser fixture revision must be a bounded opaque marker.");
  }
  if (!VERSION_PATTERN.test(context.gristVersion)) {
    throw new Error("J2 browser Grist version must be a bounded version marker.");
  }
  if (context.contractVersion !== J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION) {
    throw new Error("J2 browser contract version must match the accepted stage-tracking contract.");
  }
}

function criticalityFor(scenario: J2BrowserExpectation): readonly J2PropertyCriticalityEvidence[] {
  return Object.freeze(
    scenario.propertyIds.map((propertyId) => {
      const criticality = PROPERTY_CRITICALITY[propertyId];
      if (!criticality) {
        throw new Error(`J2 browser property ${propertyId} is missing accepted criticality metadata.`);
      }
      return Object.freeze({ propertyId, criticality });
    })
  );
}

function evidenceInputsFor(scenario: J2BrowserExpectation): readonly string[] {
  const inputs = [
    "J2_STAGE_TRACKING_BROWSER_ORACLE",
    "configured-fixture-identity-and-revision",
    "target-grist-version",
    `controlled-browser:${scenario.actingContext}`
  ];

  if (["BROW-B", "BROW-C", "BROW-D"].includes(scenario.id)) {
    inputs.push("alternate-view-negative-control", "raw-data-negative-control");
  }
  if (scenario.id === "BROW-C") {
    inputs.push("separate-missing-key-session", "separate-invalid-key-session");
  }
  if (scenario.id === "BROW-D") {
    inputs.push("same-key-positive-precondition", "bounded-revocation-postcondition");
  }
  if (scenario.id === "BROW-F") {
    inputs.push("separate-teacher-b-postcondition-session");
  }

  return Object.freeze(inputs);
}

function aggregateAccess(
  values: readonly J2ObservedAccess[],
  expected: J2AccessExpectation
): J2ObservedAccess {
  const mismatch: J2AccessExpectation = expected === "ALLOW" ? "DENY" : "ALLOW";
  if (values.some((value) => value === mismatch)) return mismatch;
  if (values.some((value) => value === "UNKNOWN")) return "UNKNOWN";
  return expected;
}

function mutationAccess(
  observed: J2BrowserMutationObservation,
  expected: J2AccessExpectation
): J2ObservedAccess {
  if (expected === "ALLOW") {
    if (observed.access === "DENY" || observed.application === "NOT_APPLIED") return "DENY";
    if (observed.access === "UNKNOWN" || observed.application === "UNKNOWN") return "UNKNOWN";
    return "ALLOW";
  }
  if (observed.access === "ALLOW" || observed.application === "APPLIED") return "ALLOW";
  if (observed.access === "UNKNOWN" || observed.application === "UNKNOWN") return "UNKNOWN";
  return "DENY";
}

function aggregateBoolean(values: readonly (boolean | null | undefined)[]): boolean | null {
  if (values.some((value) => value === false)) return false;
  if (values.every((value) => value === true)) return true;
  return null;
}

function sameStage(before: J2BrowserStageObservation, after: J2BrowserStageObservation): boolean | null {
  if (!before.stageIdentity || !after.stageIdentity) return null;
  return before.stageIdentity === "stage-a" && after.stageIdentity === "stage-a";
}

function deniedMutationsPreserveStage(
  protectedWrite: J2ObservedAccess,
  assignmentWrite: J2ObservedAccess
): boolean | null {
  if (protectedWrite === "UNKNOWN" || assignmentWrite === "UNKNOWN") return null;
  return protectedWrite === "DENY" && assignmentWrite === "DENY";
}

function emptyUnknownOutcome(): J2BrowserObservedOutcome {
  return {
    protectedRead: "UNKNOWN",
    protectedWrite: "UNKNOWN",
    assignmentWrite: "UNKNOWN",
    traceRemainsOnSameStage: null
  };
}

async function closeQuietly(session: J2ControlledBrowserSession | undefined): Promise<boolean> {
  if (!session) return true;
  try {
    await session.close();
    return true;
  } catch {
    return false;
  }
}

async function openAndRun<T>(
  factory: J2ControlledBrowserSessionFactory,
  kind: J2BrowserSessionKind,
  run: (session: J2ControlledBrowserSession) => Promise<T>
): Promise<{ value?: T; complete: boolean }> {
  let session: J2ControlledBrowserSession | undefined;
  try {
    session = await factory.open(kind);
    const value = await run(session);
    const closed = await closeQuietly(session);
    return { value, complete: closed };
  } catch {
    await closeQuietly(session);
    return { complete: false };
  }
}

function accessMatches(observed: J2ObservedAccess, expected: J2AccessExpectation): boolean | null {
  if (observed === "UNKNOWN") return null;
  return observed === expected;
}

function boolMatches(observed: boolean | null | undefined, expected: boolean): boolean | null {
  if (observed === null || observed === undefined) return null;
  return observed === expected;
}

function teacherMatches(
  observed: J2TeacherId | null | undefined,
  expected: J2TeacherId | undefined
): boolean | null {
  if (expected === undefined) return true;
  if (observed === null || observed === undefined) return null;
  return observed === expected;
}

function assess(
  scenario: J2BrowserExpectation,
  observed: J2BrowserObservedOutcome,
  executionComplete: boolean
): { verdict: J2BrowserVerificationVerdict; completeness: "COMPLETE" | "PARTIAL"; reasonCodes: string[] } {
  const comparisons: Array<boolean | null> = [
    accessMatches(observed.protectedRead, scenario.expected.protectedRead),
    accessMatches(observed.protectedWrite, scenario.expected.protectedWrite),
    accessMatches(observed.assignmentWrite, scenario.expected.assignmentWrite),
    boolMatches(observed.traceRemainsOnSameStage, scenario.expected.traceRemainsOnSameStage),
    teacherMatches(observed.currentAssignmentAfter, scenario.expected.currentAssignmentAfter)
  ];

  if (scenario.expected.contactDateReachable !== undefined) {
    comparisons.push(boolMatches(observed.contactDateReachable, scenario.expected.contactDateReachable));
  }
  if (scenario.expected.otherTeacherReadAfter !== undefined) {
    comparisons.push(
      accessMatches(observed.otherTeacherReadAfter ?? "UNKNOWN", scenario.expected.otherTeacherReadAfter)
    );
  }
  if (scenario.expected.otherTeacherWriteAfter !== undefined) {
    comparisons.push(
      accessMatches(observed.otherTeacherWriteAfter ?? "UNKNOWN", scenario.expected.otherTeacherWriteAfter)
    );
  }

  if (["BROW-B", "BROW-C", "BROW-D"].includes(scenario.id)) {
    comparisons.push(accessMatches(observed.alternateViewRead ?? "UNKNOWN", "DENY"));
    comparisons.push(accessMatches(observed.rawDataRead ?? "UNKNOWN", "DENY"));
  }
  if (scenario.id === "BROW-D") {
    comparisons.push(accessMatches(observed.preRevocationRead ?? "UNKNOWN", "ALLOW"));
    comparisons.push(boolMatches(observed.revocationApplied, true));
  }

  if (comparisons.some((result) => result === false)) {
    return {
      verdict: "VIOLATED",
      completeness: executionComplete ? "COMPLETE" : "PARTIAL",
      reasonCodes: ["OBSERVED_OUTCOME_MISMATCH"]
    };
  }

  if (!executionComplete || comparisons.some((result) => result === null)) {
    return {
      verdict: "UNKNOWN",
      completeness: "PARTIAL",
      reasonCodes: ["INCOMPLETE_BROWSER_EVIDENCE"]
    };
  }

  return { verdict: "VERIFIED", completeness: "COMPLETE", reasonCodes: [] };
}

async function runNegativeSession(
  factory: J2ControlledBrowserSessionFactory,
  kind: J2BrowserSessionKind
): Promise<{ outcome: J2BrowserObservedOutcome; complete: boolean }> {
  const result = await openAndRun(factory, kind, async (session) => {
    const protectedStage = await session.observeStage("stage-a");
    const write = mutationAccess(await session.writeTrace("stage-a", "ENTER"), "DENY");
    const assignment = mutationAccess(
      await session.attemptAssignmentChange("stage-a", "teacher-b"),
      "DENY"
    );
    const alternate = await session.observeAlternateView("stage-a");
    const raw = await session.observeRawData("stage-a");
    return {
      protectedRead: aggregateAccess([protectedStage.protectedRead, alternate, raw], "DENY"),
      protectedWrite: write,
      assignmentWrite: assignment,
      traceRemainsOnSameStage: deniedMutationsPreserveStage(write, assignment),
      alternateViewRead: alternate,
      rawDataRead: raw
    } satisfies J2BrowserObservedOutcome;
  });

  return { outcome: result.value ?? emptyUnknownOutcome(), complete: result.complete && !!result.value };
}

async function runRevocationScenario(
  factory: J2ControlledBrowserSessionFactory
): Promise<{ outcome: J2BrowserObservedOutcome; complete: boolean }> {
  const before = await openAndRun(factory, "teacher-a", (session) => session.observeStage("stage-a"));
  if (
    !before.complete ||
    before.value?.protectedRead !== "ALLOW" ||
    before.value.stageIdentity !== "stage-a"
  ) {
    return { outcome: emptyUnknownOutcome(), complete: false };
  }

  let revoked: "APPLIED" | "UNKNOWN" = "UNKNOWN";
  try {
    revoked = await factory.revokeTeacherALinkKey();
  } catch {
    // An uncertain fixture effect must not be replayed to manufacture proof.
  }
  if (revoked !== "APPLIED") return { outcome: emptyUnknownOutcome(), complete: false };

  const after = await runNegativeSession(factory, "revoked-key");
  return {
    complete: after.complete,
    outcome: { ...after.outcome, preRevocationRead: "ALLOW", revocationApplied: true }
  };
}

async function runScenario(
  scenario: J2BrowserExpectation,
  factory: J2ControlledBrowserSessionFactory
): Promise<{ outcome: J2BrowserObservedOutcome; complete: boolean }> {
  if (scenario.id === "BROW-B" || scenario.id === "BROW-E") {
    return runNegativeSession(factory, "teacher-b");
  }
  if (scenario.id === "BROW-D") return runRevocationScenario(factory);

  if (scenario.id === "BROW-C") {
    const missing = await runNegativeSession(factory, "missing-key");
    const invalid = await runNegativeSession(factory, "invalid-key");
    return {
      complete: missing.complete && invalid.complete,
      outcome: {
        protectedRead: aggregateAccess(
          [missing.outcome.protectedRead, invalid.outcome.protectedRead],
          "DENY"
        ),
        protectedWrite: aggregateAccess(
          [missing.outcome.protectedWrite, invalid.outcome.protectedWrite],
          "DENY"
        ),
        assignmentWrite: aggregateAccess(
          [missing.outcome.assignmentWrite, invalid.outcome.assignmentWrite],
          "DENY"
        ),
        traceRemainsOnSameStage: aggregateBoolean([
          missing.outcome.traceRemainsOnSameStage,
          invalid.outcome.traceRemainsOnSameStage
        ]),
        alternateViewRead: aggregateAccess(
          [
            missing.outcome.alternateViewRead ?? "UNKNOWN",
            invalid.outcome.alternateViewRead ?? "UNKNOWN"
          ],
          "DENY"
        ),
        rawDataRead: aggregateAccess(
          [missing.outcome.rawDataRead ?? "UNKNOWN", invalid.outcome.rawDataRead ?? "UNKNOWN"],
          "DENY"
        )
      }
    };
  }

  if (scenario.id === "BROW-F") {
    const primary = await openAndRun(factory, "teacher-a", async (session) => {
      const before = await session.observeStage("stage-a");
      const enter = mutationAccess(await session.writeTrace("stage-a", "ENTER"), "ALLOW");
      const correct = mutationAccess(await session.writeTrace("stage-a", "CORRECT"), "ALLOW");
      const clear = mutationAccess(await session.writeTrace("stage-a", "CLEAR"), "ALLOW");
      const assignmentWrite = mutationAccess(
        await session.attemptAssignmentChange("stage-a", "teacher-b"),
        "DENY"
      );
      const after = await session.observeStage("stage-a");
      return {
        before,
        after,
        protectedWrite: aggregateAccess([enter, correct, clear], "ALLOW"),
        assignmentWrite
      };
    });
    const other = await openAndRun(factory, "teacher-b", async (session) => ({
      observation: await session.observeStage("stage-a"),
      write: mutationAccess(await session.writeTrace("stage-a", "ENTER"), "DENY")
    }));

    if (!primary.value || !other.value) {
      return { outcome: emptyUnknownOutcome(), complete: false };
    }
    return {
      complete: primary.complete && other.complete,
      outcome: {
        protectedRead: primary.value.before.protectedRead,
        protectedWrite: primary.value.protectedWrite,
        assignmentWrite: primary.value.assignmentWrite,
        traceRemainsOnSameStage: sameStage(primary.value.before, primary.value.after),
        currentAssignmentAfter: primary.value.after.currentAssignment,
        otherTeacherReadAfter: other.value.observation.protectedRead,
        otherTeacherWriteAfter: other.value.write
      }
    };
  }

  const result = await openAndRun(factory, "teacher-a", async (session) => {
    const before = await session.observeStage("stage-a");
    const mutation: J2TraceMutation = scenario.id === "BROW-G" ? "CONTACT_DATE" : "ENTER";
    const write = mutationAccess(await session.writeTrace("stage-a", mutation), "ALLOW");
    const assignmentWrite = mutationAccess(
      await session.attemptAssignmentChange("stage-a", "teacher-b"),
      "DENY"
    );
    const after = await session.observeStage("stage-a");
    return { before, after, write, assignmentWrite };
  });

  if (!result.value) return { outcome: emptyUnknownOutcome(), complete: false };
  return {
    complete: result.complete,
    outcome: {
      protectedRead: result.value.before.protectedRead,
      protectedWrite: result.value.write,
      assignmentWrite: result.value.assignmentWrite,
      traceRemainsOnSameStage: sameStage(result.value.before, result.value.after),
      currentAssignmentAfter: result.value.after.currentAssignment,
      contactDateReachable: result.value.before.contactDateReachable
    }
  };
}

export class J2StageTrackingControlledBrowserVerifier {
  constructor(private readonly now: () => number = Date.now) {}

  async verify(
    factory: J2ControlledBrowserSessionFactory,
    context: J2BrowserVerificationContext
  ): Promise<J2BrowserVerificationReport> {
    validateContext(context);
    const evidence: J2BrowserScenarioEvidence[] = [];

    // Revocation changes the synthetic A link. Run it after every A-positive
    // scenario, then return evidence in the independent oracle's fixed order.
    const executionOrder = [
      ...J2_STAGE_TRACKING_BROWSER_ORACLE.filter((scenario) => scenario.id !== "BROW-D"),
      ...J2_STAGE_TRACKING_BROWSER_ORACLE.filter((scenario) => scenario.id === "BROW-D")
    ];
    let suspended = false;
    for (const scenario of executionOrder) {
      const executed = suspended
        ? { outcome: emptyUnknownOutcome(), complete: false }
        : await runScenario(scenario, factory);
      const assessment = suspended
        ? {
            verdict: "UNKNOWN" as const,
            completeness: "PARTIAL" as const,
            reasonCodes: ["PRIOR_SCENARIO_NOT_VERIFIED"]
          }
        : assess(scenario, executed.outcome, executed.complete);
      if (assessment.verdict !== "VERIFIED") suspended = true;
      evidence.push({
        scenarioId: scenario.id,
        propertyIds: scenario.propertyIds,
        propertyCriticality: criticalityFor(scenario),
        actingContext: scenario.actingContext,
        evidenceInputs: suspended && assessment.reasonCodes.includes("PRIOR_SCENARIO_NOT_VERIFIED")
          ? ["prior-scenario-not-verified"]
          : evidenceInputsFor(scenario),
        verdict: assessment.verdict,
        expected: scenario.expected,
        observed: executed.outcome,
        method: assessment.reasonCodes.includes("PRIOR_SCENARIO_NOT_VERIFIED")
          ? "NOT_EXECUTED"
          : "CONTROLLED_BROWSER",
        completeness: assessment.completeness,
        reasonCodes: assessment.reasonCodes,
        fixtureId: context.fixtureId,
        fixtureRevision: context.fixtureRevision,
        gristVersion: context.gristVersion,
        contractVersion: J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION,
        checkedAt: this.now()
      });
    }

    const orderedEvidence = J2_STAGE_TRACKING_BROWSER_ORACLE.map((scenario) =>
      evidence.find((item) => item.scenarioId === scenario.id)!
    );
    const verdict: J2BrowserVerificationVerdict = orderedEvidence.some((item) => item.verdict === "VIOLATED")
      ? "VIOLATED"
      : orderedEvidence.every((item) => item.verdict === "VERIFIED")
        ? "VERIFIED"
        : "UNKNOWN";

    return { verdict, evidence: orderedEvidence };
  }
}
