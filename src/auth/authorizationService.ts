import {
  AccessPolicy,
  type AllowedDocument
} from "../grist/accessPolicy.js";
import type {
  GristCapability,
  Principal,
  ResourceGrant
} from "./principal.js";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function documentCandidates(document: AllowedDocument["document"]): string[] {
  const values = [String(document.id)];
  if (document.urlId) values.push(document.urlId);
  return values;
}

function grantMatches(
  grant: ResourceGrant,
  allowed: AllowedDocument,
  capability: GristCapability
): boolean {
  if (!grant.capabilities.includes(capability)) return false;
  if (grant.workspaceIds.map(String).includes(String(allowed.workspace.id))) return true;
  const candidates = documentCandidates(allowed.document);
  return grant.documentIds.some((id) => candidates.includes(String(id)));
}

export class AuthorizationService {
  constructor(private readonly deploymentPolicy: AccessPolicy) {}

  async listDocuments(
    principal: Principal,
    capability: GristCapability = "doc:read"
  ): Promise<AllowedDocument[]> {
    const allowed = await this.deploymentPolicy.listAllowedDocuments();
    return allowed.filter((document) =>
      principal.grants.some((grant) => grantMatches(grant, document, capability))
    );
  }

  async assertDocumentAllowed(
    principal: Principal,
    documentIdOrUrl: string,
    capability: GristCapability
  ): Promise<string> {
    const documentId = await this.deploymentPolicy.assertDocumentAllowed(documentIdOrUrl);
    const allowed = await this.listDocuments(principal, capability);
    const match = allowed.some(({ document }) =>
      documentCandidates(document).includes(documentId)
    );

    if (!match) {
      throw new AuthorizationError(
        `Principal "${principal.id}" lacks ${capability} access to Grist document "${documentId}".`
      );
    }
    return documentId;
  }
}
