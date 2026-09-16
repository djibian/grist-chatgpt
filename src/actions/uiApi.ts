import type { Express, Response } from "express";
import * as z from "zod/v4";

import {
  NATIVE_WIDGET_TYPES,
  type NativeWidgetType
} from "../grist/uiActionsAdapter.js";

export interface GristUiOperations {
  createPage(documentId: string, tableId: string, name: string): Promise<unknown>;
  addPageWidget(
    documentId: string,
    pageId: number,
    tableId: string,
    type: NativeWidgetType
  ): Promise<unknown>;
}

const documentParamsSchema = z.object({
  documentId: z.string().min(1)
});

const pageParamsSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.coerce.number().int().positive()
});

const createPageBodySchema = z
  .object({
    tableId: z.string().min(1),
    name: z.string().trim().min(1)
  })
  .strict();

const addWidgetBodySchema = z
  .object({
    tableId: z.string().min(1),
    type: z.enum(NATIVE_WIDGET_TYPES)
  })
  .strict();

export function buildUiOpenApiPaths(): Record<string, unknown> {
  const documentIdParameter = {
    name: "documentId",
    in: "path",
    required: true,
    schema: { type: "string" }
  };
  const pageIdParameter = {
    name: "pageId",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 }
  };
  const writeResponses = {
    "400": { description: "Invalid page or widget request" },
    "401": { description: "Missing or invalid GPT Actions bearer token" },
    "403": { description: "Document or structure-write capability is not allowed" },
    "502": { description: "Grist upstream error or post-write verification failure" }
  };

  return {
    "/api/v1/documents/{documentId}/pages": {
      post: {
        operationId: "createGristPage",
        summary: "Create an empty named Grist page",
        description:
          "Creates one empty page using the bounded Grist AddView UserAction. A table ID is required only as the Grist AddView anchor; the page initially contains no widget.",
        "x-openai-isConsequential": true,
        parameters: [documentIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["tableId", "name"],
                properties: {
                  tableId: { type: "string", minLength: 1 },
                  name: { type: "string", minLength: 1 }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Created and re-read page" },
          ...writeResponses
        }
      }
    },
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets": {
      post: {
        operationId: "addGristPageWidget",
        summary: "Add one native widget to an existing Grist page",
        description:
          "Adds exactly one widget using the bounded Grist CreateViewSection UserAction, then re-reads the page to verify the created section.",
        "x-openai-isConsequential": true,
        parameters: [documentIdParameter, pageIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["tableId", "type"],
                properties: {
                  tableId: { type: "string", minLength: 1 },
                  type: {
                    type: "string",
                    enum: [...NATIVE_WIDGET_TYPES]
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Created and re-read page widget" },
          ...writeResponses
        }
      }
    }
  };
}

export function registerUiActionApi(
  app: Express,
  options: {
    grist: GristUiOperations;
    sendError: (res: Response, error: unknown) => void;
  }
): void {
  app.post("/api/v1/documents/:documentId/pages", async (req, res) => {
    try {
      const { documentId } = documentParamsSchema.parse(req.params);
      const { tableId, name } = createPageBodySchema.parse(req.body);
      res.json(await options.grist.createPage(documentId, tableId, name));
    } catch (error) {
      options.sendError(res, error);
    }
  });

  app.post(
    "/api/v1/documents/:documentId/pages/:pageId/widgets",
    async (req, res) => {
      try {
        const { documentId, pageId } = pageParamsSchema.parse(req.params);
        const { tableId, type } = addWidgetBodySchema.parse(req.body);
        res.json(
          await options.grist.addPageWidget(documentId, pageId, tableId, type)
        );
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );
}
