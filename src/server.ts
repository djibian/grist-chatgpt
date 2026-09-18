import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  buildOpenApiDocument,
  registerGptActionApi,
  sendApiError
} from "./actions/api.js";
import {
  buildUiOpenApiPaths,
  registerUiActionApi
} from "./actions/uiApi.js";
import { AuditLogger } from "./audit/auditLogger.js";
import { OAuthAccessTokenError } from "./auth/oauthAccessToken.js";
import {
  JwksAccessTokenVerifierError,
  JwksOAuthAccessTokenVerifier
} from "./auth/jwksAccessTokenVerifier.js";
import {
  buildBearerChallenge,
  buildOAuthProtectedResourceMetadata,
  buildOAuthProtectedResourceMetadataUrl,
  OAUTH_PROTECTED_RESOURCE_METADATA_PATH
} from "./auth/oauthProtectedResource.js";
import { OAuthPrincipalError } from "./auth/oauthPrincipal.js";
import {
  createOAuthMcpRequestContext,
  OAuthRequestAuthenticationError
} from "./auth/oauthRequestContext.js";
import { createPrincipal, GRIST_CAPABILITIES } from "./auth/principal.js";
import { isAuthorizedBearerHeader } from "./auth/staticBearer.js";
import { loadConfig } from "./config.js";
import { DeploymentResourcePolicy } from "./grist/accessPolicy.js";
import type { AuthorizedGristService } from "./grist/authorizedService.js";
import { GristContextFactory } from "./grist/contextFactory.js";
import {
  GristClientFactory,
  StaticApiKeyCredentialProvider
} from "./grist/credentials.js";
import { UiWriteVerificationError } from "./grist/uiActionsAdapter.js";
import { registerCoreTools } from "./mcp/coreTools.js";
import { registerDiscoveryTools } from "./mcp/discoveryTools.js";
import { registerSchemaTools } from "./mcp/schemaTools.js";
import { registerUiTools } from "./mcp/uiTools.js";
import { operationHelp } from "./operations/registry.js";
import { VERSION } from "./version.js";

const config = loadConfig();
const credentialProvider = new StaticApiKeyCredentialProvider(config.gristApiKey);
const clientFactory = new GristClientFactory(
  config.gristBaseUrl,
  credentialProvider
);
const deploymentPolicy = new DeploymentResourcePolicy({
  allowedDocumentIds: config.allowedDocumentIds,
  allowedWorkspaceIds: config.allowedWorkspaceIds
});
const audit = new AuditLogger();
const contextFactory = new GristContextFactory(
  clientFactory,
  deploymentPolicy,
  audit,
  {
    maxReadRecords: config.maxReadRecords,
    maxWriteRecords: config.maxWriteRecords,
    writeBatchRecords: config.writeBatchRecords,
    maxSchemaItems: config.maxSchemaItems
  }
);

const staticMcpPrincipal =
  config.mcpAuth.mode === "static"
    ? createPrincipal({
        id: "mcp-client",
        transport: "mcp",
        documentIds: config.allowedDocumentIds,
        workspaceIds: config.allowedWorkspaceIds,
        capabilities: config.mcpCapabilities
      })
    : undefined;

const gptPrincipal = createPrincipal({
  id: "chatgpt-actions",
  transport: "gpt-actions",
  documentIds: config.allowedDocumentIds,
  workspaceIds: config.allowedWorkspaceIds,
  capabilities: config.gptActionCapabilities
});

// Keep the historical static development MCP context only in explicit static
// mode. OAuth mode creates a fresh Principal-bound context for every request.
const staticMcpGrist = staticMcpPrincipal
  ? await contextFactory.create(staticMcpPrincipal)
  : undefined;
const gptGrist = await contextFactory.create(gptPrincipal);

const oauthMcpVerifier =
  config.mcpAuth.mode === "oauth"
    ? new JwksOAuthAccessTokenVerifier({ jwksUri: config.mcpAuth.jwksUri })
    : undefined;

function buildServer(grist: AuthorizedGristService): McpServer {
  const server = new McpServer({
    name: "grist-chatgpt",
    version: VERSION
  });

  registerCoreTools(server, grist, {
    maxReadRecords: config.maxReadRecords,
    maxWriteRecords: config.maxWriteRecords
  });
  registerSchemaTools(server, grist, config.maxSchemaItems);
  registerDiscoveryTools(server, grist);
  registerUiTools(server, grist);
  return server;
}

