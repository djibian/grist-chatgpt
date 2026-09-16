import { GristApiError } from "../grist/client.js";
import { PartialBatchError } from "../grist/service.js";
import { UiWriteVerificationError } from "../grist/uiActionsAdapter.js";

export type McpErrorCode =
  | "partial_write"
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

  if (error instanceof PartialBatchError) {
    body = {
      code: "partial_write",
      error: "Partial Grist operation",
      operation: error.operation,
      completedBatches: error.completedBatches,
      completedItems: error.completedItems,
      failedBatch: error.failedBatch,
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
  } else if (error instanceof GristApiError) {
    body = {
      code: "grist_upstream",
      error: error.message,
      status: error.status
    };
  } else {
    body = {
      code: "operation_failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(body)
      }
    ],
    structuredContent: body
  };
}
