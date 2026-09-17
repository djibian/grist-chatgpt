export type LogtoCompatibilityStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface LogtoCompatibilityCheck {
  id: string;
  status: LogtoCompatibilityStatus;
  evidence: string;
}

export interface LogtoDiscoveryReport {
  checks: readonly LogtoCompatibilityCheck[];
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  advertisedScopes: readonly string[];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function endpointCheck(id: string, value: unknown): LogtoCompatibilityCheck {
  const endpoint = stringValue(value);
  if (!endpoint) {
    return { id, status: "FAIL", evidence: "metadata field is missing" };
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
      return { id, status: "FAIL", evidence: "endpoint is not HTTPS" };
    }
    return { id, status: "PASS", evidence: url.origin + url.pathname };
  } catch {
    return { id, status: "FAIL", evidence: "metadata field is not a valid URL" };
  }
}

export function evaluateLogtoDiscovery(
  expectedIssuer: string,
  metadata: Record<string, unknown>
): LogtoDiscoveryReport {
  const issuer = stringValue(metadata.issuer);
  const authorizationEndpoint = stringValue(metadata.authorization_endpoint);
  const tokenEndpoint = stringValue(metadata.token_endpoint);
  const jwksUri = stringValue(metadata.jwks_uri);
  const pkceMethods = stringArray(metadata.code_challenge_methods_supported);
  const responseTypes = stringArray(metadata.response_types_supported);
  const grantTypes = stringArray(metadata.grant_types_supported);
  const advertisedScopes = stringArray(metadata.scopes_supported);

  const checks: LogtoCompatibilityCheck[] = [
    {
      id: "issuer",
      status: issuer === expectedIssuer ? "PASS" : "FAIL",
      evidence:
        issuer === expectedIssuer
          ? "issuer exactly matches configured issuer"
          : `expected ${expectedIssuer}; received ${issuer ?? "<missing>"}`
    },
    endpointCheck("authorization_endpoint", metadata.authorization_endpoint),
    endpointCheck("token_endpoint", metadata.token_endpoint),
    endpointCheck("jwks_uri", metadata.jwks_uri),
    {
      id: "pkce_s256",
      status: pkceMethods.includes("S256") ? "PASS" : "FAIL",
      evidence: pkceMethods.length
        ? `advertised methods: ${pkceMethods.join(", ")}`
        : "code_challenge_methods_supported is absent or empty"
    },
    {
      id: "authorization_code_response",
      status: responseTypes.includes("code") ? "PASS" : "FAIL",
      evidence: responseTypes.length
        ? `response types: ${responseTypes.join(", ")}`
        : "response_types_supported is absent or empty"
    },
    {
      id: "authorization_code_grant",
      status:
        grantTypes.length === 0
          ? "UNKNOWN"
          : grantTypes.includes("authorization_code")
            ? "PASS"
            : "FAIL",
      evidence: grantTypes.length
        ? `grant types: ${grantTypes.join(", ")}`
        : "grant_types_supported is not advertised"
    }
  ];

  return {
    checks,
    ...(issuer ? { issuer } : {}),
    ...(authorizationEndpoint ? { authorizationEndpoint } : {}),
    ...(tokenEndpoint ? { tokenEndpoint } : {}),
    ...(jwksUri ? { jwksUri } : {}),
    advertisedScopes
  };
}
