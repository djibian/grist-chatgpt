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
import { AuthorizationService } from "./auth/authorizationService.js";
import { createPrincipal } from "./auth/principal.js";
import { isAuthorizedBearerHeader } from "./auth/staticBearer.js";
import { loadConfig } from "./config.js";
import { AccessPolicy } from "./grist/accessPolicy.js";
import { AuthorizedGristService } from "./grist/authorizedService.js";
import { GristClient } from "./grist/client.js";
import { GristService } from "./grist/service.js";
import {
  GristUiActionsAdapter,
  UiWriteVerificationError
} from "./grist/uiActionsAdapter.js";
import { registerCoreTools } from "./mcp/coreTools.js";
import { registerDiscoveryTools } from "./mcp/discoveryTools.js";
import { registerSchemaTools } from "./mcp/schemaTools.js";
import { registerUiTools } from "./mcp/uiTools.js";
import { operationHelp } from "./operations/registry.js";
import { VERSION } from "./version.js";

const config = loadConfig();
const client = new GristClient({
  baseUrl: config.gristBaseUrl,
  apiKey: config.gristApiKey
});
const accessPolicy = new AccessPolicy(client, {
  allowedDocumentIds: config.allowedDocumentIds,
  allowedWorkspaceIds: config.allowedWorkspaceIds
});
const baseGrist = new GristService(client, accessPolicy, {
  maxReadRecords: config.maxReadRecords,
  maxWriteRecords: config.maxWriteRecords,
  writeBatchRecords: config.writeBatchRecords,
  maxSchemaItems: config.maxSchemaItems
});
const uiActions = new GristUiActionsAdapter(client);
const authorization = new AuthorizationService(accessPolicy);
const audit = new AuditLogger();

const mcpPrincipal = createPrincipal({
  id: "mcp-client",
  transport: "mcp",
  documentIds: config.allowedDocumentIds,
  workspaceIds: config.allowedWorkspaceIds,
  capabilities: config.mcpCapabilities
});
const gptPrincipal = createPrincipal({
  id: "chatgpt-actions",
  transport: "gpt-actions",
  documentIds: config.allowedDocumentIds,
  workspaceIds: config.allowedWorkspaceIds,
  capabilities: config.gptActionCapabilities
});

const mcpGrist = new AuthorizedGristService(
  baseGrist,
  authorization,
  audit,
  mcpPrincipal,
  uiActions
);
const gptGrist = new AuthorizedGristService(
  baseGrist,
  authorization,
  audit,
  gptPrincipal,
  uiActions
);

function buildServer(): McpServer {
  const server = new McpServer({
    name: "grist-chatgpt",
    version: VERSION
  });

  registerCoreTools(server, mcpGrist, {
    maxReadRecords: config.maxReadRecords,
    maxWriteRecords: config.maxWriteRecords
  });
  registerSchemaTools(server, mcpGrist, config.maxSchemaItems);
  registerDiscoveryTools(server, mcpGrist);
  registerUiTools(server, mcpGrist);
  return server;
}

function publicBaseUrl(req: { get(name: string): string | undefined; protocol: string }): string {
  const forwarded = req.get("X-Forwarded-Proto")?.split(",")[0]?.trim();
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
  return `${protocol}://${req.get("host")}`;
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

const handler = createMcpHandler(() => buildServer());
const nodeHandler = toNodeHandler(handler);
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

app.all("/mcp", (req, res) => {
  if (
    !isAuthorizedBearerHeader(req.get("Authorization"), config.mcpBearerToken)
  ) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  void nodeHandler(req, res, req.body);
});

app.listen(config.port, config.host, () => {
  console.log(
    `grist-chatgpt listening on http://${config.host}:${config.port} (MCP /mcp, GPT Actions /api/v1)`
  );
});
