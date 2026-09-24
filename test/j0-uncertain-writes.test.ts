import assert from "node:assert/strict";
import test from "node:test";

import type { AccessPolicy } from "../src/grist/accessPolicy.js";
import {
  GristApiError,
  GristClient,
  GristTransportError,
  type NewGristRecord
} from "../src/grist/client.js";
import {
  GristService,
  PartialBatchError,
  UncertainWriteError
} from "../src/grist/service.js";
import { errorResult } from "../src/mcp/results.js";

function serviceWithCreate(
  createRecords: (records: NewGristRecord[]) => Promise<unknown>,
  writeBatchRecords = 2
): GristService {
  const client = {
    createRecords: async (
      _documentId: string,
      _tableId: string,
      records: NewGristRecord[]
    ) => createRecords(records)
  } as unknown as GristClient;
  const accessPolicy = {
    assertDocumentAllowed: async (documentId: string) => documentId,
    listAllowedDocuments: async () => []
  } as unknown as AccessPolicy;

  return new GristService(client, accessPolicy, {
    maxReadRecords: 1000,
    maxWriteRecords: 100,
    writeBatchRecords,
    maxSchemaItems: 100
  });
}

function mcpBody(error: unknown): Record<string, unknown> {
  const result = errorResult(error);
  const content = result.content[0];
  assert.equal(content?.type, "text");
  return JSON.parse(content.text) as Record<string, unknown>;
}

test("J0 T0: first ambiguous batch is uncertain rather than a generic failure", async () => {
  const grist = serviceWithCreate(async () => {
    throw new GristTransportError("response lost after possible dispatch", "UNCERTAIN");
  });

  await assert.rejects(
    () =>
      grist.createRecords("doc", "Table1", [
        { fields: { n: 1 } },
        { fields: { n: 2 } },
        { fields: { n: 3 } }
      ]),
    (error: unknown) => {
      assert.ok(error instanceof UncertainWriteError);
      assert.equal(error.operation, "createRecords");
      assert.equal(error.completedBatches, 0);
      assert.equal(error.completedItems, 0);
      assert.equal(error.uncertainBatch, 1);
      assert.equal(error.uncertainItems, 2);
      assert.equal(error.remainingBatches, 1);
      assert.equal(error.remainingItems, 1);
      assert.deepEqual(error.confirmedResults, []);

      const body = mcpBody(error);
      assert.equal(body.code, "uncertain_write");
      assert.equal(body.effectState, "UNCERTAIN");
      assert.equal(body.retryWholeOperation, false);
      assert.deepEqual(body.confirmedEffects, []);
      return true;
    }
  );
});

test("J0 T1: confirmed created IDs survive a later uncertain batch", async () => {
  let calls = 0;
  const grist = serviceWithCreate(async () => {
    calls += 1;
    if (calls === 1) {
      return { records: [{ id: 701 }, { id: 702 }] };
    }
    throw new GristTransportError("response lost after possible dispatch", "UNCERTAIN");
  });

  await assert.rejects(
    () =>
      grist.createRecords("doc", "Table1", [
        { fields: { n: 1 } },
        { fields: { n: 2 } },
        { fields: { n: 3 } },
        { fields: { n: 4 } },
        { fields: { n: 5 } }
      ]),
    (error: unknown) => {
      assert.ok(error instanceof UncertainWriteError);
      assert.equal(error.completedBatches, 1);
      assert.equal(error.completedItems, 2);
      assert.equal(error.uncertainBatch, 2);
      assert.equal(error.uncertainItems, 2);
      assert.equal(error.remainingBatches, 1);
      assert.equal(error.remainingItems, 1);
      assert.deepEqual(error.confirmedResults, [
        { records: [{ id: 701 }, { id: 702 }] }
      ]);

      const body = mcpBody(error);
      assert.equal(body.code, "uncertain_write");
      assert.deepEqual(body.confirmedEffects, [
        { records: [{ id: 701 }, { id: 702 }] }
      ]);
      assert.equal(body.uncertainBatch, 2);
      assert.equal(body.remainingBatches, 1);
      assert.equal(body.retryWholeOperation, false);
      return true;
    }
  );
});

test("definite later batch failure keeps confirmed effects in partial_write", async () => {
  let calls = 0;
  const grist = serviceWithCreate(async () => {
    calls += 1;
    if (calls === 1) {
      return { records: [{ id: 801 }, { id: 802 }] };
    }
    throw new Error("local simulated failure");
  });

  await assert.rejects(
    () =>
      grist.createRecords("doc", "Table1", [
        { fields: { n: 1 } },
        { fields: { n: 2 } },
        { fields: { n: 3 } }
      ]),
    (error: unknown) => {
      assert.ok(error instanceof PartialBatchError);
      assert.deepEqual(error.confirmedResults, [
        { records: [{ id: 801 }, { id: 802 }] }
      ]);
      const body = mcpBody(error);
      assert.equal(body.code, "partial_write");
      assert.equal(body.effectState, "PARTIALLY_APPLIED");
      assert.deepEqual(body.confirmedEffects, [
        { records: [{ id: 801 }, { id: 802 }] }
      ]);
      assert.equal(body.retryWholeOperation, false);
      return true;
    }
  );
});

test("Grist client classifies a mutating transport failure as uncertain", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("socket reset");
  }) as typeof fetch;

  try {
    const grist = new GristClient({
      baseUrl: "https://grist.example.org",
      apiKey: "test-api-key"
    });
    await assert.rejects(
      () => grist.createRecords("doc", "Table1", [{ fields: { n: 1 } }]),
      (error: unknown) => {
        assert.ok(error instanceof GristTransportError);
        assert.equal(error.effectKnowledge, "UNCERTAIN");
        assert.equal(mcpBody(error).code, "uncertain_write");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Grist client keeps read transport failures non-mutating", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("socket reset");
  }) as typeof fetch;

  try {
    const grist = new GristClient({
      baseUrl: "https://grist.example.org",
      apiKey: "test-api-key"
    });
    await assert.rejects(
      () => grist.listTables("doc"),
      (error: unknown) => {
        assert.ok(error instanceof GristTransportError);
        assert.equal(error.effectKnowledge, "NOT_APPLIED");
        assert.equal(mcpBody(error).code, "grist_upstream");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mutating 5xx responses are conservatively classified as uncertain", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "server failure" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    })) as typeof fetch;

  try {
    const grist = new GristClient({
      baseUrl: "https://grist.example.org",
      apiKey: "test-api-key"
    });
    await assert.rejects(
      () => grist.createRecords("doc", "Table1", [{ fields: { n: 1 } }]),
      (error: unknown) => {
        assert.ok(error instanceof GristApiError);
        assert.equal(error.status, 503);
        assert.equal(error.effectKnowledge, "UNCERTAIN");
        assert.equal(mcpBody(error).code, "uncertain_write");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mutating HTTP errors stay uncertain until endpoint semantics prove no effect", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    })) as typeof fetch;

  try {
    const grist = new GristClient({
      baseUrl: "https://grist.example.org",
      apiKey: "test-api-key"
    });
    await assert.rejects(
      () => grist.createRecords("doc", "Table1", [{ fields: { n: 1 } }]),
      (error: unknown) => {
        assert.ok(error instanceof GristApiError);
        assert.equal(error.status, 400);
        assert.equal(error.effectKnowledge, "UNCERTAIN");
        assert.equal(mcpBody(error).code, "uncertain_write");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
