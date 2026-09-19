import type { Express, Response } from "express";
import * as z from "zod/v4";

import type { PageWidgetUpdateInput } from "../grist/authorizedService.js";
import { GRIST_CHART_TYPES } from "../grist/chartTypes.js";
import {
  MAX_CUSTOM_WIDGET_MAPPED_COLUMNS,
  MAX_CUSTOM_WIDGET_MAPPING_KEYS
} from "../grist/customWidgetSettings.js";
import { GRID_ROW_NUMBER_MODES } from "../grist/gridOptions.js";
import {
  NATIVE_WIDGET_TYPES,
  type NativeWidgetType
} from "../grist/uiActionsAdapter.js";
import {
  MAX_WIDGET_SORT_COLUMNS,
  WIDGET_SORT_DIRECTIONS
} from "../grist/widgetSort.js";

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

const documentParamsSchema = z.object({ documentId: z.string().min(1) });
const pageParamsSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.coerce.number().int().positive()
});
const widgetParamsSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.coerce.number().int().positive(),
  widgetId: z.coerce.number().int().positive()
});
const createPageBodySchema = z.object({ tableId: z.string().min(1), name: z.string().trim().min(1) }).strict();
const addWidgetBodySchema = z.object({ tableId: z.string().min(1), type: z.enum(NATIVE_WIDGET_TYPES) }).strict();
const renamePageBodySchema = z.object({ name: z.string().trim().min(1) }).strict();

const widgetSortBodySchema = z.array(z.object({
  columnId: z.string().trim().min(1),
  direction: z.enum(WIDGET_SORT_DIRECTIONS),
  emptyLast: z.boolean().optional(),
  naturalSort: z.boolean().optional(),
  orderByChoice: z.boolean().optional()
}).strict()).max(MAX_WIDGET_SORT_COLUMNS);

const customWidgetMappingValueSchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1)).max(MAX_CUSTOM_WIDGET_MAPPED_COLUMNS),
  z.null()
]);
const customWidgetColumnsMappingSchema = z.record(z.string().min(1), customWidgetMappingValueSchema)
  .refine((value) => Object.keys(value).length <= MAX_CUSTOM_WIDGET_MAPPING_KEYS,
    `Custom widget mappings support at most ${MAX_CUSTOM_WIDGET_MAPPING_KEYS} keys.`);
const customWidgetSettingsUpdateSchema = z.object({
  access: z.enum(["none", "read table", "full"]).optional(),
  columnsMapping: customWidgetColumnsMappingSchema.nullable().optional()
}).strict().refine(
  (value) => value.access !== undefined || value.columnsMapping !== undefined,
  "At least one of access or columnsMapping must be supplied."
);
const gridOptionsUpdateSchema = z.object({
  verticalGridlines: z.boolean().optional(),
  horizontalGridlines: z.boolean().optional(),
  zebraStripes: z.boolean().optional(),
  rowNumbers: z.enum(GRID_ROW_NUMBER_MODES).optional()
}).strict().refine(
  (value) => value.verticalGridlines !== undefined || value.horizontalGridlines !== undefined ||
    value.zebraStripes !== undefined || value.rowNumbers !== undefined,
  "At least one grid display option must be supplied."
);

const updateWidgetBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  chartType: z.enum(GRIST_CHART_TYPES).optional(),
  sort: widgetSortBodySchema.nullable().optional(),
  selectBy: z.object({
    sourceWidgetId: z.number().int().positive(),
    sourceColumnId: z.string().min(1).optional(),
    targetColumnId: z.string().min(1).optional()
  }).strict().nullable().optional(),
  customWidgetSettings: customWidgetSettingsUpdateSchema.optional(),
  gridOptions: gridOptionsUpdateSchema.optional()
}).strict().refine(
  (value) => value.title !== undefined || value.description !== undefined ||
    value.chartType !== undefined || value.sort !== undefined || value.selectBy !== undefined ||
    value.customWidgetSettings !== undefined || value.gridOptions !== undefined,
  { message: "At least one bounded widget field must be supplied." }
);

