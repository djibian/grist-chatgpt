import { createHash, randomBytes } from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";

import {
  evaluateProConnectDiscovery,
  sanitizeTokenResponse
} from "../src/compat/proconnectMcp.js";

const DEFAULT_DISCOVERY_URL =
  "https://fca.integ01.dev-agentconnect.fr/api/v2/.well-known/openid-configuration";
const DEFAULT_SESSION_FILE = ".proconnect-probe-session.json";

type AuthorizeVariant = "baseline" | "pkce" | "resource" | "mcp";

interface ProbeSession {
  createdAt: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  variant: AuthorizeVariant;
  state: string;
  nonce: string;
  codeVerifier?: string;
  resource?: string;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function requireOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Required option ${name} is missing.`);
  return value;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseVariant(value: string | undefined): AuthorizeVariant {
  const variant = value ?? "mcp";
  if (
    variant !== "baseline" &&
    variant !== "pkce" &&
    variant !== "resource" &&
    variant !== "mcp"
  ) {
    throw new Error(
      `Invalid --variant ${variant}. Expected baseline, pkce, resource or mcp.`
    );
  }
  return variant;
}

function randomUrlSafe(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    redirect: "manual",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { nonJsonBody: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} from ${url}: ${JSON.stringify(body)}`
    );
  }
  return body;
}

async function loadDiscovery(discoveryUrl: string) {
  const metadata = await fetchJson(discoveryUrl);
  const report = evaluateProConnectDiscovery(metadata);
  if (!report.authorizationEndpoint || !report.tokenEndpoint) {
    throw new Error(
      "Discovery metadata does not provide both authorization_endpoint and token_endpoint."
    );
  }
  return { metadata, report };
}

async function metadataCommand(): Promise<void> {
  const discoveryUrl = option("--discovery-url") ?? DEFAULT_DISCOVERY_URL;
  const { report } = await loadDiscovery(discoveryUrl);
  console.log(JSON.stringify({ discoveryUrl, ...report }, null, 2));
}

async function authorizeCommand(): Promise<void> {
  const discoveryUrl = option("--discovery-url") ?? DEFAULT_DISCOVERY_URL;
  const clientId = requireOption("--client-id");
  const redirectUri = requireOption("--redirect-uri");
  const scope = option("--scope") ?? "openid";
  const variant = parseVariant(option("--variant"));
  const sessionFile = option("--session") ?? DEFAULT_SESSION_FILE;
  const resource = option("--resource");

  if ((variant === "resource" || variant === "mcp") && !resource) {
    throw new Error(`--resource is required for the ${variant} variant.`);
  }

  const { report } = await loadDiscovery(discoveryUrl);
  const state = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  const codeVerifier =
    variant === "pkce" || variant === "mcp" ? randomUrlSafe(64) : undefined;

  const url = new URL(report.authorizationEndpoint!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  if (codeVerifier) {
    url.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  if (resource) {
    url.searchParams.set("resource", resource);
  }

  const session: ProbeSession = {
    createdAt: new Date().toISOString(),
    discoveryUrl,
    authorizationEndpoint: report.authorizationEndpoint!,
    tokenEndpoint: report.tokenEndpoint!,
    clientId,
    redirectUri,
    scope,
    variant,
    state,
    nonce,
    ...(codeVerifier ? { codeVerifier } : {}),
    ...(resource ? { resource } : {})
  };

  await writeFile(sessionFile, JSON.stringify(session, null, 2), {
    encoding: "utf8",
    mode: 0o600
  });
  await chmod(sessionFile, 0o600);

  console.log(
    JSON.stringify(
      {
        variant,
        authorizationUrl: url.toString(),
        sessionFile,
        next:
          "Open authorizationUrl in a browser. If the registered callback returns a code, keep it local in an environment variable and run the exchange command; never pass the code on the command line."
      },
      null,
      2
    )
  );
}

async function removeSessionFile(sessionFile: string): Promise<void> {
  try {
    await unlink(sessionFile);
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    if (code !== "ENOENT") {
      console.error(`Warning: could not remove probe session file ${sessionFile}.`);
    }
  }
}

async function exchangeCommand(): Promise<void> {
  const sessionFile = option("--session") ?? DEFAULT_SESSION_FILE;
  const authorizationCodeEnv =
    option("--authorization-code-env") ?? "PROCONNECT_AUTHORIZATION_CODE";
  const clientSecretEnv =
    option("--client-secret-env") ?? "PROCONNECT_CLIENT_SECRET";
  const code = process.env[authorizationCodeEnv];
  const clientSecret = process.env[clientSecretEnv];

  if (!code) {
    throw new Error(
      `Environment variable ${authorizationCodeEnv} must contain the local authorization code.`
    );
  }
  if (!clientSecret) {
    throw new Error(
      `Environment variable ${clientSecretEnv} must contain the integration client secret.`
    );
  }

  const session = JSON.parse(
    await readFile(sessionFile, "utf8")
  ) as ProbeSession;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: session.clientId,
    client_secret: clientSecret,
    redirect_uri: session.redirectUri,
    code
  });

  if (session.codeVerifier) body.set("code_verifier", session.codeVerifier);
  if (session.resource) body.set("resource", session.resource);

  const response = await fetch(session.tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    redirect: "manual"
  });

  const text = await response.text();
  await removeSessionFile(sessionFile);

  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    raw = { error: "non_json_response" };
  }

  const sanitized = sanitizeTokenResponse(response.status, raw);
  console.log(
    JSON.stringify(
      {
        variant: session.variant,
        resource: session.resource,
        sanitizedTokenResponse: sanitized,
        note:
          "Raw access, refresh and ID tokens are never printed or persisted. JWT-shaped claim fields are decoded diagnostics only and are not signature validation."
      },
      null,
      2
    )
  );

  if (!response.ok) process.exitCode = 2;
}

function help(): void {
  console.log(`ProConnect / MCP compatibility probe

Commands:
  metadata
    Fetch and evaluate public OIDC discovery metadata.

  authorize --client-id ID --redirect-uri URI [--variant baseline|pkce|resource|mcp]
            [--resource URI] [--scope "openid ..."] [--session FILE]
    Build an authorization URL and save ephemeral state/PKCE material locally.

  exchange [--session FILE] [--authorization-code-env ENV] [--client-secret-env ENV]
    Exchange an authorization code read from an environment variable using the exact
    parameters represented by the saved probe session. Token values are never printed
    or persisted.

Defaults:
  discovery:              ${DEFAULT_DISCOVERY_URL}
  session:                ${DEFAULT_SESSION_FILE}
  variant:                mcp
  authorization code env: PROCONNECT_AUTHORIZATION_CODE
  client secret env:      PROCONNECT_CLIENT_SECRET

Recommended A/B sequence:
  1. baseline  (documented OIDC parameters only)
  2. pkce      (+ code_challenge + S256)
  3. resource  (+ RFC 8707 resource)
  4. mcp       (+ PKCE S256 + resource)
`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "metadata";
  if (hasFlag("--help") || command === "help") {
    help();
    return;
  }

  if (command === "metadata") return metadataCommand();
  if (command === "authorize") return authorizeCommand();
  if (command === "exchange") return exchangeCommand();

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
