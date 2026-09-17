import {
  createPrincipalFromVerifiedAccessToken,
  type CryptographicallyVerifiedAccessTokenClaims,
  type OAuthResourceServerPolicy
} from "./oauthAccessToken.js";
import type { OAuthPrincipalGrant } from "./oauthPrincipal.js";
import type { Principal } from "./principal.js";

export interface OAuthAccessTokenVerifier {
  verify(accessToken: string): Promise<CryptographicallyVerifiedAccessTokenClaims>;
}

export interface PrincipalContextFactory<TContext> {
  create(principal: Principal): Promise<TContext>;
}

export interface OAuthMcpRequestContext<TContext> {
  principal: Principal;
  context: TContext;
}

export class OAuthRequestAuthenticationError extends Error {
  constructor(readonly code: "missing_bearer" | "malformed_bearer") {
    super(`OAuth MCP authentication failed: ${code}`);
    this.name = "OAuthRequestAuthenticationError";
  }
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new OAuthRequestAuthenticationError("missing_bearer");
  }
  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new OAuthRequestAuthenticationError("malformed_bearer");
  }
  const token = authorizationHeader.slice("Bearer ".length);
  if (!token || token.trim() !== token || /\s/.test(token)) {
    throw new OAuthRequestAuthenticationError("malformed_bearer");
  }
  return token;
}

/**
 * Provider-neutral OAuth request boundary.
 *
 * The raw bearer is visible only to the token verifier. Once verified, only a
 * bounded Principal crosses into the Grist context factory. The verifier may be
 * implemented with any standards-compliant JOSE/JWKS implementation; Grist
 * business logic remains provider-agnostic.
 */
export async function createOAuthMcpRequestContext<TContext>(options: {
  authorizationHeader: string | undefined;
  verifier: OAuthAccessTokenVerifier;
  policy: OAuthResourceServerPolicy;
  grant: OAuthPrincipalGrant;
  contextFactory: PrincipalContextFactory<TContext>;
  nowSeconds?: number;
}): Promise<OAuthMcpRequestContext<TContext>> {
  const accessToken = extractBearerToken(options.authorizationHeader);
  const claims = await options.verifier.verify(accessToken);
  const principal = createPrincipalFromVerifiedAccessToken(
    claims,
    options.policy,
    options.grant,
    options.nowSeconds
  );
  const context = await options.contextFactory.create(principal);
  return { principal, context };
}