function buildNodeMcpHandler(grist: AuthorizedGristService) {
  return toNodeHandler(createMcpHandler(() => buildServer(grist)));
}

const staticMcpNodeHandler = staticMcpGrist
  ? buildNodeMcpHandler(staticMcpGrist)
  : undefined;

function isOAuthAuthenticationFailure(error: unknown): boolean {
  return (
    error instanceof OAuthRequestAuthenticationError ||
    error instanceof JwksAccessTokenVerifierError ||
    error instanceof OAuthAccessTokenError ||
    error instanceof OAuthPrincipalError
  );
}

function isOAuthVerifierAvailabilityFailure(error: unknown): boolean {
  return (
    error instanceof JwksAccessTokenVerifierError &&
    (error.code === "jwks_fetch_failed" || error.code === "invalid_jwks")
  );
}

function publicBaseUrl(req: { get(name: string): string | undefined; protocol: string }): string {
  const forwarded = req.get("X-Forwarded-Proto")?.split(",")[0]?.trim();
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function oauthProtectedResourceMetadataUrl(req: {
  get(name: string): string | undefined;
  protocol: string;
}): string {
  return buildOAuthProtectedResourceMetadataUrl(publicBaseUrl(req));
}

function buildExtendedOpenApiDocument(baseUrl: string): Record<string, unknown> {
  const document = buildOpenApiDocument(baseUrl, {
    maxReadRecords: config.maxReadRecords,
    maxWriteRecords: config.maxWriteRecords,
    maxSchemaItems: config.maxSchemaItems
  });
  const paths = document.paths as Record<string, unknown>;
  Object.assign(paths, buildUiOpenApiPaths());
  const documentIdParameter = {
    name: "documentId",
    in: "path",
    required: true,
    schema: { type: "string" }
  };
  const readResponses = {
    "401": { description: "Missing or invalid GPT Actions bearer token" },
    "403": { description: "Document or read capability is not allowed" },
    "502": { description: "Grist upstream error" }
  };

  paths["/api/v1/help"] = {
    get: {
      operationId: "getGristHelp",
      summary: "Discover available Grist bridge operations and required capabilities",
      "x-openai-isConsequential": false,
      responses: { "200": { description: "Operation catalog" } }
    }
  };
  paths["/api/v1/documents/{documentId}/context"] = {
    get: {
      operationId: "inspectGristDocument",
      summary: "Inspect the semantic structure and UI of a Grist document",
      description:
        "Read-only. Returns tables, columns, formulas, Ref/RefList relationships, pages and widgets without reading user-table rows.",
      "x-openai-isConsequential": false,
      parameters: [documentIdParameter],
      responses: {
        "200": { description: "Compact semantic document context" },
        ...readResponses
      }
    }
  };
  const pagesPath = (paths["/api/v1/documents/{documentId}/pages"] ?? {}) as Record<string, unknown>;
  paths["/api/v1/documents/{documentId}/pages"] = {
    ...pagesPath,
    get: {
      operationId: "getGristPages",
      summary: "List Grist pages and their widget IDs",
      description:
        "Read-only. Returns normalized page metadata without reading user-table rows.",
      "x-openai-isConsequential": false,
      parameters: [documentIdParameter],
      responses: {
        "200": { description: "Grist page metadata" },
        ...readResponses
      }
    }
  };
  const widgetsPath = (paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"] ?? {}) as Record<string, unknown>;
  paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"] = {
    ...widgetsPath,
    get: {
      operationId: "getGristPageWidgets",
      summary: "Inspect widgets on one Grist page",
      description:
        "Read-only. Returns normalized widget metadata, layout options and select-by links.",
      "x-openai-isConsequential": false,
      parameters: [
        documentIdParameter,
        {
          name: "pageId",
          in: "path",
          required: true,
          schema: { type: "integer", minimum: 1 }
        }
      ],
      responses: {
        "200": { description: "Grist page widgets" },
        ...readResponses
      }
    }
  };
  return document;
}

const app = createMcpExpressApp({
  host: config.host,
  allowedHosts: [...config.mcpAllowedHosts]
});

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "grist-chatgpt",
    version: VERSION
  });
});

