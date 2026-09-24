export type J2InitialFixtureStateId = "date-absent" | "date-present-human-modified";
export type J2FixtureStateId = J2InitialFixtureStateId | "managed-rerun";
export type J2TeacherId = "teacher-a" | "teacher-b";
export type J2StageId = "stage-a" | "stage-b";
export type J2AccessExpectation = "ALLOW" | "DENY" | "NOT_APPLICABLE";
export type J2PolicyKnowledge = "ACCEPTED" | "UNKNOWN_POLICY";

export interface J2SyntheticTeacher {
  id: J2TeacherId;
  displayName: string;
  /**
   * Logical server-side handle only. A provisioner must inject an actual synthetic
   * LinkKey value without committing or returning it through model-facing output.
   */
  linkKeyHandle: string;
}

export interface J2SyntheticStage {
  id: J2StageId;
  studentLabel: string;
  assignedTeacher: J2TeacherId;
  trace: {
    contactType: "Appel" | "Visite" | null;
    contactDate: string | null;
    implication: string | null;
    punctuality: string | null;
    comment: string | null;
    historicalAuthor: J2TeacherId | null;
  };
}

export interface J2FixtureState {
  id: J2FixtureStateId;
  contactDateFieldPresent: boolean;
  historicalAuthorBindingPresent: boolean;
  humanLayoutMarker: string | null;
  teachers: readonly J2SyntheticTeacher[];
  stages: readonly J2SyntheticStage[];
}

export interface J2BrowserExpectation {
  id: "BROW-A" | "BROW-B" | "BROW-C" | "BROW-D" | "BROW-E" | "BROW-F" | "BROW-G";
  propertyIds: readonly string[];
  actingContext: string;
  expected: {
    protectedRead: J2AccessExpectation;
    protectedWrite: J2AccessExpectation;
    assignmentWrite: J2AccessExpectation;
    traceRemainsOnSameStage: boolean;
    currentAssignmentAfter?: J2TeacherId;
    historicalAuthorAfter?: J2TeacherId;
    contactDateReachable?: boolean;
    postReassignmentAccess?: Readonly<Record<J2TeacherId, {
      protectedRead: J2AccessExpectation;
      protectedWrite: J2AccessExpectation;
    }>>;
  };
  /**
   * UNKNOWN_POLICY is reserved for a scenario with an accepted outcome whose
   * authorization/attribution policy is deliberately unresolved.
   */
  policyKnowledge: J2PolicyKnowledge;
  notes: string;
}

export interface J2TransformationExpectation {
  id: "TRANSFORM-DATE-ABSENT" | "TRANSFORM-DATE-PRESENT" | "TRANSFORM-RERUN";
  startingState: J2FixtureStateId;
  propertyIds: readonly string[];
  expected: {
    contactDateFieldCount: 1;
    historicalAuthorBindingCount: 1;
    preserveBusinessRows: true;
    preserveUntargetedSchema: true;
    preserveHumanLayout: boolean;
    inventLegacyAuthors: false;
    duplicateStageOrTrace: false;
  };
}

const teachers = Object.freeze([
  Object.freeze({
    id: "teacher-a" as const,
    displayName: "Enseignant A (synthétique)",
    linkKeyHandle: "fixture:teacher-a-link-key"
  }),
  Object.freeze({
    id: "teacher-b" as const,
    displayName: "Enseignant B (synthétique)",
    linkKeyHandle: "fixture:teacher-b-link-key"
  })
]);

const dateAbsentStages = Object.freeze([
  Object.freeze({
    id: "stage-a" as const,
    studentLabel: "Élève Alpha (synthétique)",
    assignedTeacher: "teacher-a" as const,
    trace: Object.freeze({
      contactType: "Appel" as const,
      contactDate: null,
      implication: "Satisfaisante",
      punctuality: "Oui",
      comment: "Trace synthétique A",
      historicalAuthor: null
    })
  }),
  Object.freeze({
    id: "stage-b" as const,
    studentLabel: "Élève Bêta (synthétique)",
    assignedTeacher: "teacher-b" as const,
    trace: Object.freeze({
      contactType: null,
      contactDate: null,
      implication: null,
      punctuality: null,
      comment: null,
      historicalAuthor: null
    })
  })
]);

