import { createHash, createHmac } from "node:crypto";

import { AuthorizationError } from "../auth/authorizationService.js";
import type { AuthorizedGristService } from "../grist/authorizedService.js";
import type { Config } from "../config.js";
import type { J2SyntheticLinkKeyVault, J2SyntheticModelFacingIsolationProbe } from "./stageTrackingSyntheticAccess.js";

const FIXTURE_TABLE = "Enseignants";
const FIXTURE_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const FINGERPRINT_VERSION = "j2-model-facing-isolation-v1";

export type J2ModelFacingReadSurface = Pick<AuthorizedGristService, "queryRecords">;

export interface J2ModelFacingBridgeFingerprintInput {
  gristBaseUrl: string;
  allowedDocumentIds: readonly string[];
  allowedWorkspaceIds: readonly string[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizedOrigin(value: string): string {
  const parsed = new URL(value);
  return parsed.origin;
}

function boundedFixtureId(value: string): string {
  if (!FIXTURE_ID_PATTERN.test(value)) {
    throw new Error("J2 fixture target must be one bounded Grist document ID, not a URL.");
  }
  return value;
}

function boundedFingerprint(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("J2 bridge configuration fingerprint must be a SHA-256 hex digest.");
  }
  return value;
}

/**
 * Fingerprint only non-secret model-facing bridge facts that determine whether
 * a document can cross the bridge deployment-resource boundary. A negative
 * verdict from J2ModelFacingIsolationProbe is accepted only for a local
 * AuthorizationError, before the Grist API is called, so the upstream API key
 * identity is deliberately not part of this fingerprint.
 */
export function fingerprintJ2ModelFacingBridge(
  input: J2ModelFacingBridgeFingerprintInput
): string {
  const canonical = JSON.stringify({
    version: FINGERPRINT_VERSION,
    gristOrigin: normalizedOrigin(input.gristBaseUrl),
    allowedDocumentIds: sortedUnique(input.allowedDocumentIds),
    allowedWorkspaceIds: sortedUnique(input.allowedWorkspaceIds),
    capability: "doc:read"
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function fingerprintJ2ModelFacingBridgeConfig(config: Pick<
  Config,
  "gristBaseUrl" | "allowedDocumentIds" | "allowedWorkspaceIds"
>): string {
  return fingerprintJ2ModelFacingBridge(config);
}

/**
 * Tests the same AuthorizedGristService boundary used by model-facing tools,
 * with a deliberately strongest resource grant supplied by the caller.
 *
 * Only a bridge-local AuthorizationError proves DENIED. Upstream 401/403,
 * transport failures, missing tables, authentication failures and every other
 * error remain UNKNOWN; none of them can authorize LinkKey provisioning.
 */
export class J2ModelFacingIsolationProbe implements J2SyntheticModelFacingIsolationProbe {
  constructor(
    private readonly service: J2ModelFacingReadSurface,
    private readonly bridgeConfigFingerprint: string,
    private readonly now: () => number = Date.now
  ) {
    boundedFingerprint(bridgeConfigFingerprint);
  }

  async checkFixtureRead(documentId: string): Promise<{
    documentId: string;
    verdict: "DENIED" | "READABLE" | "UNKNOWN";
    checkedAt: number;
    bridgeConfigFingerprint: string;
  }> {
    const target = boundedFixtureId(documentId);
    const checkedAt = this.now();
    try {
      await this.service.queryRecords(target, FIXTURE_TABLE, { limit: 1 });
      return {
        documentId: target,
        verdict: "READABLE",
        checkedAt,
        bridgeConfigFingerprint: this.bridgeConfigFingerprint
      };
    } catch (error: unknown) {
      return {
        documentId: target,
        verdict: error instanceof AuthorizationError ? "DENIED" : "UNKNOWN",
        checkedAt,
        bridgeConfigFingerprint: this.bridgeConfigFingerprint
      };
    }
  }
}

/**
 * Deterministic server-held synthetic LinkKey derivation for the disposable J2
 * fixture. The seed is never returned or logged, and HMAC evaluation is lazy:
 * the provisioner calls this vault only after its fresh DENIED isolation probe.
 */
export class J2HmacSyntheticLinkKeyVault implements J2SyntheticLinkKeyVault {
  private readonly seed: Buffer;

  constructor(seed: string, private readonly namespace: string) {
    if (seed.length < 32 || seed.length > 4096) {
      throw new Error("J2 synthetic LinkKey seed must contain 32 to 4096 characters.");
    }
    if (!FIXTURE_ID_PATTERN.test(namespace)) {
      throw new Error("J2 LinkKey namespace must be the bounded fixture document ID.");
    }
    this.seed = Buffer.from(seed, "utf8");
  }

  async getOrCreate(handle: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(handle)) {
      throw new Error("J2 synthetic LinkKey handle is invalid.");
    }
    return createHmac("sha256", this.seed)
      .update(`${FINGERPRINT_VERSION}:${this.namespace}:${handle}`, "utf8")
      .digest("base64url");
  }
}
