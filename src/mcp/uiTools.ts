import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { PageWidgetUpdateInput } from "../grist/authorizedService.js";
import { GRIST_CHART_TYPES } from "../grist/chartTypes.js";
import {
  NATIVE_WIDGET_TYPES,
  type NativeWidgetType
} from "../grist/uiActionsAdapter.js";
import { getMcpToolMetadata } from "../operations/registry.js";
import {
  pageMutationOutputSchema,
  widgetMutationOutputSchema
} from "./outputSchemas.js";
import { errorResult, structuredResult } from "./results.js";

interface UiOperations {
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

export function registerUiTools(server: McpServer, grist: UiOperations): void {
  server.registerTool(
    "create_page",
    {
      ...getMcpToolMetadata("create_page"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        name: z.string().trim().min(1)
      }),
      outputSchema: pageMutationOutputSchema
    },
    async ({ documentId, tableId, name }) => {
      try {
        const output = pageMutationOutputSchema.parse(
          await grist.createPage(documentId, tableId, name)
        );
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "add_page_widget",
    {
      ...getMcpToolMetadata("add_page_widget"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        tableId: z.string().min(1),
        type: z.enum(NATIVE_WIDGET_TYPES)
      }),
      outputSchema: widgetMutationOutputSchema
    },
    async ({ documentId, pageId, tableId, type }) => {
      try {
        const output = widgetMutationOutputSchema.parse(
          await grist.addPageWidget(documentId, pageId, tableId, type)
        );
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "rename_page",
    {
      ...getMcpToolMetadata("rename_page"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        name: z.string().trim().min(1)
      }),
      outputSchema: pageMutationOutputSchema
    },
    async ({ documentId, pageId, name }) => {
      try {
        const output = pageMutationOutputSchema.parse(
          await grist.renamePage(documentId, pageId, name)
        );
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_page_widget",
    {
      ...getMcpToolMetadata("update_page_widget"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        widgetId: z.number().int().positive(),
        title: z.string().optional(),
        description: z.string().optional(),
        chartType: z.enum(GRIST_CHART_TYPES).optional(),
        selectBy: z
          .object({ sourceWidgetId: z.number().int().positive() })
          .strict()
          .nullable()
          .optional()
      }),
      outputSchema: widgetMutationOutputSchema
    },
    async ({
      documentId,
      pageId,
      widgetId,
      title,
      description,
      chartType,
      selectBy
    }) => {
      try {
        if (
          title === undefined &&
          description === undefined &&
          chartType === undefined &&
          selectBy === undefined
        ) {
          throw new Error(
            "At least one of title, description, chartType or selectBy must be supplied."
          );
        }
        const update: PageWidgetUpdateInput = {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(chartType !== undefined ? { chartType } : {}),
          ...(selectBy !== undefined ? { selectBy } : {})
        };
        const output = widgetMutationOutputSchema.parse(
          await grist.updatePageWidget(documentId, pageId, widgetId, update)
        );
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