const datePresentStages = Object.freeze([
  Object.freeze({
    id: "stage-a" as const,
    studentLabel: "Élève Alpha (synthétique)",
    assignedTeacher: "teacher-a" as const,
    trace: Object.freeze({
      contactType: "Visite" as const,
      contactDate: "2026-09-15",
      implication: "Très satisfaisante",
      punctuality: "Oui",
      comment: "Modification humaine synthétique à préserver",
      historicalAuthor: null
    })
  }),
  Object.freeze({
    id: "stage-b" as const,
    studentLabel: "Élève Bêta (synthétique)",
    assignedTeacher: "teacher-b" as const,
    trace: Object.freeze({
      contactType: null,
      contactDate: null,
      implication: null,
      punctuality: null,
      comment: null,
      historicalAuthor: null
    })
  })
]);

export const J2_STAGE_TRACKING_FIXTURE_STATES: Readonly<Record<J2FixtureStateId, J2FixtureState>> =
  Object.freeze({
    "date-absent": Object.freeze({
      id: "date-absent" as const,
      contactDateFieldPresent: false,
      historicalAuthorBindingPresent: false,
      humanLayoutMarker: null,
      teachers,
      stages: dateAbsentStages
    }),
    "date-present-human-modified": Object.freeze({
      id: "date-present-human-modified" as const,
      contactDateFieldPresent: true,
      historicalAuthorBindingPresent: false,
      humanLayoutMarker: "fixture-human-layout-v1",
      teachers,
      stages: datePresentStages
    }),
    "managed-rerun": Object.freeze({
      id: "managed-rerun" as const,
      contactDateFieldPresent: true,
      historicalAuthorBindingPresent: true,
      humanLayoutMarker: "fixture-human-layout-v1",
      teachers,
      stages: datePresentStages
    })
  });

/**
 * Independent business oracle. These outcomes come from the accepted
 * BehavioralContract, never from observed ACL rules or browser behavior.
 */
