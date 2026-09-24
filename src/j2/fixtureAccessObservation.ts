import { createHash } from "node:crypto";

import {
  AccessModelObserver,
  type AccessModelObservation
} from "../grist/accessModelObserver.js";
import type {
  GristDocumentSummary,
  GristOrgSummary,
  GristWorkspaceSummary
} from "../grist/client.js";

const FIXTURE_NAME = "J2-stage-tracking-fixture";
const FIXTURE_WORKSPACE = "ChatGPT";
const MAX_METADATA_RECORDS = 2_000;
const METADATA_TABLES = new Set([
  "_grist_ACLResources",
  "_grist_ACLRules",
  "_grist_Shares",
  "_grist_DocInfo"
]);

export interface J2FixtureObservationClient {
  listOrgs(): Promise<GristOrgSummary[]>;
  listWorkspaces(orgId: string | number): Promise<GristWorkspaceSummary[]>;
  queryRecords(
    documentId: string,
    tableId: string,
    options?: { limit?: number; hidden?: boolean }
  ): Promise<unknown>;
}

export interface J2FixtureAccessEvidence {
  target: typeof FIXTURE_NAME;
  targetIdSha256: string;
  observedAt: string;
  observation: Omit<AccessModelObservation, "documentId" | "principalId" | "mandateId">;
}

function assertFixtureId(documentId: string): void {
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(documentId)) {
    throw new Error("J2 fixture target must be one bounded Grist document ID, not a URL.");
  }
}

function isFixtureOwner(
  document: GristDocumentSummary,
  workspace: GristWorkspaceSummary,
  documentId: string
): boolean {
  return (
    String(document.id) === documentId &&
    document.name === FIXTURE_NAME &&
    document.access === "owners" &&
    workspace.name === FIXTURE_WORKSPACE
  );
}

/** Read-only operational entry point. The caller injects an owner-credential Grist client. */
export async function observeJ2FixtureAccess(
  client: J2FixtureObservationClient,
  documentId: string
): Promise<J2FixtureAccessEvidence> {
  assertFixtureId(documentId);

  let matches = 0;
  for (const org of await client.listOrgs()) {
    for (const workspace of await client.listWorkspaces(org.id)) {
      for (const document of workspace.docs ?? []) {
        if (isFixtureOwner(document, workspace, documentId)) matches += 1;
      }
    }
  }
  if (matches !== 1) {
    throw new Error("Owner-accessible J2 disposable fixture identity could not be established.");
  }

  const reader = {
    maxReadRecords: MAX_METADATA_RECORDS,
    queryRecords(
      requestedDocumentId: string,
      tableId: string,
      options?: { limit?: number; hidden?: boolean }
    ): Promise<unknown> {
      const limit = options?.limit;
      if (
        requestedDocumentId !== documentId ||
        !METADATA_TABLES.has(tableId) ||
        options?.hidden !== true ||
        typeof limit !== "number" ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > MAX_METADATA_RECORDS
      ) {
        throw new Error("J2 observation exceeded its fixture and metadata read boundary.");
      }
      return client.queryRecords(documentId, tableId, {
        limit,
        hidden: true
      });
    }
  };
  const observation = await new AccessModelObserver(reader).observe({
    documentId,
    principalId: "fixture-owner",
    mandateId: "j2-a-fixture-observation",
    ownerAuthorized: true
  });
  const { documentId: _id, principalId: _principal, mandateId: _mandate, ...bounded } = observation;

  return {
    target: FIXTURE_NAME,
    targetIdSha256: createHash("sha256").update(documentId).digest("hex"),
    observedAt: new Date().toISOString(),
    observation: bounded
  };
}
