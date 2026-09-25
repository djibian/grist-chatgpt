import { createHash, createHmac } from "node:crypto";

import type { Config } from "../config.js";
import type { AuthorizedGristService } from "../grist/authorizedService.js";
import type {
  J2SyntheticLinkKeyVault,
  J2SyntheticModelFacingIsolationProbe
} from "./stageTrackingSyntheticAccess.js";

const FIXTURE_TABLE = "Enseignants";
const FIXTURE_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const FINGERPRINT_VERSION = "j2-model-facing-isolation-v1";

export type J2ModelFacingReadSurface = Pick<AuthorizedGristService, "queryRecords">;

export interface J2ModelFacingBridgeFingerprintInput {
  gristBaseUrl: string;
  allowedDocumentIds: readonly string[];
  allowedWorkspaceIds: readonly string[];
}

export interface J2ModelFacingIsolationBoundary extends J2ModelFacingBridgeFingerprintInput {
  fixtureBaseUrl: string;
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
 * a document can cross the bridge deployment-resource boundary. A DENIED
 * verdict is based only on static origin/resource-policy exclusion, so the
 * upstream API key identity is deliberately not part of this fingerprint.
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
 * Proves that the disposable fixture cannot cross the configured model-facing
 * bridge boundary without turning ambiguous runtime errors into permission
 * evidence.
 *
 * DENIED is returned only when the target is statically outside the bridge:
 * - the fixture lives on a different Grist origin; or
 * - the bridge uses only explicit document allowlisting and the fixture ID is
 *   absent from that allowlist.
 *
 * Otherwise the same AuthorizedGristService record-read path is exercised.
 * A successful read is READABLE. Every error is UNKNOWN, including local
 * authorization errors, upstream ACL/auth failures and transport failures.
 */
export class J2ModelFacingIsolationProbe implements J2SyntheticModelFacingIsolationProbe {
  private readonly bridgeOrigin: string;
  private readonly fixtureOrigin: string;
  private readonly allowedDocumentIds: ReadonlySet<string>;
  private readonly hasWorkspaceAllowlist: boolean;

  constructor(
    private readonly service: J2ModelFacingReadSurface,
    boundary: J2ModelFacingIsolationBoundary,
    private readonly bridgeConfigFingerprint: string,
    private readonly now: () => number = Date.now
  ) {
    boundedFingerprint(bridgeConfigFingerprint);
    this.bridgeOrigin = normalizedOrigin(boundary.gristBaseUrl);
    this.fixtureOrigin = normalizedOrigin(boundary.fixtureBaseUrl);
    this.allowedDocumentIds = new Set(sortedUnique(boundary.allowedDocumentIds));
    this.hasWorkspaceAllowlist = sortedUnique(boundary.allowedWorkspaceIds).length > 0;
  }

  async checkFixtureRead(documentId: string): Promise<{
    documentId: string;
    verdict: "DENIED" | "READABLE" | "UNKNOWN";
    checkedAt: number;
    bridgeConfigFingerprint: string;
  }> {
    const target = boundedFixtureId(documentId);
    const checkedAt = this.now();
    const base = {
      documentId: target,
      checkedAt,
      bridgeConfigFingerprint: this.bridgeConfigFingerprint
    };

    if (this.fixtureOrigin !== this.bridgeOrigin) {
      return { ...base, verdict: "DENIED" };
    }

    if (!this.hasWorkspaceAllowlist && !this.allowedDocumentIds.has(target)) {
      return { ...base, verdict: "DENIED" };
    }

    try {
      await this.service.queryRecords(target, FIXTURE_TABLE, { limit: 1 });
      return { ...base, verdict: "READABLE" };
    } catch {
      return { ...base, verdict: "UNKNOWN" };
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
