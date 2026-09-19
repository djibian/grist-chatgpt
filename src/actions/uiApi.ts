import type { Express, Response } from "express";
import * as z from "zod/v4";

import type { PageWidgetUpdateInput } from "../grist/authorizedService.js";
import { GRIST_CHART_TYPES } from "../grist/chartTypes.js";
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
  renamePage(documentId: string, pageId: number, name: string): Promise<unknown>;
  updatePageWidget(
    documentId: string,
    pageId: number,
    widgetId: number,
    update: PageWidgetUpdateInput
  ): Promise<unknown>;
}

const documentParamsSchema = z.object({
  documentId: z.string().min(1)
});

const pageParamsSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.coerce.number().int().positive()
});

const widgetParamsSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.coerce.number().int().positive(),
  widgetId: z.coerce.number().int().positive()
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

const renamePageBodySchema = z
  .object({
    name: z.string().trim().min(1)
  })
  .strict();

const updateWidgetBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    chartType: z.enum(GRIST_CHART_TYPES).optional(),
    selectBy: z
      .object({
        sourceWidgetId: z.number().int().positive(),
        sourceColumnId: z.string().min(1).optional(),
        targetColumnId: z.string().min(1).optional()
      })
      .strict()
      .nullable()
      .optional()
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.chartType !== undefined ||
      value.selectBy !== undefined,
    {
      message:
        "At least one of title, description, chartType or selectBy must be supplied."
    }
  );

export function buildUiOpenApiPaths(): Record<string, unknown> {
  const documentIdParameter = {
    name: "documentId",
    in: "path",
    required: true,
    description:
      "Exact allowed Grist document ID supplied by the user or returned by listGristDocuments. Never invent, guess, shorten or substitute this identifier.",
    schema: { type: "string" }
  };
  const pageIdParameter = {
    name: "pageId",
    in: "path",
    required: true,
    description:
      "Exact existing Grist page ID returned by getGristPages. Never invent or guess a page ID.",
    schema: { type: "integer", minimum: 1 }
  };
  const widgetIdParameter = {
    name: "widgetId",
    in: "path",
    required: true,
    description:
      "Exact existing Grist widget ID returned by getGristPageWidgets. Never invent or guess a widget ID.",
    schema: { type: "integer", minimum: 1 }
  };
  const writeResponses = {
    "400": { description: "Invalid page or widget request" },
    "401": { description: "Missing or invalid GPT Actions bearer token" },
    "403": { description: "Document or structure-write capability is not allowed" },
    "404": { description: "Explicitly identified page or widget does not exist" },
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
    "/api/v1/documents/{documentId}/pages/{pageId}": {
      patch: {
        operationId: "renameGristPage",
        summary: "Rename one existing Grist page",
        description:
          "Renames exactly one page through a bounded metadata UpdateRecord, then re-reads the page and verifies the requested name.",
        "x-openai-isConsequential": true,
        parameters: [documentIdParameter, pageIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1 }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Renamed and re-read page" },
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
    },
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}": {
      patch: {
        operationId: "updateGristPageWidget",
        summary:
          "Update bounded metadata or an explicit supported select-by link on one Grist widget",
        description:
          "Updates only bounded widget metadata. title and description are normalized by trimming surrounding whitespace; an empty description clears it. chartType accepts only the native Grist chart types and is allowed only when the target widget is a chart. selectBy may use a direct sourceWidgetId from directSelectByOptions, or an exact sourceWidgetId/sourceColumnId/targetColumnId combination returned by columnSelectByOptions; null clears the link. Ref/RefList column links are limited to the bridge's non-summary, non-attachment, non-custom safe subset and are revalidated against current metadata before write.",
        "x-openai-isConsequential": true,
        parameters: [documentIdParameter, pageIdParameter, widgetIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                minProperties: 1,
                properties: {
                  title: { type: "string" },
                  description: {
                    type: "string",
                    description:
                      "Widget description. Surrounding whitespace is trimmed; an empty string clears the description."
                  },
                  chartType: {
                    type: "string",
                    enum: [...GRIST_CHART_TYPES],
                    description:
                      "Native Grist chart type. Accepted only when the explicitly identified target widget is a chart."
                  },
                  selectBy: {
                    anyOf: [
                      {
                        type: "object",
                        additionalProperties: false,
                        required: ["sourceWidgetId"],
                        properties: {
                          sourceWidgetId: {
                            type: "integer",
                            minimum: 1,
                            description:
                              "Exact source widget ID returned by getGristPageWidgets for the same page. Never invent or guess it."
                          },
                          sourceColumnId: {
                            type: "string",
                            minLength: 1,
                            description:
                              "Optional exact Ref/RefList source column ID from columnSelectByOptions. Omit for the source widget's own table."
                          },
                          targetColumnId: {
                            type: "string",
                            minLength: 1,
                            description:
                              "Optional exact Ref/RefList target column ID from columnSelectByOptions. Omit for the target widget's own table."
                          }
                        }
                      },
                      { type: "null" }
                    ]
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated and re-read page widget" },
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

  app.patch("/api/v1/documents/:documentId/pages/:pageId", async (req, res) => {
    try {
      const { documentId, pageId } = pageParamsSchema.parse(req.params);
      const { name } = renamePageBodySchema.parse(req.body);
      res.json(await options.grist.renamePage(documentId, pageId, name));
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

  app.patch(
    "/api/v1/documents/:documentId/pages/:pageId/widgets/:widgetId",
    async (req, res) => {
      try {
        const { documentId, pageId, widgetId } = widgetParamsSchema.parse(req.params);
        const parsed = updateWidgetBodySchema.parse(req.body);
        const update: PageWidgetUpdateInput = {
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined
            ? { description: parsed.description }
            : {}),
          ...(parsed.chartType !== undefined ? { chartType: parsed.chartType } : {}),
          ...(parsed.selectBy !== undefined ? { selectBy: parsed.selectBy } : {})
        };
        res.json(
          await options.grist.updatePageWidget(documentId, pageId, widgetId, update)
        );
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );
}
