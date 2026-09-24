import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import { ExecutionLifecycle } from "../src/execution/executionLifecycle.js";
import {
  VerificationEvidenceConflictError,
  VerificationEvidenceLifecycle,
  VerificationPropertyNotFoundError,
  VerificationTransitionError
} from "../src/execution/verificationEvidenceLifecycle.js";

function plan(): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-evidence-001",
      executionContractVersion: "contract-v1",
      planId: "evidence-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: "create-marker",
        order: 1,
        operation: "create_records",
        capability: "doc:write",
        preconditions: ["marker absent"],
        expectedStateTokens: { marker: "absent" },
        effectIntent: {
          intentId: "create-marker-once",
          fingerprint: "marker-v1"
        }
      }
    ],
    budgetLimits: {},
    criticalProperties: [
      { propertyId: "marker-created-once", criticality: "CRITICAL" },
      { propertyId: "marker-visible", criticality: "IMPORTANT" }
    ]
  };
}

async function withJournalDirectory(
  run: (directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-evidence-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function recordEffect(journal: FileExecutionJournal): Promise<void> {
  await journal.initialize(plan());
  const lifecycle = new ExecutionLifecycle(journal);
  await lifecycle.prepareEffect("j1-evidence-001", "create-marker");
  await lifecycle.recordEffect("j1-evidence-001", "create-marker", {
    effectState: "APPLIED",
    confirmedEffect: { stableIds: [701], confirmedItems: 1 }
  });
}

test("J1 contextual evidence derives immutable identity and criticality and persists the step linkage", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    const now = new Date("2026-09-24T11:30:00.000Z");
    const verification = new VerificationEvidenceLifecycle(journal, { now: () => now });

    const saved = await verification.recordEvidence("j1-evidence-001", "create-marker", {
      evidenceId: "ev-marker-created-v1",
      propertyId: "marker-created-once",
      verdict: "VERIFIED",
      method: "targeted synthetic fixture read",
      targetStateToken: "fixture-v2",
      dependencies: ["step:create-marker", "target:fixture-v2"]
    });

    assert.equal(saved.revision, 3);
    assert.equal(saved.status, "RUNNING");
    assert.equal(saved.steps[0]?.status, "EFFECT_RECORDED");
    assert.deepEqual(saved.steps[0]?.verificationEvidenceIds, ["ev-marker-created-v1"]);
    assert.deepEqual(saved.verificationEvidence[0], {
      evidenceId: "ev-marker-created-v1",
      propertyId: "marker-created-once",
      criticality: "CRITICAL",
      verdict: "VERIFIED",
      executionId: "j1-evidence-001",
      planVersion: "plan-v1",
      principalId: "principal-j1",
      method: "targeted synthetic fixture read",
      timestamp: "2026-09-24T11:30:00.000Z",
      targetStateToken: "fixture-v2",
      dependencies: ["step:create-marker", "target:fixture-v2"]
    });

    const restarted = await new FileExecutionJournal(directory).load("j1-evidence-001");
    assert.deepEqual(restarted, saved);
  });
});

test("J1 contextual evidence cannot be recorded before durable effect knowledge exists", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const verification = new VerificationEvidenceLifecycle(journal);

    await assert.rejects(
      () =>
        verification.recordEvidence("j1-evidence-001", "create-marker", {
          evidenceId: "ev-too-early",
          propertyId: "marker-created-once",
          verdict: "VERIFIED",
          method: "fixture read",
          dependencies: []
        }),
      (error: unknown) => {
        assert.ok(error instanceof VerificationTransitionError);
        assert.match(error.message, /requires EFFECT_RECORDED, found PENDING/);
        return true;
      }
    );

    const durable = await journal.load("j1-evidence-001");
    assert.equal(durable?.revision, 0);
    assert.deepEqual(durable?.verificationEvidence, []);
  });
});

test("J1 contextual evidence rejects properties absent from the immutable plan", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    const verification = new VerificationEvidenceLifecycle(journal);

    await assert.rejects(
      () =>
        verification.recordEvidence("j1-evidence-001", "create-marker", {
          evidenceId: "ev-invented-property",
          propertyId: "invented-property",
          verdict: "VERIFIED",
          method: "fixture read",
          dependencies: []
        }),
      VerificationPropertyNotFoundError
    );

    const durable = await journal.load("j1-evidence-001");
    assert.equal(durable?.revision, 2);
    assert.deepEqual(durable?.verificationEvidence, []);
  });
});

