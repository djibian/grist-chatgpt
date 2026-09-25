import { AuditLogger, type AuditEvent } from "../src/audit/auditLogger.js";
import { createPrincipal } from "../src/auth/principal.js";
import { loadConfig, type Config } from "../src/config.js";
import { DeploymentResourcePolicy } from "../src/grist/accessPolicy.js";
import { GristClient } from "../src/grist/client.js";
import { GristContextFactory } from "../src/grist/contextFactory.js";
import {
  GristClientFactory,
  StaticApiKeyCredentialProvider
} from "../src/grist/credentials.js";
import {
  fingerprintJ2ModelFacingBridgeConfig,
  J2HmacSyntheticLinkKeyVault,
  J2ModelFacingIsolationProbe
} from "../src/j2/modelFacingIsolationProbe.js";
import {
  J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION,
  J2StageTrackingControlledBrowserVerifier
} from "../src/j2/stageTrackingBrowserVerifier.js";
import { J2StageTrackingGristBrowserFactory } from "../src/j2/stageTrackingGristBrowserAdapter.js";

class SilentProbeAuditLogger extends AuditLogger {
  override record(_event: AuditEvent): void {
    // The precondition probe deliberately emits no per-document audit event to stdout.
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function requiredPositiveInt(name: string): number {
  const raw = requiredEnv(name);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function requireOwnerAuthorization(): void {
  if (requiredEnv("J2_OWNER_AUTHORIZED") !== "YES") {
    throw new Error("J2_OWNER_AUTHORIZED must be exactly YES for controlled browser verification.");
  }
}

function boundedOrigin(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
  ) {
    throw new Error("J2 browser Grist origin must be an HTTPS origin or a local HTTP origin.");
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
  const principal = createPrincipal({
    id: "j2-controlled-browser-isolation-probe",
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
  const gristOrigin = boundedOrigin(requiredEnv("J2_GRIST_BASE_URL"));
  const ownerApiKey = requiredEnv("J2_GRIST_OWNER_API_KEY");
  const seed = requiredEnv("J2_SYNTHETIC_LINKKEY_SEED");
  const documentPath = requiredEnv("J2_GRIST_DOCUMENT_PATH");
  const teacherPageRef = requiredPositiveInt("J2_TEACHER_PAGE_REF");
  const alternatePageRef = requiredPositiveInt("J2_ALTERNATE_PAGE_REF");
  const chromiumExecutable = requiredEnv("J2_CHROMIUM_EXECUTABLE");
  const gristVersion = requiredEnv("J2_GRIST_VERSION");
  const selectorProfile = requiredEnv("J2_GRIST_BROWSER_SELECTOR_PROFILE");
  if (selectorProfile !== "grist-core-b393db7") {
    throw new Error("Unsupported J2 Grist browser selector profile.");
  }

  const { service, config, fingerprint } = await buildStrongestModelFacingReadService();
  assertDedicatedSecrets(config, ownerApiKey, seed);

  const isolationProbe = new J2ModelFacingIsolationProbe(
    service,
    {
      gristBaseUrl: config.gristBaseUrl,
      fixtureBaseUrl: gristOrigin,
      allowedDocumentIds: config.allowedDocumentIds,
      allowedWorkspaceIds: config.allowedWorkspaceIds
    },
    fingerprint
  );
  const isolation = await isolationProbe.checkFixtureRead(documentId);
  if (isolation.verdict !== "DENIED") {
    throw new Error("J2 browser verification requires a fresh DENIED model-facing fixture isolation probe.");
  }

  // Only derive synthetic LinkKeys after the fresh bridge-isolation proof above.
  const vault = new J2HmacSyntheticLinkKeyVault(seed, documentId);
  const ownerClient = new GristClient({ baseUrl: gristOrigin, apiKey: ownerApiKey });
  const factory = new J2StageTrackingGristBrowserFactory(
    {
      gristOrigin,
      documentId,
      documentPath,
      teacherPageRef,
      alternatePageRef,
      chromiumExecutable,
      gristVersion,
      selectorProfile
    },
    ownerClient,
    vault
  );

  await factory.assertProvisionedFixture();
  const fixtureRevision = await factory.fixtureRevision();
  const verifier = new J2StageTrackingControlledBrowserVerifier();
  const report = await verifier.verify(factory, {
    fixtureId: documentId,
    fixtureRevision,
    gristVersion,
    contractVersion: J2_STAGE_TRACKING_ACCEPTED_CONTRACT_VERSION
  });

  process.stdout.write(`${JSON.stringify({
    verdict: report.verdict,
    fixtureRevision,
    gristVersion,
    selectorProfile,
    isolationEvidence: "DENIED_BY_FRESH_MODEL_FACING_BOUNDARY_PROBE",
    evidence: report.evidence
  }, null, 2)}\n`);

  if (report.verdict !== "VERIFIED") process.exitCode = 2;
}

main().catch(() => {
  process.stderr.write(
    "J2 controlled browser verification refused or failed; verify isolated fixture policy, exact synthetic provisioning, supported browser profile, protected operator configuration and Chromium availability.\n"
  );
  process.exitCode = 1;
});
