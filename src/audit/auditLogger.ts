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

export class AuditLogger {
  nextRequestId(): string {
    return randomUUID();
  }

  record(event: AuditEvent): void {
    console.log(
      JSON.stringify({
        type: "grist.audit",
        timestamp: new Date().toISOString(),
        ...event
      })
    );
  }
}
