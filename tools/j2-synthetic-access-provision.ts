import { AuditLogger, type AuditEvent } from "../src/audit/auditLogger.js";
import { createPrincipal } from "../src/auth/principal.js";
import { loadConfig, type Config } from "../src/config.js";
import { DeploymentResourcePolicy } from "../src/grist/accessPolicy.js";
import { GristClient, GristApiError } from "../src/grist/client.js";
import { GristContextFactory } from "../src/grist/contextFactory.js";
import {
  GristClientFactory,
  StaticApiKeyCredentialProvider
} from "../src/grist/credentials.js";
import {
  J2HmacSyntheticLinkKeyVault,
  J2ModelFacingIsolationProbe,
  fingerprintJ2ModelFacingBridgeConfig
} from "../src/j2/modelFacingIsolationProbe.js";
import { J2StageTrackingSyntheticAccessProvisioner } from "../src/j2/stageTrackingSyntheticAccess.js";

class SilentProbeAuditLogger extends AuditLogger {
  override record(_event: AuditEvent): void {
    // This operator-only precondition probe intentionally emits no per-document
    // audit event to stdout. Its bounded final result below omits document IDs,
    // URLs, LinkKeys and upstream response bodies.
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function requireOwnerAuthorization(): void {
  if (requiredEnv("J2_OWNER_AUTHORIZED") !== "YES") {
    throw new Error("J2_OWNER_AUTHORIZED must be exactly YES for effectful fixture provisioning.");
  }
}

function boundedOrigin(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("J2 owner Grist origin must be an HTTPS origin or a local HTTP origin.");
  }
  return parsed.origin;
}

function assertDedicatedSecrets(config: Config, ownerApiKey: string, seed: string): void {
  const forbidden = [config.gristApiKey, config.gptActionToken, ownerApiKey];
  if (config.mcpAuth.mode === "static") forbidden.push(config.mcpAuth.bearerToken);
  if (ownerApiKey === config.gristApiKey) {
    throw new Error("J2 owner credential must be distinct from the model-facing bridge Grist credential.");
  }
  if (forbidden.includes(seed)) {
    throw new Error("J2 synthetic LinkKey seed must be a dedicated secret, not a bridge or Grist credential.");
  }
}

async function buildStrongestModelFacingReadService() {
  const config = loadConfig();
  const credentialProvider = new StaticApiKeyCredentialProvider(config.gristApiKey);
  const clientFactory = new GristClientFactory(config.gristBaseUrl, credentialProvider);
  const deploymentPolicy = new DeploymentResourcePolicy({
    allowedDocumentIds: config.allowedDocumentIds,
    allowedWorkspaceIds: config.allowedWorkspaceIds
  });
  const contextFactory = new GristContextFactory(
    clientFactory,
    deploymentPolicy,
    new SilentProbeAuditLogger(),
    {
      maxReadRecords: config.maxReadRecords,
      maxWriteRecords: config.maxWriteRecords,
      writeBatchRecords: config.writeBatchRecords,
      maxSchemaItems: config.maxSchemaItems
    }
  );

  // This probe principal is intentionally at least as broad as every actual
  // model-facing record reader: all deployment-allowed resources + doc:read.
  // It does not depend on a user-supplied OAuth token or public bearer token.
  const principal = createPrincipal({
    id: "j2-strongest-model-facing-read-probe",
    transport: "mcp",
    documentIds: config.allowedDocumentIds,
    workspaceIds: config.allowedWorkspaceIds,
    capabilities: ["doc:read"]
  });

  return {
    service: await contextFactory.create(principal),
    config,
    fingerprint: fingerprintJ2ModelFacingBridgeConfig(config)
  };
}

async function main(): Promise<void> {
  requireOwnerAuthorization();

  const documentId = requiredEnv("J2_FIXTURE_DOCUMENT_ID");
  const ownerOrigin = boundedOrigin(requiredEnv("J2_GRIST_BASE_URL"));
  const ownerApiKey = requiredEnv("J2_GRIST_OWNER_API_KEY");
  const ownerPrincipalId = requiredEnv("J2_OWNER_PRINCIPAL_ID");
  const ownerMandateId = requiredEnv("J2_OWNER_MANDATE_ID");
  const seed = requiredEnv("J2_SYNTHETIC_LINKKEY_SEED");

  const { service, config, fingerprint } = await buildStrongestModelFacingReadService();
  assertDedicatedSecrets(config, ownerApiKey, seed);

  const isolationProbe = new J2ModelFacingIsolationProbe(
    service,
    {
      gristBaseUrl: config.gristBaseUrl,
      fixtureBaseUrl: ownerOrigin,
      allowedDocumentIds: config.allowedDocumentIds,
      allowedWorkspaceIds: config.allowedWorkspaceIds
    },
    fingerprint
  );
  const vault = new J2HmacSyntheticLinkKeyVault(seed, documentId);
  const ownerClient = new GristClient({ baseUrl: ownerOrigin, apiKey: ownerApiKey });
  const provisioner = new J2StageTrackingSyntheticAccessProvisioner(
    ownerClient,
    vault,
    isolationProbe,
    fingerprint
  );

  const result = await provisioner.provision({
    documentId,
    principalId: ownerPrincipalId,
    mandateId: ownerMandateId,
    ownerAuthorized: true
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        status: result.status,
        accessModel: result.accessModel,
        secretHandles: result.secretHandles,
        aclResourceCount: result.aclResourceCount,
        aclRuleCount: result.aclRuleCount,
        isolationEvidence: "DENIED_BY_STATIC_MODEL_FACING_BOUNDARY"
      },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  const status = error instanceof GristApiError ? ` (HTTP ${error.status})` : "";
  process.stderr.write(
    `J2-B synthetic access provisioning refused or failed${status}; verify explicit owner authorization, isolated fixture identity, static bridge resource-policy exclusion and dedicated test credentials.\n`
  );
  process.exitCode = 1;
});
