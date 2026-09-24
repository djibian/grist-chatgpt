import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileExecutionJournal,
  type ExecutionPlanDefinition
} from "../src/execution/executionJournal.js";
import {
  ExecutionAuthorityGate,
  ExecutionAuthorityInvariantError,
  ExecutionAuthorityRevokedError,
  type CurrentExecutionAuthority,
  type ExecutionAuthorityProvider,
  type ExecutionAuthorityRequest
} from "../src/execution/executionAuthority.js";

function plan(): ExecutionPlanDefinition {
  return {
    identity: {
      executionId: "j1-authority-001",
      executionContractVersion: "contract-v1",
      planId: "authority-plan",
      planVersion: "plan-v1",
      applicationId: "synthetic-fixture",
      target: "doc-j1-fixture",
      principalId: "principal-j1",
      mandateVersion: "mandate-v1"
    },
    steps: [
      {
        stepId: "step-1",
        order: 1,
        operation: "create_records",
        capability: "doc:write",
        preconditions: ["fixture is ready"],
        expectedStateTokens: { fixture: "v1" },
        effectIntent: {
          intentId: "create-marker",
          fingerprint: "marker-v1"
        }
      }
    ],
    budgetLimits: {},
    criticalProperties: []
  };
}

class MutableAuthorityProvider implements ExecutionAuthorityProvider {
  requests: ExecutionAuthorityRequest[] = [];

  constructor(public authority: CurrentExecutionAuthority | null) {}

  async currentAuthority(
    request: ExecutionAuthorityRequest
  ): Promise<CurrentExecutionAuthority | null> {
    this.requests.push(structuredClone(request));
    return this.authority === null ? null : structuredClone(this.authority);
  }
}

function matchingAuthority(): CurrentExecutionAuthority {
  return {
    principalId: "principal-j1",
    mandateVersion: "mandate-v1",
    target: "doc-j1-fixture",
    capabilities: ["doc:read", "doc:write"]
  };
}

async function withJournalDirectory(
  run: (directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "grist-chatgpt-j1-authority-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("J1 authority gate derives the exact authority request from the immutable plan", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const provider = new MutableAuthorityProvider(matchingAuthority());
    const gate = new ExecutionAuthorityGate(journal, provider);

    await gate.assertCurrentAuthority("j1-authority-001", "step-1");

    assert.deepEqual(provider.requests, [
      {
        executionId: "j1-authority-001",
        executionContractVersion: "contract-v1",
        planId: "authority-plan",
        planVersion: "plan-v1",
        principalId: "principal-j1",
        mandateVersion: "mandate-v1",
        target: "doc-j1-fixture",
        stepId: "step-1",
        operation: "create_records",
        capability: "doc:write"
      }
    ]);

    const durable = await journal.load("j1-authority-001");
    assert.equal(durable?.revision, 0);
    assert.equal(durable?.steps[0]?.status, "PENDING");
  });
});

test("J1 authority gate rechecks instead of caching an earlier positive decision", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const provider = new MutableAuthorityProvider(matchingAuthority());
    const gate = new ExecutionAuthorityGate(journal, provider);

    await gate.assertCurrentAuthority("j1-authority-001", "step-1");
    provider.authority = {
      ...matchingAuthority(),
      mandateVersion: "mandate-v2"
    };

    await assert.rejects(
      () => gate.assertCurrentAuthority("j1-authority-001", "step-1"),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionAuthorityRevokedError);
        assert.equal(error.reason, "mandate");
        return true;
      }
    );
    assert.equal(provider.requests.length, 2);
  });
});

test("J1 authority gate fails closed for unavailable, wrong-principal, wrong-target and missing-capability authority", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const provider = new MutableAuthorityProvider(null);
    const gate = new ExecutionAuthorityGate(journal, provider);

    const cases: Array<{
      authority: CurrentExecutionAuthority | null;
      reason: ExecutionAuthorityRevokedError["reason"];
    }> = [
      { authority: null, reason: "unavailable" },
      {
        authority: { ...matchingAuthority(), principalId: "other-principal" },
        reason: "principal"
      },
      {
        authority: { ...matchingAuthority(), target: "other-document" },
        reason: "target"
      },
      {
        authority: { ...matchingAuthority(), capabilities: ["doc:read"] },
        reason: "capability"
      }
    ];

    for (const current of cases) {
      provider.authority = current.authority;
      await assert.rejects(
        () => gate.assertCurrentAuthority("j1-authority-001", "step-1"),
        (error: unknown) => {
          assert.ok(error instanceof ExecutionAuthorityRevokedError);
          assert.equal(error.reason, current.reason);
          return true;
        }
      );
    }

    const durable = await journal.load("j1-authority-001");
    assert.equal(durable?.revision, 0);
  });
});

test("J1 authority gate re-resolves authority after process restart", async () => {
  await withJournalDirectory(async (directory) => {
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(plan());
    const beforeRestart = new MutableAuthorityProvider(matchingAuthority());
    await new ExecutionAuthorityGate(journal, beforeRestart).assertCurrentAuthority(
      "j1-authority-001",
      "step-1"
    );

    const afterRestart = new MutableAuthorityProvider({
      ...matchingAuthority(),
      capabilities: ["doc:read"]
    });
    const restarted = new ExecutionAuthorityGate(
      new FileExecutionJournal(directory),
      afterRestart
    );

    await assert.rejects(
      () => restarted.assertCurrentAuthority("j1-authority-001", "step-1"),
      (error: unknown) => {
        assert.ok(error instanceof ExecutionAuthorityRevokedError);
        assert.equal(error.reason, "capability");
        return true;
      }
    );
    assert.equal(beforeRestart.requests.length, 1);
    assert.equal(afterRestart.requests.length, 1);
  });
});

test("J1 authority gate refuses to authorize a step without immutable effect intent", async () => {
  await withJournalDirectory(async (directory) => {
    const definition = plan();
    delete definition.steps[0]!.effectIntent;
    const journal = new FileExecutionJournal(directory);
    await journal.initialize(definition);
    const provider = new MutableAuthorityProvider(matchingAuthority());

    await assert.rejects(
      () =>
        new ExecutionAuthorityGate(journal, provider).assertCurrentAuthority(
          "j1-authority-001",
          "step-1"
        ),
      ExecutionAuthorityInvariantError
    );
    assert.equal(provider.requests.length, 0);
  });
});
