import assert from "node:assert/strict";
import test from "node:test";

import { GristApiError } from "../src/grist/client.js";
import { PartialBatchError } from "../src/grist/service.js";
import { UiWriteVerificationError } from "../src/grist/uiActionsAdapter.js";
import { errorResult } from "../src/mcp/results.js";

function body(result: ReturnType<typeof errorResult>): Record<string, unknown> {
  const content = result.content[0];
  assert.equal(content?.type, "text");
  return JSON.parse(content.text) as Record<string, unknown>;
}

function assertNoStructuredErrorContent(result: ReturnType<typeof errorResult>): void {
  assert.equal("structuredContent" in result, false);
}

test("partial writes preserve completed work and forbid whole-operation retry", () => {
  const result = errorResult(
    new PartialBatchError("deleteColumns", 2, 4, 3, new Error("upstream failure"))
  );
  const parsed = body(result);

  assert.equal(parsed.code, "partial_write");
  assert.equal(parsed.operation, "deleteColumns");
  assert.equal(parsed.completedBatches, 2);
  assert.equal(parsed.completedItems, 4);
  assert.equal(parsed.failedBatch, 3);
  assert.equal(parsed.retryWholeOperation, false);
  assertNoStructuredErrorContent(result);
});

test("ambiguous UI writes preserve retryWholeOperation false and a created ID when known", () => {
  const result = errorResult(
    new UiWriteVerificationError("create_page", 17, "verification failed")
  );
  const parsed = body(result);

  assert.equal(parsed.code, "write_verification_failed");
  assert.equal(parsed.operation, "create_page");
  assert.equal(parsed.createdId, 17);
  assert.equal(parsed.retryWholeOperation, false);
  assertNoStructuredErrorContent(result);
});

test("upstream errors expose a stable category and status without leaking response bodies", () => {
  const secretBody = "upstream body that must stay server-side";
  const result = errorResult(
    new GristApiError("Grist API request failed with HTTP 500", 500, secretBody)
  );
  const parsed = body(result);

  assert.equal(parsed.code, "grist_upstream");
  assert.equal(parsed.status, 500);
  assert.equal(JSON.stringify(result).includes(secretBody), false);
  assertNoStructuredErrorContent(result);
});

test("other failures use the generic typed category", () => {
  const result = errorResult(new Error("invalid request"));
  const parsed = body(result);
  assert.equal(parsed.code, "operation_failed");
  assert.equal(parsed.error, "invalid request");
  assertNoStructuredErrorContent(result);
});
