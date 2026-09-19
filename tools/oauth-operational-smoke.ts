import { pathToFileURL } from "node:url";

import {
  buildOAuthProtectedResourceMetadataUrl,
  type OAuthProtectedResourceMetadata
} from "../src/auth/oauthProtectedResource.js";
import { GRIST_CAPABILITIES } from "../src/auth/principal.js";

export interface OperationalSmokeCheck {
  id: string;
  passed: boolean;
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function parseCanonicalResource(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/mcp" ||
      url.search !== "" ||
      url.hash !== "" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function exactScopes(value: unknown): boolean {
  if (!Array.isArray(value) || value.some(scope => typeof scope !== "string")) {
    return false;
  }
  const actual = [...value].sort();
  const expected = [...GRIST_CAPABILITIES].sort();
  return actual.length === expected.length && actual.every((scope, index) => scope === expected[index]);
}

function validAuthorizationServers(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "string") {
    return false;
  }
  try {
    const url = new URL(value[0]);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.hash === "";
  } catch {
    return false;
  }
}

async function safeJson(response: Response | undefined): Promise<unknown> {
  if (!response) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request(
  fetchImpl: FetchLike,
  input: URL,
  init?: RequestInit
): Promise<Response | undefined> {
  try {
    return await fetchImpl(input, {
      ...init,
      redirect: "manual",
      signal: init?.signal ?? AbortSignal.timeout(10_000)
    });
  } catch {
    return undefined;
  }
}

/**
 * Non-secret post-deploy smoke checks only. No bearer token is accepted or sent,
 * and the returned evidence contains fixed identifiers rather than endpoint data.
 */
export async function runOAuthOperationalSmoke(
  resourceUri: string,
  fetchImpl: FetchLike = fetch
): Promise<OperationalSmokeCheck[]> {
  const resource = parseCanonicalResource(resourceUri);
  if (!resource) return [{ id: "configuration_valid", passed: false }];

  const publicBase = `${resource.protocol}//${resource.host}`;
  const metadataUrl = new URL(buildOAuthProtectedResourceMetadataUrl(publicBase));
  const health = await request(fetchImpl, new URL("/healthz", publicBase));
  const metadata = await request(fetchImpl, metadataUrl);
  const challenge = await request(fetchImpl, resource, { method: "GET" });

  const healthBody = await safeJson(health) as Record<string, unknown> | undefined;
  const metadataBody = await safeJson(metadata) as OAuthProtectedResourceMetadata | undefined;
  const challengeHeader = challenge?.headers.get("www-authenticate") ?? "";
  const expectedChallenge = `resource_metadata="${metadataUrl.toString()}"`;

  return [
    {
      id: "health_endpoint",
      passed:
        health?.status === 200 &&
        healthBody?.status === "ok" &&
        healthBody?.service === "grist-chatgpt" &&
        typeof healthBody?.version === "string" &&
        healthBody.version.length > 0
    },
    {
      id: "protected_resource_metadata",
      passed: metadata?.status === 200 && metadataBody !== undefined
    },
    {
      id: "metadata_resource_binding",
      passed: metadataBody?.resource === resource.toString()
    },
    {
      id: "metadata_authorization_server",
      passed: validAuthorizationServers(metadataBody?.authorization_servers)
    },
    {
      id: "metadata_scopes",
      passed: exactScopes(metadataBody?.scopes_supported)
    },
    {
      id: "unauthenticated_mcp_challenge",
      passed:
        challenge?.status === 401 &&
        challengeHeader.startsWith("Bearer ") &&
        challengeHeader.includes(expectedChallenge) &&
        !challengeHeader.includes('error="')
    }
  ];
}

function printChecks(checks: OperationalSmokeCheck[]): void {
  for (const check of checks) {
    console.log(`${check.id}: ${check.passed ? "PASS" : "FAIL"}`);
  }
}

async function main(): Promise<void> {
  const resourceUri = process.env.MCP_RESOURCE_URI ?? "";
  const checks = await runOAuthOperationalSmoke(resourceUri);
  printChecks(checks);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  void main().catch(() => {
    console.log("operational_smoke: FAIL");
    process.exitCode = 1;
  });
}