export function buildUiOpenApiPaths(): Record<string, unknown> {
  const documentIdParameter = { name: "documentId", in: "path", required: true,
    description: "Exact allowed Grist document ID supplied by the user or returned by listGristDocuments. Never invent, guess, shorten or substitute this identifier.",
    schema: { type: "string" } };
  const pageIdParameter = { name: "pageId", in: "path", required: true,
    description: "Exact existing Grist page ID returned by getGristPages. Never invent or guess a page ID.",
    schema: { type: "integer", minimum: 1 } };
  const widgetIdParameter = { name: "widgetId", in: "path", required: true,
    description: "Exact existing Grist widget ID returned by getGristPageWidgets. Never invent or guess a widget ID.",
    schema: { type: "integer", minimum: 1 } };
  const writeResponses = {
    "400": { description: "Invalid page or widget request" },
    "401": { description: "Missing or invalid GPT Actions bearer token" },
    "403": { description: "Document or structure-write capability is not allowed" },
    "404": { description: "Explicitly identified page or widget does not exist" },
    "502": { description: "Grist upstream error or post-write verification failure" }
  };
  return {
    "/api/v1/documents/{documentId}/pages": { post: {
      operationId: "createGristPage", summary: "Create an empty named Grist page",
      description: "Creates one empty page using the bounded Grist AddView UserAction. A table ID is required only as the Grist AddView anchor; the page initially contains no widget.",
      "x-openai-isConsequential": true, parameters: [documentIdParameter],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["tableId", "name"],
        properties: { tableId: { type: "string", minLength: 1 }, name: { type: "string", minLength: 1 } }
      } } } }, responses: { "200": { description: "Created and re-read page" }, ...writeResponses }
    } },
    "/api/v1/documents/{documentId}/pages/{pageId}": { patch: {
      operationId: "renameGristPage", summary: "Rename one existing Grist page",
      description: "Renames exactly one page through a bounded metadata UpdateRecord, then re-reads the page and verifies the requested name.",
      "x-openai-isConsequential": true, parameters: [documentIdParameter, pageIdParameter],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string", minLength: 1 } }
      } } } }, responses: { "200": { description: "Renamed and re-read page" }, ...writeResponses }
    } },
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets": { post: {
      operationId: "addGristPageWidget", summary: "Add one native widget to an existing Grist page",
      description: "Adds exactly one widget using the bounded Grist CreateViewSection UserAction, then re-reads the page to verify the created section.",
      "x-openai-isConsequential": true, parameters: [documentIdParameter, pageIdParameter],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["tableId", "type"],
        properties: { tableId: { type: "string", minLength: 1 }, type: { type: "string", enum: [...NATIVE_WIDGET_TYPES] } }
      } } } }, responses: { "200": { description: "Created and re-read page widget" }, ...writeResponses }
    } },
    "/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}": { patch: {
      operationId: "updateGristPageWidget",
      summary: "Update bounded metadata, grid/custom settings, saved sort or an explicit supported select-by link on one Grist widget",
      description: "Updates only bounded widget metadata. gridOptions is accepted only for a Table widget (`record`) and changes only vertical/horizontal gridlines, zebra stripes and the row-number mode using the same values exposed by Grist's Grid Options panel. customWidgetSettings remains limited to access plus stable-ID column mappings. Existing untargeted options are preserved and the complete expected options object is verified after write.",
      "x-openai-isConsequential": true, parameters: [documentIdParameter, pageIdParameter, widgetIdParameter],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, minProperties: 1,
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Widget description. Surrounding whitespace is trimmed; an empty string clears the description." },
          chartType: { type: "string", enum: [...GRIST_CHART_TYPES], description: "Native Grist chart type. Accepted only when the explicitly identified target widget is a chart." },
          sort: { anyOf: [{ type: "array", maxItems: MAX_WIDGET_SORT_COLUMNS, items: { type: "object", additionalProperties: false, required: ["columnId", "direction"], properties: {
            columnId: { type: "string", minLength: 1 }, direction: { type: "string", enum: [...WIDGET_SORT_DIRECTIONS] },
            emptyLast: { type: "boolean" }, naturalSort: { type: "boolean" }, orderByChoice: { type: "boolean" }
          } } }, { type: "null" }] },
          selectBy: { anyOf: [{ type: "object", additionalProperties: false, required: ["sourceWidgetId"], properties: {
            sourceWidgetId: { type: "integer", minimum: 1 }, sourceColumnId: { type: "string", minLength: 1 }, targetColumnId: { type: "string", minLength: 1 }
          } }, { type: "null" }] },
          customWidgetSettings: { type: "object", additionalProperties: false, minProperties: 1, properties: {
            access: { type: "string", enum: ["none", "read table", "full"] },
            columnsMapping: { anyOf: [{ type: "object", maxProperties: MAX_CUSTOM_WIDGET_MAPPING_KEYS,
              additionalProperties: { anyOf: [{ type: "string", minLength: 1 }, { type: "array", maxItems: MAX_CUSTOM_WIDGET_MAPPED_COLUMNS, items: { type: "string", minLength: 1 } }, { type: "null" }] }
            }, { type: "null" }] }
          } },
          gridOptions: { type: "object", additionalProperties: false, minProperties: 1,
            description: "Bounded display options for an explicitly identified Table widget only.", properties: {
              verticalGridlines: { type: "boolean" }, horizontalGridlines: { type: "boolean" }, zebraStripes: { type: "boolean" },
              rowNumbers: { type: "string", enum: [...GRID_ROW_NUMBER_MODES], description: "number = position numbers, rowId = bracketed record IDs, hidden = collapse the row-number gutter." }
            }
          }
        }
      } } } }, responses: { "200": { description: "Updated and re-read page widget" }, ...writeResponses }
    } }
  };
}