if (config.mcpAuth.mode === "oauth") {
  const oauthAuth = config.mcpAuth;
  app.get(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, (_req, res) => {
    res.json(
      buildOAuthProtectedResourceMetadata({
        resource: oauthAuth.resourceUri,
        authorizationServer: oauthAuth.issuer,
        scopes: GRIST_CAPABILITIES
      })
    );
  });
}

// Register first so it shadows the compatibility OpenAPI route installed below.
app.get("/openapi.json", (req, res) => {
  res.json(buildExtendedOpenApiDocument(publicBaseUrl(req)));
});

registerGptActionApi(app, {
  token: config.gptActionToken,
  grist: gptGrist,
  maxReadRecords: config.maxReadRecords,
  maxWriteRecords: config.maxWriteRecords,
  maxSchemaItems: config.maxSchemaItems
});

registerUiActionApi(app, {
  grist: gptGrist,
  sendError: (res, error) => {
    if (error instanceof UiWriteVerificationError) {
      res.status(502).json({
        error: "Grist UI write verification failed",
        operation: error.operation,
        createdId: error.createdId,
        retryWholeOperation: false
      });
      return;
    }
    sendApiError(res, error);
  }
});

// These routes are registered after registerGptActionApi so its /api/v1 bearer
// middleware protects them as well.
app.get("/api/v1/help", (_req, res) => {
  res.json(operationHelp());
});

app.get("/api/v1/documents/:documentId/context", async (req, res) => {
  try {
    const documentId = z.string().min(1).parse(req.params.documentId);
    res.json(await gptGrist.inspectDocument(documentId));
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/v1/documents/:documentId/pages", async (req, res) => {
  try {
    const documentId = z.string().min(1).parse(req.params.documentId);
    res.json(await gptGrist.getPages(documentId));
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/v1/documents/:documentId/pages/:pageId/widgets", async (req, res) => {
  try {
    const documentId = z.string().min(1).parse(req.params.documentId);
    const pageId = z.coerce.number().int().positive().parse(req.params.pageId);
    res.json(await gptGrist.getPageWidgets(documentId, pageId));
  } catch (error) {
    sendApiError(res, error);
  }
});

app.all("/mcp", async (req, res) => {
  if (config.mcpAuth.mode === "static") {
    if (
      !isAuthorizedBearerHeader(
        req.get("Authorization"),
        config.mcpAuth.bearerToken
      )
    ) {
      res.setHeader("WWW-Authenticate", "Bearer");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!staticMcpNodeHandler) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    void staticMcpNodeHandler(req, res, req.body);
    return;
  }

  try {
    if (!oauthMcpVerifier) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const { context } = await createOAuthMcpRequestContext({
      authorizationHeader: req.get("Authorization"),
      verifier: oauthMcpVerifier,
      policy: {
        issuer: config.mcpAuth.issuer,
        audience: config.mcpAuth.resourceUri
      },
      grant: {
        documentIds: config.allowedDocumentIds,
        workspaceIds: config.allowedWorkspaceIds
      },
      contextFactory
    });

    const oauthNodeHandler = buildNodeMcpHandler(context);
    void oauthNodeHandler(req, res, req.body);
  } catch (error) {
    if (isOAuthVerifierAvailabilityFailure(error)) {
      res.status(503).json({ error: "Authorization service unavailable" });
      return;
    }

    if (isOAuthAuthenticationFailure(error)) {
      const missingBearer =
        error instanceof OAuthRequestAuthenticationError &&
        error.code === "missing_bearer";
      const resourceMetadataUrl = oauthProtectedResourceMetadataUrl(req);
      res.setHeader(
        "WWW-Authenticate",
        missingBearer
          ? buildBearerChallenge(resourceMetadataUrl)
          : buildBearerChallenge(resourceMetadataUrl, "invalid_token")
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

const httpServer = app.listen(config.port, config.host, () => {
  console.log(
    `grist-chatgpt listening on http://${config.host}:${config.port} (MCP /mcp, GPT Actions /api/v1; MCP auth ${config.mcpAuth.mode})`
  );
});

// Bound only the time allowed to receive inbound HTTP request data. These
// parser-level limits do not cap the duration of an MCP streaming response.
httpServer.requestTimeout = 120_000;
httpServer.headersTimeout = 60_000;
