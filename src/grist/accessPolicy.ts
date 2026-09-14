import {
  type GristClient,
  type GristDocumentSummary,
  type GristOrgSummary,
  type GristWorkspaceSummary
} from "./client.js";

export interface AllowedDocument {
  org: GristOrgSummary;
  workspace: GristWorkspaceSummary;
  document: GristDocumentSummary;
}

export interface AccessPolicyOptions {
  allowedDocumentIds: readonly string[];
  allowedWorkspaceIds: readonly string[];
  cacheTtlMs?: number;
}

function documentCandidates(document: GristDocumentSummary): string[] {
  const values = [String(document.id)];
  if (document.urlId) values.push(document.urlId);
  return values;
}

export class AccessPolicy {
  private readonly allowedDocumentIds: ReadonlySet<string>;
  private readonly allowedWorkspaceIds: ReadonlySet<string>;
  private readonly cacheTtlMs: number;
  private cachedDocuments: AllowedDocument[] | null = null;
  private cacheExpiresAt = 0;

  constructor(
    private readonly client: GristClient,
    options: AccessPolicyOptions
  ) {
    this.allowedDocumentIds = new Set(options.allowedDocumentIds);
    this.allowedWorkspaceIds = new Set(options.allowedWorkspaceIds.map(String));
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;

    if (this.allowedDocumentIds.size === 0 && this.allowedWorkspaceIds.size === 0) {
      throw new Error("At least one document or workspace must be allowed.");
    }
  }

  async listAllowedDocuments(): Promise<AllowedDocument[]> {
    const all = await this.discoverDocuments();
    return all.filter(({ workspace, document }) => {
      if (this.allowedWorkspaceIds.has(String(workspace.id))) return true;
      return documentCandidates(document).some((id) =>
        this.allowedDocumentIds.has(id)
      );
    });
  }

  async assertDocumentAllowed(documentIdOrUrl: string): Promise<string> {
    const documentId = this.client.normalizeDocumentId(documentIdOrUrl);
    if (this.allowedDocumentIds.has(documentId)) return documentId;

    const allowed = await this.listAllowedDocuments();
    const match = allowed.some(({ document }) =>
      documentCandidates(document).includes(documentId)
    );

    if (!match) {
      throw new Error(
        `Grist document "${documentId}" is not allowed by this bridge.`
      );
    }
    return documentId;
  }

  invalidate(): void {
    this.cachedDocuments = null;
    this.cacheExpiresAt = 0;
  }

  private async discoverDocuments(): Promise<AllowedDocument[]> {
    const now = Date.now();
    if (this.cachedDocuments && now < this.cacheExpiresAt) {
      return this.cachedDocuments;
    }

    const orgs = await this.client.listOrgs();
    const discovered: AllowedDocument[] = [];
    for (const org of orgs) {
      const workspaces = await this.client.listWorkspaces(org.id);
      for (const workspace of workspaces) {
        for (const document of workspace.docs ?? []) {
          discovered.push({ org, workspace, document });
        }
      }
    }

    this.cachedDocuments = discovered;
    this.cacheExpiresAt = now + this.cacheTtlMs;
    return discovered;
  }
}
