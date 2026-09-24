import assert from "node:assert/strict";
import test from "node:test";

import { AuditLogger } from "../src/audit/auditLogger.js";
import type { AuthorizationService } from "../src/auth/authorizationService.js";
import type { Principal } from "../src/auth/principal.js";
import { AuthorizedGristService } from "../src/grist/authorizedService.js";
import type { GristService } from "../src/grist/service.js";
import type { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function serviceRejectingAuthorization(audit: AuditLogger): AuthorizedGristService {
  const authorization = {
    assertDocumentAllowed: async () => {
      throw new Error("document rejected by policy");
    }
  } as unknown as AuthorizationService;
  const principal: Principal = {
    id: "principal-t3",
    transport: "mcp",
    grants: []
  };

  return new AuthorizedGristService(
    {} as GristService,
    authorization,
    audit,
    principal,
    {} as GristUiActionsAdapter
  );
}

test("J0 T3: rejected resource URL never reaches audit output verbatim", async () => {
  const audit = new AuditLogger();
  const service = serviceRejectingAuthorization(audit);
  const marker = "SYNTHETIC-T3-LINK-KEY";
  const resource = `https://grist.example.org/doc/example?LinkKey=${marker}`;
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    await assert.rejects(
      () => service.listTables(resource),
      /document rejected by policy/
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.includes(marker), false);
  assert.equal(lines[0]!.includes(resource), false);

  const event = JSON.parse(lines[0]!) as Record<string, unknown>;
  assert.equal(event.type, "grist.audit");
  assert.equal(event.status, "error");
  assert.equal(event.operation, "list_tables");
  assert.equal("documentId" in event, false);
});

test("audit keeps normalized non-URL document IDs", () => {
  const audit = new AuditLogger();
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    audit.record({
      requestId: "req-1",
      principal: "principal-1",
      transport: "mcp",
      operation: "query_records",
      capability: "doc:read",
      documentId: "doc-safe-123",
      status: "success",
      durationMs: 1
    });
  } finally {
    console.log = originalLog;
  }

  const event = JSON.parse(lines[0]!) as Record<string, unknown>;
  assert.equal(event.documentId, "doc-safe-123");
});
