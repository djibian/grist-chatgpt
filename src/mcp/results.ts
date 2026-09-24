import {
  GristApiError,
  GristTransportError,
  isUncertainGristEffect
} from "../grist/client.js";
import { PartialBatchError, UncertainWriteError } from "../grist/service.js";
import { UiWriteVerificationError } from "../grist/uiActionsAdapter.js";

export type McpErrorCode =
  | "partial_write"
  | "uncertain_write"
  | "write_verification_failed"
  | "grist_upstream"
  | "operation_failed";

type McpErrorBody = Record<string, unknown> & {
  code: McpErrorCode;
  error: string;
};

export function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function structuredResult<T extends Record<string, unknown>>(value: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}

export function errorResult(error: unknown) {
  let body: McpErrorBody;

  if (error instanceof UncertainWriteError) {
    body = {
      code: "uncertain_write",
      error: "Uncertain Grist write outcome",
      operation: error.operation,
      effectState: "UNCERTAIN",
      completedBatches: error.completedBatches,
      completedItems: error.completedItems,
      uncertainBatch: error.uncertainBatch,
      uncertainItems: error.uncertainItems,
      confirmedEffects: error.confirmedResults,
      remainingBatches: error.remainingBatches,
      remainingItems: error.remainingItems,
      retryWholeOperation: false
    };
  } else if (error instanceof PartialBatchError) {
    body = {
      code: "partial_write",
      error: "Partial Grist operation",
      operation: error.operation,
      effectState: "PARTIALLY_APPLIED",
      completedBatches: error.completedBatches,
      completedItems: error.completedItems,
      confirmedEffects: error.confirmedResults,
      failedBatch: error.failedBatch,
      failedItems: error.failedItems,
      remainingBatches: error.remainingBatches,
      remainingItems: error.remainingItems,
      retryWholeOperation: false
    };
  } else if (error instanceof UiWriteVerificationError) {
    body = {
      code: "write_verification_failed",
      error: "Grist UI write verification failed",
      operation: error.operation,
      ...(error.createdId !== undefined ? { createdId: error.createdId } : {}),
      retryWholeOperation: false
    };
  } else if (isUncertainGristEffect(error)) {
    body = {
      code: "uncertain_write",
      error: "Uncertain Grist write outcome",
      effectState: "UNCERTAIN",
      retryWholeOperation: false
    };
  } else if (error instanceof GristApiError) {
    body = {
      code: "grist_upstream",
      error: error.message,
      status: error.status
    };
  } else if (error instanceof GristTransportError) {
    body = {
      code: "grist_upstream",
      error: error.message
    };
  } else {
    body = {
      code: "operation_failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Keep typed errors in text content only. Some MCP clients validate any
  // structuredContent against a tool's success outputSchema even when isError
  // is true, which can turn a useful tool error into a protocol-level failure.
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(body)
      }
    ]
  };
}