test("J1 replay of the same evidence identity and context is idempotent", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    let clockReads = 0;
    const verification = new VerificationEvidenceLifecycle(journal, {
      now: () => {
        clockReads += 1;
        return new Date("2026-09-24T11:31:00.000Z");
      }
    });
    const observation = {
      evidenceId: "ev-idempotent",
      propertyId: "marker-created-once",
      verdict: "VERIFIED" as const,
      method: "fixture read",
      targetStateToken: "fixture-v2",
      dependencies: ["target:fixture-v2"]
    };

    const first = await verification.recordEvidence(
      "j1-evidence-001",
      "create-marker",
      observation
    );
    const replayed = await verification.recordEvidence(
      "j1-evidence-001",
      "create-marker",
      observation
    );

    assert.deepEqual(replayed, first);
    assert.equal(replayed.revision, 3);
    assert.equal(clockReads, 1);
    assert.equal(replayed.verificationEvidence.length, 1);
  });
});

test("J1 evidence identity cannot be reused for a different verdict or context", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    const verification = new VerificationEvidenceLifecycle(journal);

    await verification.recordEvidence("j1-evidence-001", "create-marker", {
      evidenceId: "ev-fixed-id",
      propertyId: "marker-created-once",
      verdict: "UNKNOWN",
      method: "fixture read",
      dependencies: ["target:fixture-v2"]
    });

    await assert.rejects(
      () =>
        verification.recordEvidence("j1-evidence-001", "create-marker", {
          evidenceId: "ev-fixed-id",
          propertyId: "marker-created-once",
          verdict: "VERIFIED",
          method: "fixture read",
          dependencies: ["target:fixture-v2"]
        }),
      VerificationEvidenceConflictError
    );

    const durable = await journal.load("j1-evidence-001");
    assert.equal(durable?.revision, 3);
    assert.equal(durable?.verificationEvidence[0]?.verdict, "UNKNOWN");
  });
});

test("J1 later observations append history and latestEvidence follows durable step order", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    const verification = new VerificationEvidenceLifecycle(journal);

    await verification.recordEvidence("j1-evidence-001", "create-marker", {
      evidenceId: "ev-observation-1",
      propertyId: "marker-visible",
      verdict: "UNKNOWN",
      method: "first bounded read",
      dependencies: ["target:fixture-v2"]
    });
    const saved = await verification.recordEvidence("j1-evidence-001", "create-marker", {
      evidenceId: "ev-observation-2",
      propertyId: "marker-visible",
      verdict: "VERIFIED",
      method: "second bounded read",
      dependencies: ["target:fixture-v2"]
    });

    assert.equal(saved.verificationEvidence.length, 2);
    assert.deepEqual(
      saved.verificationEvidence.map(({ evidenceId, verdict }) => ({ evidenceId, verdict })),
      [
        { evidenceId: "ev-observation-1", verdict: "UNKNOWN" },
        { evidenceId: "ev-observation-2", verdict: "VERIFIED" }
      ]
    );
    const latest = await verification.latestEvidence(
      "j1-evidence-001",
      "create-marker",
      "marker-visible"
    );
    assert.equal(latest?.evidenceId, "ev-observation-2");
    assert.equal(latest?.verdict, "VERIFIED");
  });
});

test("J1 verified evidence remains property-scoped and does not invent step or execution success", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await recordEffect(journal);
    const verification = new VerificationEvidenceLifecycle(journal);

    const saved = await verification.recordEvidence("j1-evidence-001", "create-marker", {
      evidenceId: "ev-property-only",
      propertyId: "marker-created-once",
      verdict: "VERIFIED",
      method: "fixture read",
      dependencies: []
    });

    assert.equal(saved.status, "RUNNING");
    assert.equal(saved.steps[0]?.status, "EFFECT_RECORDED");
    assert.equal(saved.verificationEvidence[0]?.verdict, "VERIFIED");
  });
});
