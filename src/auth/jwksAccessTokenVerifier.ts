import {
  constants,
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
  type KeyObject
} from "node:crypto";

import type { CryptographicallyVerifiedAccessTokenClaims } from "./oauthAccessToken.js";
import type { OAuthAccessTokenVerifier } from "./oauthRequestContext.js";

export type OAuthJwksFetcher = (
  url: string,
  init: RequestInit
) => Promise<Response>;

export interface JwksOAuthAccessTokenVerifierOptions {
  jwksUri: string;
  requestTimeoutMs?: number;
  fetcher?: OAuthJwksFetcher;
}

export class JwksAccessTokenVerifierError extends Error {
  constructor(
    readonly code:
      | "invalid_jwks_uri"
      | "malformed_token"
      | "unsupported_alg"
      | "jwks_fetch_failed"
      | "invalid_jwks"
      | "signing_key_not_found"
      | "invalid_signature"
      | "invalid_claims"
  ) {
    super(`OAuth JWT verification failed: ${code}`);
    this.name = "JwksAccessTokenVerifierError";
  }
}

type SupportedAlgorithm =
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA";

interface JwtHeader {
  alg: SupportedAlgorithm;
  kid?: string;
}

const SUPPORTED_ALGORITHMS = new Set<SupportedAlgorithm>([
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonSegment(segment: string): Record<string, unknown> {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new JwksAccessTokenVerifierError("malformed_token");
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8")
    );
    if (!isRecord(parsed)) {
      throw new JwksAccessTokenVerifierError("malformed_token");
    }
    return parsed;
  } catch (error) {
    if (error instanceof JwksAccessTokenVerifierError) throw error;
    throw new JwksAccessTokenVerifierError("malformed_token");
  }
}

function parseHeader(segment: string): JwtHeader {
  const header = parseJsonSegment(segment);
  const alg = header.alg;
  if (typeof alg !== "string" || !SUPPORTED_ALGORITHMS.has(alg as SupportedAlgorithm)) {
    throw new JwksAccessTokenVerifierError("unsupported_alg");
  }
  if (header.kid !== undefined && typeof header.kid !== "string") {
    throw new JwksAccessTokenVerifierError("malformed_token");
  }
  return {
    alg: alg as SupportedAlgorithm,
    ...(typeof header.kid === "string" ? { kid: header.kid } : {})
  };
}

function eligibleSigningKeys(
  keys: readonly Record<string, unknown>[],
  header: JwtHeader
): Record<string, unknown>[] {
  return keys.filter((key) => {
    if (typeof key.kty !== "string") return false;
    if (key.use !== undefined && key.use !== "sig") return false;
    if (key.alg !== undefined && key.alg !== header.alg) return false;
    if (header.kid !== undefined && key.kid !== header.kid) return false;
    return true;
  });
}

function selectSigningKey(
  keys: readonly Record<string, unknown>[],
  header: JwtHeader
): Record<string, unknown> {
  const eligible = eligibleSigningKeys(keys, header);
  if (eligible.length === 1) return eligible[0]!;
  throw new JwksAccessTokenVerifierError("signing_key_not_found");
}

function hashForAlgorithm(algorithm: SupportedAlgorithm): string | null {
  if (algorithm === "EdDSA") return null;
  if (algorithm.endsWith("256")) return "sha256";
  if (algorithm.endsWith("384")) return "sha384";
  return "sha512";
}

function verifyCompactSignature(
  algorithm: SupportedAlgorithm,
  key: KeyObject,
  signingInput: string,
  signatureSegment: string
): boolean {
  if (!signatureSegment || !/^[A-Za-z0-9_-]+$/.test(signatureSegment)) {
    throw new JwksAccessTokenVerifierError("malformed_token");
  }
  const data = Buffer.from(signingInput, "ascii");
  const signature = Buffer.from(signatureSegment, "base64url");
  const hash = hashForAlgorithm(algorithm);

  if (algorithm.startsWith("PS")) {
    return verifySignature(
      hash,
      data,
      {
        key,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST
      },
      signature
    );
  }
  if (algorithm.startsWith("ES")) {
    return verifySignature(
      hash,
      data,
      { key, dsaEncoding: "ieee-p1363" },
      signature
    );
  }
  return verifySignature(hash, data, key, signature);
}

