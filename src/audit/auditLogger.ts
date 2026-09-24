import { randomUUID } from "node:crypto";

import type { GristCapability, Principal } from "../auth/principal.js";

export interface AuditEvent {
  requestId: string;
  principal: string;
  transport: Principal["transport"];
  operation: string;
  capability: GristCapability;
  documentId?: string;
  itemCount?: number;
  status: "success" | "error";
  durationMs: number;
  errorType?: string;
}

function safeAuditDocumentId(
  value: string | undefined,
  status: AuditEvent["status"]
): string | undefined {
  if (value === undefined) return undefined;

  // AuthorizedGristService currently cannot attach proof that an error target
  // was resolved before the failure. Fail closed for every error event rather
  // than inferring trust from the input's string shape. Successful operations
  // have necessarily crossed authorization/resource resolution first.
  if (status === "error") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Keep the sink defensive even for success events: URLs, query strings and
  // fragments may carry LinkKey-like or future secret material and are omitted
  // rather than partially redacted or guessed.
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("?") || trimmed.includes("#")) {
    return undefined;
  }
  return trimmed;
}

export class AuditLogger {
  nextRequestId(): string {
    return randomUUID();
  }

  record(event: AuditEvent): void {
    const { documentId, ...rest } = event;
    const safeDocumentId = safeAuditDocumentId(documentId, event.status);
    console.log(
      JSON.stringify({
        type: "grist.audit",
        timestamp: new Date().toISOString(),
        ...rest,
        ...(safeDocumentId !== undefined ? { documentId: safeDocumentId } : {})
      })
    );
  }
}