export const J2_STAGE_TRACKING_BROWSER_ORACLE: readonly J2BrowserExpectation[] = Object.freeze([
  Object.freeze({
    id: "BROW-A" as const,
    propertyIds: Object.freeze(["STAGE-B1", "STAGE-B2", "STAGE-A1", "STAGE-A4"]),
    actingContext: "teacher-a-valid-link-on-stage-a",
    expected: Object.freeze({
      protectedRead: "ALLOW" as const,
      protectedWrite: "ALLOW" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "A may enter/correct/clear the protected trace but contact editing must not reassign the Stage."
  }),
  Object.freeze({
    id: "BROW-B" as const,
    propertyIds: Object.freeze(["STAGE-B3", "STAGE-A1", "STAGE-A4"]),
    actingContext: "teacher-b-valid-link-on-stage-a-assigned-to-a",
    expected: Object.freeze({
      protectedRead: "DENY" as const,
      protectedWrite: "DENY" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "B must not read or edit A's protected Stage through any reachable teacher page or Raw Data."
  }),
  Object.freeze({
    id: "BROW-C" as const,
    propertyIds: Object.freeze(["STAGE-B4", "STAGE-A4"]),
    actingContext: "missing-or-invalid-link-key",
    expected: Object.freeze({
      protectedRead: "DENY" as const,
      protectedWrite: "DENY" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "Missing or invalid LinkKey exposes no protected follow-up data."
  }),
  Object.freeze({
    id: "BROW-D" as const,
    propertyIds: Object.freeze(["STAGE-B5", "STAGE-A4"]),
    actingContext: "revoked-teacher-a-link-key",
    expected: Object.freeze({
      protectedRead: "DENY" as const,
      protectedWrite: "DENY" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "A revoked synthetic key cannot retain protected access granted before revocation."
  }),
  Object.freeze({
    id: "BROW-E" as const,
    propertyIds: Object.freeze(["STAGE-B6"]),
    actingContext: "teacher-b-attempts-self-assignment-to-stage-a",
    expected: Object.freeze({
      protectedRead: "DENY" as const,
      protectedWrite: "DENY" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "Relation tampering must not broaden access; this is distinct from an authorized reassignment."
  }),
  Object.freeze({
    id: "BROW-F" as const,
    propertyIds: Object.freeze(["STAGE-B10", "STAGE-A1", "STAGE-A4"]),
    actingContext: "separate-authorized-reassignment-after-teacher-a-contact",
    expected: Object.freeze({
      protectedRead: "NOT_APPLICABLE" as const,
      protectedWrite: "NOT_APPLICABLE" as const,
      assignmentWrite: "ALLOW" as const,
      traceRemainsOnSameStage: true,
      currentAssignmentAfter: "teacher-b" as const,
      historicalAuthorAfter: "teacher-a" as const,
      postReassignmentAccess: Object.freeze({
        "teacher-a": Object.freeze({
          protectedRead: "DENY" as const,
          protectedWrite: "DENY" as const
        }),
        "teacher-b": Object.freeze({
          protectedRead: "ALLOW" as const,
          protectedWrite: "ALLOW" as const
        })
      })
    }),
    policyKnowledge: "UNKNOWN_POLICY" as const,
    notes: "The reassignment outcome is accepted, but the exact actor authorized to perform it is intentionally unresolved. B's later edit-attribution policy is also unresolved."
  }),
  Object.freeze({
    id: "BROW-G" as const,
    propertyIds: Object.freeze(["STAGE-U1", "STAGE-B2"]),
    actingContext: "teacher-a-valid-link-on-follow-up-page",
    expected: Object.freeze({
      protectedRead: "ALLOW" as const,
      protectedWrite: "ALLOW" as const,
      assignmentWrite: "DENY" as const,
      traceRemainsOnSameStage: true,
      contactDateReachable: true
    }),
    policyKnowledge: "ACCEPTED" as const,
    notes: "The contact date is reachable and editable in the intended teacher-facing flow where A is responsible."
  })
]);

export const J2_STAGE_TRACKING_TRANSFORMATION_ORACLE: readonly J2TransformationExpectation[] =
  Object.freeze([
    Object.freeze({
      id: "TRANSFORM-DATE-ABSENT" as const,
      startingState: "date-absent" as const,
      propertyIds: Object.freeze(["STAGE-B7", "STAGE-B8", "STAGE-H1", "STAGE-H2"]),
      expected: Object.freeze({
        contactDateFieldCount: 1 as const,
        historicalAuthorBindingCount: 1 as const,
        preserveBusinessRows: true as const,
        preserveUntargetedSchema: true as const,
        preserveHumanLayout: true,
        inventLegacyAuthors: false as const,
        duplicateStageOrTrace: false as const
      })
    }),
    Object.freeze({
      id: "TRANSFORM-DATE-PRESENT" as const,
      startingState: "date-present-human-modified" as const,
      propertyIds: Object.freeze(["STAGE-B7", "STAGE-U2", "STAGE-H1", "STAGE-H2", "STAGE-H3"]),
      expected: Object.freeze({
        contactDateFieldCount: 1 as const,
        historicalAuthorBindingCount: 1 as const,
        preserveBusinessRows: true as const,
        preserveUntargetedSchema: true as const,
        preserveHumanLayout: true,
        inventLegacyAuthors: false as const,
        duplicateStageOrTrace: false as const
      })
    }),
    Object.freeze({
      id: "TRANSFORM-RERUN" as const,
      startingState: "managed-rerun" as const,
      propertyIds: Object.freeze(["STAGE-B8", "STAGE-U3"]),
      expected: Object.freeze({
        contactDateFieldCount: 1 as const,
        historicalAuthorBindingCount: 1 as const,
        preserveBusinessRows: true as const,
        preserveUntargetedSchema: true as const,
        preserveHumanLayout: true,
        inventLegacyAuthors: false as const,
        duplicateStageOrTrace: false as const
      })
    })
  ]);

export const J2_STAGE_TRACKING_UNRESOLVED_POLICIES = Object.freeze({
  reassignmentAuthority: "UNKNOWN_POLICY" as const,
  replacementByNewTeacherChangesHistoricalAuthor: "UNKNOWN_POLICY" as const
});

export const J2_STAGE_TRACKING_REQUIRED_BINDINGS = Object.freeze([
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
