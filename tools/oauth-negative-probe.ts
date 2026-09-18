import { createServer, type Server } from "node:http";

import { AuditLogger, type AuditEvent } from "../src/audit/auditLogger.js";
import {
  AuthorizationError
} from "../src/auth/authorizationService.js";
import {
  OAuthAccessTokenError,
  type CryptographicallyVerifiedAccessTokenClaims
} from "../src/auth/oauthAccessToken.js";
import {
  JwksAccessTokenVerifierError,
  JwksOAuthAccessTokenVerifier
} from "../src/auth/jwksAccessTokenVerifier.js";
import { createOAuthMcpRequestContext } from "../src/auth/oauthRequestContext.js";
import { DeploymentResourcePolicy } from "../src/grist/accessPolicy.js";
import { GristContextFactory } from "../src/grist/contextFactory.js";
import {
  GristClientFactory,
  StaticApiKeyCredentialProvider
} from "../src/grist/credentials.js";

const POC_DOCUMENT_ID = "poc-oauth-document";
const POC_TABLE_ID = "ProbeTable";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function audienceContains(
  audience: string | readonly string[],
  expected: string
): boolean {
  return typeof audience === "string"
    ? audience === expected
    : audience.includes(expected);
}

function safeFailureCode(error: unknown): string {
  if (error instanceof JwksAccessTokenVerifierError) return error.code;
  if (error instanceof OAuthAccessTokenError) return error.code;
  if (error instanceof AuthorizationError) return "authorization_rejected";
  if (error instanceof Error && /^missing_[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "unexpected";
}

class SilentAuditLogger extends AuditLogger {
  override record(_event: AuditEvent): void {}
}

function printBoolean(label: string, value: boolean): void {
  console.log(`${label}: ${value ? "yes" : "no"}`);
}

function printPass(label: string, value: boolean): void {
  console.log(`${label}: ${value ? "PASS" : "FAIL"}`);
}

async function runWrongAudience(options: {
  accessToken: string;
  issuer: string;
  jwksUri: string;
  canonicalResource: string;
}): Promise<boolean> {
  const verifier = new JwksOAuthAccessTokenVerifier({ jwksUri: options.jwksUri });
  let signatureValid = false;
  let audienceDiffers = false;
  let rejected = false;
  let contextCalls = 0;
  let failureStage: string | undefined;

  try {
    const claims = await verifier.verify(options.accessToken);
    signatureValid = true;
    audienceDiffers = !audienceContains(claims.audience, options.canonicalResource);

    await createOAuthMcpRequestContext({
      authorizationHeader: `Bearer ${options.accessToken}`,
      verifier,
      policy: {
        issuer: options.issuer,
        audience: options.canonicalResource
      },
      grant: {
        documentIds: [POC_DOCUMENT_ID],
        workspaceIds: []
      },
      contextFactory: {
        async create() {
          contextCalls += 1;
          return {};
        }
      }
    });
  } catch (error) {
    if (error instanceof OAuthAccessTokenError && error.code === "wrong_audience") {
      rejected = true;
    } else {
      failureStage = safeFailureCode(error);
    }
  }

  printPass("Wrong-resource token JWT/JWKS verification", signatureValid);
  printBoolean("Token audience differs from canonical MCP resource", audienceDiffers);
  printPass("Bridge wrong-resource rejection", rejected && audienceDiffers);
  printBoolean("Principal/context created after wrong-resource rejection", contextCalls > 0);
  if (failureStage) console.log(`Failure stage: ${failureStage}`);

  return signatureValid && audienceDiffers && rejected && contextCalls === 0;
}

interface FakeGristState {
  readonly baseUrl: string;
  readonly server: Server;
  discoveryReads: number;
  mutationRequests: number;
}

async function startFakeGrist(): Promise<FakeGristState> {
  const state: Omit<FakeGristState, "baseUrl" | "server"> = {
    discoveryReads: 0,
    mutationRequests: 0
  };

  const server = createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";
    const isMutation = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
    if (isMutation) state.mutationRequests += 1;

    res.setHeader("content-type", "application/json");

    if (method === "GET" && path === "/api/orgs") {
      state.discoveryReads += 1;
      res.statusCode = 200;
      res.end(JSON.stringify([{ id: "poc-org", name: "POC" }]));
      return;
    }

    if (method === "GET" && path === "/api/orgs/poc-org/workspaces") {
      state.discoveryReads += 1;
      res.statusCode = 200;
      res.end(
        JSON.stringify([
          {
            id: "poc-workspace",
            name: "POC",
            docs: [{ id: POC_DOCUMENT_ID, name: "POC OAuth document" }]
          }
        ])
      );
      return;
    }

    res.statusCode = isMutation ? 200 : 404;
    res.end(JSON.stringify(isMutation ? { records: [{ id: 1 }] } : { error: "not_found" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("unexpected");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    get discoveryReads() {
      return state.discoveryReads;
    },
    set discoveryReads(value: number) {
      state.discoveryReads = value;
    },
    get mutationRequests() {
      return state.mutationRequests;
    },
    set mutationRequests(value: number) {
      state.mutationRequests = value;
    }
  };
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function runMissingWrite(options: {
  accessToken: string;
  issuer: string;
  jwksUri: string;
  canonicalResource: string;
}): Promise<boolean> {
  const fake = await startFakeGrist();
  const verifier = new JwksOAuthAccessTokenVerifier({ jwksUri: options.jwksUri });
  let jwtValid = false;
  let canonicalAudienceAccepted = false;
  let missingWrite = false;
  let principalCreated = false;
  let writeRejected = false;
  let failureStage: string | undefined;

  try {
    const claims: CryptographicallyVerifiedAccessTokenClaims = await verifier.verify(options.accessToken);
    jwtValid = true;
    canonicalAudienceAccepted = audienceContains(claims.audience, options.canonicalResource);

    const contextFactory = new GristContextFactory(
      new GristClientFactory(
        fake.baseUrl,
        new StaticApiKeyCredentialProvider("poc-grist-credential-sentinel")
      ),
      new DeploymentResourcePolicy({
        allowedDocumentIds: [POC_DOCUMENT_ID],
        allowedWorkspaceIds: []
      }),
      new SilentAuditLogger(),
      {
        maxReadRecords: 1,
        maxWriteRecords: 1,
        writeBatchRecords: 1,
        maxSchemaItems: 1
      }
    );

    const result = await createOAuthMcpRequestContext({
      authorizationHeader: `Bearer ${options.accessToken}`,
      verifier,
      policy: {
        issuer: options.issuer,
        audience: options.canonicalResource
      },
      grant: {
        documentIds: [POC_DOCUMENT_ID],
        workspaceIds: []
      },
      contextFactory
    });

    principalCreated = result.principal.id.startsWith("oauth:");
    const capabilities = result.principal.grants[0]?.capabilities ?? [];
    missingWrite = !capabilities.includes("doc:write");

    try {
      await result.context.createRecords(POC_DOCUMENT_ID, POC_TABLE_ID, [
        { fields: { Probe: "must-not-be-written" } }
      ]);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        writeRejected = true;
      } else {
        failureStage = safeFailureCode(error);
      }
    }
  } catch (error) {
    failureStage = safeFailureCode(error);
  } finally {
    await stopServer(fake.server);
  }

  printPass("Insufficient-scope token JWT/JWKS verification", jwtValid);
  printPass("Canonical MCP resource audience accepted", canonicalAudienceAccepted);
  printBoolean("Token/Principal missing doc:write", missingWrite);
  printPass("Reduced-scope dynamic Principal created", principalCreated && missingWrite);
  printPass("doc:write operation rejected before mutation", writeRejected && missingWrite);
  printBoolean("Authorization path performed local discovery reads", fake.discoveryReads > 0);
  console.log(`Fake Grist mutation requests observed: ${fake.mutationRequests}`);
  if (failureStage) console.log(`Failure stage: ${failureStage}`);

  return (
    jwtValid &&
    canonicalAudienceAccepted &&
    missingWrite &&
    principalCreated &&
    writeRejected &&
    fake.discoveryReads > 0 &&
    fake.mutationRequests === 0
  );
}

const mode = required("OAUTH_NEGATIVE_CASE");
const options = {
  accessToken: required("OAUTH_ACCESS_TOKEN"),
  issuer: required("OAUTH_ISSUER").replace(/\/$/, ""),
  jwksUri: required("OAUTH_JWKS_URI"),
  canonicalResource: required("MCP_RESOURCE_URI")
};

let success = false;
if (mode === "wrong-audience") {
  success = await runWrongAudience(options);
} else if (mode === "missing-write") {
  success = await runMissingWrite(options);
} else {
  console.log("Failure stage: invalid_negative_case");
}

if (!success) process.exitCode = 1;