function parseAudience(value: unknown): string | readonly string[] {
  if (typeof value === "string" && value.trim()) return value;
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  ) {
    return value as string[];
  }
  throw new JwksAccessTokenVerifierError("invalid_claims");
}

function claimsFromPayload(
  payload: Record<string, unknown>
): CryptographicallyVerifiedAccessTokenClaims {
  if (typeof payload.iss !== "string" || payload.iss.trim() === "") {
    throw new JwksAccessTokenVerifierError("invalid_claims");
  }
  if (typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new JwksAccessTokenVerifierError("invalid_claims");
  }
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new JwksAccessTokenVerifierError("invalid_claims");
  }
  if (payload.scope !== undefined && typeof payload.scope !== "string") {
    throw new JwksAccessTokenVerifierError("invalid_claims");
  }

  return {
    issuer: payload.iss,
    subject: payload.sub,
    audience: parseAudience(payload.aud),
    expiresAt: payload.exp,
    ...(typeof payload.scope === "string" ? { scope: payload.scope } : {})
  };
}

export class JwksOAuthAccessTokenVerifier implements OAuthAccessTokenVerifier {
  private readonly jwksUri: string;
  private readonly requestTimeoutMs: number;
  private readonly fetcher: OAuthJwksFetcher;

  constructor(options: JwksOAuthAccessTokenVerifierOptions) {
    let parsed: URL;
    try {
      parsed = new URL(options.jwksUri);
    } catch {
      throw new JwksAccessTokenVerifierError("invalid_jwks_uri");
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== ""
    ) {
      throw new JwksAccessTokenVerifierError("invalid_jwks_uri");
    }

    const timeout = options.requestTimeoutMs ?? 10_000;
    if (!Number.isInteger(timeout) || timeout < 1) {
      throw new JwksAccessTokenVerifierError("invalid_jwks_uri");
    }

    this.jwksUri = parsed.toString();
    this.requestTimeoutMs = timeout;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async fetchSigningKey(header: JwtHeader): Promise<KeyObject> {
    let response: Response;
    try {
      response = await this.fetcher(this.jwksUri, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      });
    } catch {
      throw new JwksAccessTokenVerifierError("jwks_fetch_failed");
    }
    if (!response.ok) {
      throw new JwksAccessTokenVerifierError("jwks_fetch_failed");
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new JwksAccessTokenVerifierError("invalid_jwks");
    }
    if (!isRecord(body) || !Array.isArray(body.keys)) {
      throw new JwksAccessTokenVerifierError("invalid_jwks");
    }
    const keys = body.keys.filter(isRecord);
    if (keys.length !== body.keys.length) {
      throw new JwksAccessTokenVerifierError("invalid_jwks");
    }

    const jwk = selectSigningKey(keys, header);
    try {
      return createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
    } catch {
      throw new JwksAccessTokenVerifierError("invalid_jwks");
    }
  }

  async verify(accessToken: string): Promise<CryptographicallyVerifiedAccessTokenClaims> {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw new JwksAccessTokenVerifierError("malformed_token");
    }
    const [headerSegment, payloadSegment, signatureSegment] = parts as [
      string,
      string,
      string
    ];
    const header = parseHeader(headerSegment);
    const key = await this.fetchSigningKey(header);
    const signatureValid = verifyCompactSignature(
      header.alg,
      key,
      `${headerSegment}.${payloadSegment}`,
      signatureSegment
    );
    if (!signatureValid) {
      throw new JwksAccessTokenVerifierError("invalid_signature");
    }

    return claimsFromPayload(parseJsonSegment(payloadSegment));
  }
}
