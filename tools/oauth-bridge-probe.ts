import { AuditLogger } from "../src/audit/auditLogger.js";
import {
  validateVerifiedAccessTokenClaims,
  OAuthAccessTokenError
} from "../src/auth/oauthAccessToken.js";
import {
  JwksAccessTokenVerifierError,
  JwksOAuthAccessTokenVerifier
} from "../src/auth/jwksAccessTokenVerifier.js";
import { OAuthPrincipalError } from "../src/auth/oauthPrincipal.js";
import { createOAuthMcpRequestContext } from "../src/auth/oauthRequestContext.js";
import { GRIST_CAPABILITIES } from "../src/auth/principal.js";
import { DeploymentResourcePolicy } from "../src/grist/accessPolicy.js";
import { GristContextFactory } from "../src/grist/contextFactory.js";
import {
  GristClientFactory,
  type GristCredentialContext,
  type GristCredentialProvider
} from "../src/grist/credentials.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function safeFailureCode(error: unknown): string {
  if (error instanceof JwksAccessTokenVerifierError) return error.code;
  if (error instanceof OAuthAccessTokenError) return error.code;
  if (error instanceof OAuthPrincipalError) return error.code;
  if (error instanceof Error && /^missing_[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "unexpected";
}

function sameCapabilities(actual: readonly string[]): boolean {
  return (
    actual.length === GRIST_CAPABILITIES.length &&
    GRIST_CAPABILITIES.every((capability) => actual.includes(capability))
  );
}

class ProbeCredentialProvider implements GristCredentialProvider {
  calls = 0;
  bearerObserved = false;

  constructor(private readonly oauthBearer: string) {}

  async getApiKey(context: GristCredentialContext): Promise<string> {
    this.calls += 1;
    if (JSON.stringify(context).includes(this.oauthBearer)) {
      this.bearerObserved = true;
    }
    return "poc-grist-credential-sentinel";
  }
}

const status = {
  jwt: false,
  issuer: false,
  audience: false,
  scopes: false,
  principal: false,
  context: false,
  bearerReachedCredentialProvider: false,
  credentialProviderCalled: false
};
let failureStage: string | undefined;

try {
  const accessToken = required("OAUTH_ACCESS_TOKEN");
  const issuer = required("OAUTH_ISSUER").replace(/\/$/, "");
  const jwksUri = required("OAUTH_JWKS_URI");
  const resource = required("MCP_RESOURCE_URI");

  const verifier = new JwksOAuthAccessTokenVerifier({ jwksUri });
  const policy = { issuer, audience: resource } as const;

  const claims = await verifier.verify(accessToken);
  status.jwt = true;

  const identity = validateVerifiedAccessTokenClaims(claims, policy);
  status.issuer = identity.issuer === issuer;
  status.audience = true;

  const credentialProvider = new ProbeCredentialProvider(accessToken);
  const contextFactory = new GristContextFactory(
    new GristClientFactory("https://grist.example.invalid", credentialProvider),
    new DeploymentResourcePolicy({
      allowedDocumentIds: ["poc-oauth-document"],
      allowedWorkspaceIds: []
    }),
    new AuditLogger(),
    {
      maxReadRecords: 1,
      maxWriteRecords: 1,
      writeBatchRecords: 1,
      maxSchemaItems: 1
    }
  );

  const result = await createOAuthMcpRequestContext({
    authorizationHeader: `Bearer ${accessToken}`,
    verifier,
    policy,
    grant: {
      documentIds: ["poc-oauth-document"],
      workspaceIds: []
    },
    contextFactory
  });

  const capabilities = result.principal.grants[0]?.capabilities ?? [];
  status.scopes = sameCapabilities(capabilities);
  status.principal =
    result.principal.transport === "mcp" &&
    result.principal.id.startsWith("oauth:") &&
    !JSON.stringify(result.principal).includes(accessToken);
  status.context = result.context !== undefined;
  status.credentialProviderCalled = credentialProvider.calls === 1;
  status.bearerReachedCredentialProvider = credentialProvider.bearerObserved;
} catch (error) {
  failureStage = safeFailureCode(error);
}

console.log(`Bridge JWT/JWKS verification: ${status.jwt ? "PASS" : "FAIL"}`);
console.log(`Bridge issuer policy: ${status.issuer ? "PASS" : "FAIL"}`);
console.log(`Bridge resource audience policy: ${status.audience ? "PASS" : "FAIL"}`);
console.log(`Bridge scope mapping: ${status.scopes ? "PASS" : "FAIL"}`);
console.log(`Dynamic Principal created: ${status.principal ? "PASS" : "FAIL"}`);
console.log(`Principal-bound Grist context created: ${status.context ? "PASS" : "FAIL"}`);
console.log(
  `Grist credential provider invoked with Principal context: ${
    status.credentialProviderCalled ? "yes" : "no"
  }`
);
console.log(
  `Raw OAuth bearer reaches Grist credential provider: ${
    status.bearerReachedCredentialProvider ? "yes" : "no"
  }`
);
if (failureStage) console.log(`Failure stage: ${failureStage}`);

if (
  !status.jwt ||
  !status.issuer ||
  !status.audience ||
  !status.scopes ||
  !status.principal ||
  !status.context ||
  !status.credentialProviderCalled ||
  status.bearerReachedCredentialProvider
) {
  process.exitCode = 1;
}
