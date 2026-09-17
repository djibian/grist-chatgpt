import {
  createOAuthMcpPrincipal,
  type OAuthPrincipalGrant,
  type VerifiedOAuthIdentity
} from "./oauthPrincipal.js";
import type { Principal } from "./principal.js";

export interface CryptographicallyVerifiedAccessTokenClaims {
  issuer: string;
  subject: string;
  audience: string | readonly string[];
  expiresAt: number;
  scope?: string;
}

export interface OAuthResourceServerPolicy {
  issuer: string;
  audience: string;
}

export class OAuthAccessTokenError extends Error {
  constructor(
    readonly code:
      | "wrong_issuer"
      | "wrong_audience"
      | "expired_token"
      | "invalid_expiry"
  ) {
    super(`Rejected OAuth access token claims: ${code}`);
    this.name = "OAuthAccessTokenError";
  }
}

function audienceContains(
  audience: string | readonly string[],
  expected: string
): boolean {
  return typeof audience === "string"
    ? audience === expected
    : audience.includes(expected);
}

/**
 * Enforce resource-server claims after signature/JWKS verification.
 *
 * The caller is responsible for cryptographically verifying the JWT first.
 * This function then applies the bridge's provider-neutral issuer, resource
 * audience, expiry and scope-to-principal boundary.
 */
export function validateVerifiedAccessTokenClaims(
  claims: CryptographicallyVerifiedAccessTokenClaims,
  policy: OAuthResourceServerPolicy,
  nowSeconds = Math.floor(Date.now() / 1000)
): VerifiedOAuthIdentity {
  if (claims.issuer !== policy.issuer) {
    throw new OAuthAccessTokenError("wrong_issuer");
  }
  if (!audienceContains(claims.audience, policy.audience)) {
    throw new OAuthAccessTokenError("wrong_audience");
  }
  if (!Number.isFinite(claims.expiresAt)) {
    throw new OAuthAccessTokenError("invalid_expiry");
  }
  if (claims.expiresAt <= nowSeconds) {
    throw new OAuthAccessTokenError("expired_token");
  }

  return {
    issuer: claims.issuer,
    subject: claims.subject,
    ...(claims.scope === undefined ? {} : { scope: claims.scope })
  };
}

export function createPrincipalFromVerifiedAccessToken(
  claims: CryptographicallyVerifiedAccessTokenClaims,
  policy: OAuthResourceServerPolicy,
  grant: OAuthPrincipalGrant,
  nowSeconds?: number
): Principal {
  return createOAuthMcpPrincipal(
    validateVerifiedAccessTokenClaims(claims, policy, nowSeconds),
    grant
  );
}
