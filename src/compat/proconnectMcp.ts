export type CompatibilityStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface CompatibilityCheck {
  id: string;
  status: CompatibilityStatus;
  summary: string;
  evidence: string;
}

export interface CompatibilityReport {
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  introspectionEndpoint?: string;
  checks: CompatibilityCheck[];
}

export interface SanitizedTokenResponse {
  httpStatus: number;
  tokenType?: string;
  expiresIn?: number;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasIdToken: boolean;
  accessTokenClaims?: {
    iss?: unknown;
    aud?: unknown;
    scope?: unknown;
    exp?: unknown;
  };
  error?: string;
  errorDescription?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function checkEndpoint(
  metadata: Record<string, unknown>,
  field: string,
  id: string,
  label: string
): CompatibilityCheck {
  const endpoint = optionalString(metadata[field]);
  return endpoint
    ? {
        id,
        status: "PASS",
        summary: `${label} is advertised.`,
        evidence: endpoint
      }
    : {
        id,
        status: "FAIL",
        summary: `${label} is not advertised.`,
        evidence: `Missing ${field}`
      };
}

/**
 * Evaluate only facts that can be learned from OAuth/OIDC discovery metadata.
 * RFC 8707 resource-parameter acceptance and token audience binding require an
 * actual authorization/token flow and deliberately remain UNKNOWN here.
 */
export function evaluateProConnectDiscovery(metadata: unknown): CompatibilityReport {
  if (!isRecord(metadata)) {
    throw new Error("Discovery metadata must be a JSON object.");
  }

  const issuer = optionalString(metadata.issuer);
  const authorizationEndpoint = optionalString(metadata.authorization_endpoint);
  const tokenEndpoint = optionalString(metadata.token_endpoint);
  const introspectionEndpoint = optionalString(metadata.introspection_endpoint);
  const pkceMethods = stringArray(metadata.code_challenge_methods_supported);
  const scopes = stringArray(metadata.scopes_supported);
  const grants = stringArray(metadata.grant_types_supported);
  const responseTypes = stringArray(metadata.response_types_supported);

  const checks: CompatibilityCheck[] = [
    issuer
      ? {
          id: "issuer",
          status: "PASS",
          summary: "Issuer is advertised.",
          evidence: issuer
        }
      : {
          id: "issuer",
          status: "FAIL",
          summary: "Issuer is not advertised.",
          evidence: "Missing issuer"
        },
    checkEndpoint(metadata, "authorization_endpoint", "authorization_endpoint", "Authorization endpoint"),
    checkEndpoint(metadata, "token_endpoint", "token_endpoint", "Token endpoint")
  ];

  if (pkceMethods?.includes("S256")) {
    checks.push({
      id: "pkce_s256",
      status: "PASS",
      summary: "Discovery advertises PKCE S256.",
      evidence: `code_challenge_methods_supported=${JSON.stringify(pkceMethods)}`
    });
  } else if (pkceMethods) {
    checks.push({
      id: "pkce_s256",
      status: "FAIL",
      summary: "Discovery advertises PKCE methods but not S256.",
      evidence: `code_challenge_methods_supported=${JSON.stringify(pkceMethods)}`
    });
  } else {
    checks.push({
      id: "pkce_s256",
      status: "UNKNOWN",
      summary: "Discovery does not advertise PKCE methods.",
      evidence: "code_challenge_methods_supported is absent; a live compatibility test is required."
    });
  }

  const authorizationCodeAdvertised =
    responseTypes?.includes("code") || grants?.includes("authorization_code");
  checks.push(
    authorizationCodeAdvertised
      ? {
          id: "authorization_code",
          status: "PASS",
          summary: "Authorization Code flow is advertised.",
          evidence: `response_types_supported=${JSON.stringify(responseTypes ?? [])}; grant_types_supported=${JSON.stringify(grants ?? [])}`
        }
      : {
          id: "authorization_code",
          status: "UNKNOWN",
          summary: "Authorization Code flow is not explicit in discovery metadata.",
          evidence: "The ProConnect service-provider documentation still documents Authorization Code Flow; verify live behavior."
        }
  );

  checks.push({
    id: "rfc8707_authorize_resource",
    status: "UNKNOWN",
    summary: "RFC 8707 resource acceptance at /authorize cannot be proven from discovery metadata.",
    evidence: "Run the baseline/resource/MCP authorization variants with a registered integration client."
  });
  checks.push({
    id: "rfc8707_token_resource",
    status: "UNKNOWN",
    summary: "RFC 8707 resource acceptance at /token cannot be proven from discovery metadata.",
    evidence: "Complete an authorization flow and exchange the code with the same resource parameter."
  });
  checks.push({
    id: "resource_audience_binding",
    status: "UNKNOWN",
    summary: "MCP-resource audience binding cannot be proven from discovery metadata.",
    evidence: "Inspect only sanitized access-token claims or introspection results after a successful live flow."
  });

  if (metadata.authorization_response_iss_parameter_supported === true) {
    checks.push({
      id: "rfc9207_iss",
      status: "PASS",
      summary: "RFC 9207 authorization-response issuer parameter is advertised.",
      evidence: "authorization_response_iss_parameter_supported=true"
    });
  } else {
    checks.push({
      id: "rfc9207_iss",
      status: "UNKNOWN",
      summary: "RFC 9207 authorization-response issuer behavior is not positively advertised.",
      evidence: "Verify the authorization callback response during the live probe."
    });
  }

  if (introspectionEndpoint) {
    checks.push({
      id: "introspection",
      status: "PASS",
      summary: "An introspection endpoint is advertised.",
      evidence: introspectionEndpoint
    });
  } else {
    checks.push({
      id: "introspection",
      status: "UNKNOWN",
      summary: "No introspection endpoint is advertised in the supplied metadata.",
      evidence: "ProConnect documents Resource Server introspection separately; verify the integration metadata/client registration."
    });
  }

  const bridgeScopes = ["doc:read", "doc:write", "doc.schema:write"];
  const advertisedBridgeScopes = bridgeScopes.filter((scope) => scopes?.includes(scope));
  checks.push({
    id: "bridge_scopes",
    status: advertisedBridgeScopes.length === bridgeScopes.length ? "PASS" : "UNKNOWN",
    summary:
      advertisedBridgeScopes.length === bridgeScopes.length
        ? "All existing bridge scopes are advertised by the authorization server."
        : "The existing bridge scopes are not all advertised; provider-specific scope handling remains unproven.",
    evidence: `scopes_supported=${JSON.stringify(scopes ?? [])}`
  });

  const refreshAdvertised = grants?.includes("refresh_token") || scopes?.includes("offline_access");
  checks.push({
    id: "refresh",
    status: refreshAdvertised ? "PASS" : "UNKNOWN",
    summary: refreshAdvertised
      ? "Discovery advertises refresh/offline capability."
      : "Refresh/offline capability is not explicit in discovery metadata.",
    evidence: `grant_types_supported=${JSON.stringify(grants ?? [])}; scopes_supported=${JSON.stringify(scopes ?? [])}`
  });

  return {
    ...(issuer ? { issuer } : {}),
    ...(authorizationEndpoint ? { authorizationEndpoint } : {}),
    ...(tokenEndpoint ? { tokenEndpoint } : {}),
    ...(introspectionEndpoint ? { introspectionEndpoint } : {}),
    checks
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return undefined;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(payload);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Return evidence useful for protocol compatibility without ever returning raw
 * access, refresh or ID tokens.
 */
export function sanitizeTokenResponse(
  httpStatus: number,
  body: unknown
): SanitizedTokenResponse {
  if (!isRecord(body)) {
    return {
      httpStatus,
      hasAccessToken: false,
      hasRefreshToken: false,
      hasIdToken: false,
      error: "non_json_object_response"
    };
  }

  const accessToken = optionalString(body.access_token);
  const claims = accessToken ? decodeJwtPayload(accessToken) : undefined;
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : undefined;

  return {
    httpStatus,
    ...(optionalString(body.token_type) ? { tokenType: optionalString(body.token_type) } : {}),
    ...(expiresIn !== undefined ? { expiresIn } : {}),
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(optionalString(body.refresh_token)),
    hasIdToken: Boolean(optionalString(body.id_token)),
    ...(claims
      ? {
          accessTokenClaims: {
            ...(claims.iss !== undefined ? { iss: claims.iss } : {}),
            ...(claims.aud !== undefined ? { aud: claims.aud } : {}),
            ...(claims.scope !== undefined ? { scope: claims.scope } : {}),
            ...(claims.exp !== undefined ? { exp: claims.exp } : {})
          }
        }
      : {}),
    ...(optionalString(body.error) ? { error: optionalString(body.error) } : {}),
    ...(optionalString(body.error_description)
      ? { errorDescription: optionalString(body.error_description) }
      : {})
  };
}
