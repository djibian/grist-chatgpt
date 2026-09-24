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

function safeAuditDocumentId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Audit stores only already-normalized resource identifiers. URLs, query
  // strings and fragments may carry LinkKey-like or future secret material and
  // are deliberately omitted rather than partially redacted or guessed.
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
    const safeDocumentId = safeAuditDocumentId(documentId);
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
