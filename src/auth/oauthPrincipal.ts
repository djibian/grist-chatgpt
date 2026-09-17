import { createHash } from "node:crypto";

import {
  createPrincipal,
  GRIST_CAPABILITIES,
  type GristCapability,
  type Principal
} from "./principal.js";

export interface VerifiedOAuthIdentity {
  /** Validated authorization-server issuer. */
  issuer: string;
  /** Validated JWT/OAuth subject. */
  subject: string;
  /** OAuth scope claim after cryptographic token validation. */
  scope?: string;
}

export interface OAuthPrincipalGrant {
  documentIds: readonly string[];
  workspaceIds: readonly string[];
}

export class OAuthPrincipalError extends Error {
  constructor(
    readonly code: "invalid_issuer" | "invalid_subject" | "invalid_scope"
  ) {
    super(`Invalid verified OAuth identity: ${code}`);
    this.name = "OAuthPrincipalError";
  }
}

function requiredClaim(
  value: string,
  code: "invalid_issuer" | "invalid_subject"
): string {
  const normalized = value.trim();
  if (!normalized) throw new OAuthPrincipalError(code);
  return normalized;
}

export function capabilitiesFromOAuthScope(
  scope: string | undefined
): readonly GristCapability[] {
  if (scope === undefined || scope.trim() === "") return [];
  if (/\s{2,}/.test(scope.trim())) {
    // Repeated whitespace is legal in many tolerant OAuth implementations, but
    // accepting only the conventional single-space serialization keeps the
    // bridge contract deterministic for the POC.
    throw new OAuthPrincipalError("invalid_scope");
  }

  const granted = new Set(scope.trim().split(" ").filter(Boolean));
  return GRIST_CAPABILITIES.filter((capability) => granted.has(capability));
}

/**
 * Build a non-reversible stable bridge principal identifier from the validated
 * OAuth issuer + subject pair. Raw upstream subject identifiers therefore do
 * not need to appear in normal bridge audit logs.
 */
export function oauthPrincipalId(issuer: string, subject: string): string {
  const normalizedIssuer = requiredClaim(issuer, "invalid_issuer");
  const normalizedSubject = requiredClaim(subject, "invalid_subject");
  const digest = createHash("sha256")
    .update(normalizedIssuer, "utf8")
    .update("\0", "utf8")
    .update(normalizedSubject, "utf8")
    .digest("base64url");
  return `oauth:${digest}`;
}

/**
 * Convert already-verified OAuth identity data into the existing authorization
 * model. Cryptographic token verification must happen before this function.
 */
export function createOAuthMcpPrincipal(
  identity: VerifiedOAuthIdentity,
  grant: OAuthPrincipalGrant
): Principal {
  return createPrincipal({
    id: oauthPrincipalId(identity.issuer, identity.subject),
    transport: "mcp",
    documentIds: grant.documentIds,
    workspaceIds: grant.workspaceIds,
    capabilities: capabilitiesFromOAuthScope(identity.scope)
  });
}
