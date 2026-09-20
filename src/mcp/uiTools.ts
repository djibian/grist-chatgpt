import type { McpServer } from "@modelcontextprotocol/server";
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

const widgetSortSchema = z
  .array(
    z
      .object({
        columnId: z.string().trim().min(1),
        direction: z.enum(WIDGET_SORT_DIRECTIONS),
        emptyLast: z.boolean().optional(),
        naturalSort: z.boolean().optional(),
        orderByChoice: z.boolean().optional()
      })
      .strict()
  )
  .max(MAX_WIDGET_SORT_COLUMNS);

const customWidgetMappingValueSchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1)).max(MAX_CUSTOM_WIDGET_MAPPED_COLUMNS),
  z.null()
]);

const customWidgetColumnsMappingSchema = z
  .record(z.string().min(1), customWidgetMappingValueSchema)
  .refine(
    (value) => Object.keys(value).length <= MAX_CUSTOM_WIDGET_MAPPING_KEYS,
    `Custom widget mappings support at most ${MAX_CUSTOM_WIDGET_MAPPING_KEYS} keys.`
  );

const customWidgetSettingsUpdateSchema = z
  .object({
    access: z.enum(["none", "read table", "full"]).optional(),
    columnsMapping: customWidgetColumnsMappingSchema.nullable().optional()
  })
  .strict()
  .refine(
    (value) => value.access !== undefined || value.columnsMapping !== undefined,
    "At least one of access or columnsMapping must be supplied."
  );

const gridOptionsUpdateSchema = z
  .object({
    verticalGridlines: z.boolean().optional(),
    horizontalGridlines: z.boolean().optional(),
    zebraStripes: z.boolean().optional(),
    rowNumbers: z.enum(GRID_ROW_NUMBER_MODES).optional()
  })
  .strict()
  .refine(
    (value) =>
      value.verticalGridlines !== undefined ||
      value.horizontalGridlines !== undefined ||
      value.zebraStripes !== undefined ||
      value.rowNumbers !== undefined,
    "At least one grid display option must be supplied."
  );

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
        sort: widgetSortSchema.nullable().optional(),
        selectBy: z
          .object({
            sourceWidgetId: z.number().int().positive(),
            sourceColumnId: z.string().min(1).optional(),
            targetColumnId: z.string().min(1).optional()
          })
          .strict()
          .nullable()
          .optional(),
        customWidgetSettings: customWidgetSettingsUpdateSchema.optional(),
        gridOptions: gridOptionsUpdateSchema.optional()
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
      sort,
      selectBy,
      customWidgetSettings,
      gridOptions
    }) => {
      try {
        if (
          title === undefined &&
          description === undefined &&
          chartType === undefined &&
          sort === undefined &&
          selectBy === undefined &&
          customWidgetSettings === undefined &&
          gridOptions === undefined
        ) {
          throw new Error(
            "At least one of title, description, chartType, sort, selectBy, customWidgetSettings or gridOptions must be supplied."
          );
        }
        const normalizedCustomWidgetSettings =
          customWidgetSettings === undefined
            ? undefined
            : {
                ...(customWidgetSettings.access !== undefined
                  ? { access: customWidgetSettings.access }
                  : {}),
                ...(customWidgetSettings.columnsMapping !== undefined
                  ? { columnsMapping: customWidgetSettings.columnsMapping }
                  : {})
              };
        const normalizedGridOptions =
          gridOptions === undefined
            ? undefined
            : {
                ...(gridOptions.verticalGridlines !== undefined
                  ? { verticalGridlines: gridOptions.verticalGridlines }
                  : {}),
                ...(gridOptions.horizontalGridlines !== undefined
                  ? { horizontalGridlines: gridOptions.horizontalGridlines }
                  : {}),
                ...(gridOptions.zebraStripes !== undefined
                  ? { zebraStripes: gridOptions.zebraStripes }
                  : {}),
                ...(gridOptions.rowNumbers !== undefined
                  ? { rowNumbers: gridOptions.rowNumbers }
                  : {})
              };
        const update: PageWidgetUpdateInput = {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(chartType !== undefined ? { chartType } : {}),
          ...(sort !== undefined ? { sort } : {}),
          ...(selectBy !== undefined ? { selectBy } : {}),
          ...(normalizedCustomWidgetSettings !== undefined
            ? { customWidgetSettings: normalizedCustomWidgetSettings }
            : {}),
          ...(normalizedGridOptions !== undefined
            ? { gridOptions: normalizedGridOptions }
            : {})
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