export function registerUiActionApi(app: Express, options: { grist: GristUiOperations; sendError: (res: Response, error: unknown) => void }): void {
  app.post("/api/v1/documents/:documentId/pages", async (req, res) => {
    try { const { documentId } = documentParamsSchema.parse(req.params); const { tableId, name } = createPageBodySchema.parse(req.body); res.json(await options.grist.createPage(documentId, tableId, name)); }
    catch (error) { options.sendError(res, error); }
  });
  app.patch("/api/v1/documents/:documentId/pages/:pageId", async (req, res) => {
    try { const { documentId, pageId } = pageParamsSchema.parse(req.params); const { name } = renamePageBodySchema.parse(req.body); res.json(await options.grist.renamePage(documentId, pageId, name)); }
    catch (error) { options.sendError(res, error); }
  });
  app.post("/api/v1/documents/:documentId/pages/:pageId/widgets", async (req, res) => {
    try { const { documentId, pageId } = pageParamsSchema.parse(req.params); const { tableId, type } = addWidgetBodySchema.parse(req.body); res.json(await options.grist.addPageWidget(documentId, pageId, tableId, type)); }
    catch (error) { options.sendError(res, error); }
  });
  app.patch("/api/v1/documents/:documentId/pages/:pageId/widgets/:widgetId", async (req, res) => {
    try {
      const { documentId, pageId, widgetId } = widgetParamsSchema.parse(req.params);
      const parsed = updateWidgetBodySchema.parse(req.body);
      const update: PageWidgetUpdateInput = {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.chartType !== undefined ? { chartType: parsed.chartType } : {}),
        ...(parsed.sort !== undefined ? { sort: parsed.sort } : {}),
        ...(parsed.selectBy !== undefined ? { selectBy: parsed.selectBy } : {}),
        ...(parsed.customWidgetSettings !== undefined ? { customWidgetSettings: parsed.customWidgetSettings } : {}),
        ...(parsed.gridOptions !== undefined ? { gridOptions: parsed.gridOptions } : {})
      };
      res.json(await options.grist.updatePageWidget(documentId, pageId, widgetId, update));
    } catch (error) { options.sendError(res, error); }
  });
}
