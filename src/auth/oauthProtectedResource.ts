export const OAUTH_PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource";

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
}

function quoteChallengeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildOAuthProtectedResourceMetadata(options: {
  resource: string;
  authorizationServer: string;
  scopes: readonly string[];
}): OAuthProtectedResourceMetadata {
  return {
    resource: options.resource,
    authorization_servers: [options.authorizationServer],
    scopes_supported: [...options.scopes]
  };
}

export function buildOAuthProtectedResourceMetadataUrl(
  publicBaseUrl: string
): string {
  return new URL(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, `${publicBaseUrl}/`).toString();
}

export function buildBearerChallenge(
  resourceMetadataUrl: string,
  error?: "invalid_token"
): string {
  const parameters = [
    `resource_metadata="${quoteChallengeValue(resourceMetadataUrl)}"`
  ];
  if (error) parameters.push(`error="${error}"`);
  return `Bearer ${parameters.join(", ")}`;
}

export function buildInsufficientScopeToolChallenge(
  resourceMetadataUrl: string,
  requiredScope: string
): string {
  const description = `Additional authorization is required for scope ${requiredScope}.`;
  return [
    "Bearer",
    `resource_metadata="${quoteChallengeValue(resourceMetadataUrl)}",`,
    'error="insufficient_scope",',
    `error_description="${quoteChallengeValue(description)}",`,
    `scope="${quoteChallengeValue(requiredScope)}"`
  ].join(" ");
}
