import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { PageWidgetUpdateInput } from "../grist/authorizedService.js";
import {
  NATIVE_WIDGET_TYPES,
  UiWriteVerificationError,
  type NativeWidgetType
} from "../grist/uiActionsAdapter.js";

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

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function errorResult(error: unknown) {
  const body = error instanceof UiWriteVerificationError
    ? {
        error: "Grist UI write verification failed",
        operation: error.operation,
        ...(error.createdId !== undefined ? { createdId: error.createdId } : {}),
        retryWholeOperation: false
      }
    : {
        error: error instanceof Error ? error.message : String(error)
      };

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(body)
      }
    ]
  };
}

export function registerUiTools(server: McpServer, grist: UiOperations): void {
  server.registerTool(
    "create_page",
    {
      description:
        "Create one empty named Grist page using a bounded AddView UserAction. The page initially contains no widget; add widgets separately.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        name: z.string().trim().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, name }) => {
      try {
        return textResult(await grist.createPage(documentId, tableId, name));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "add_page_widget",
    {
      description:
        "Add exactly one native Grist widget to an existing page using a bounded CreateViewSection UserAction, with post-write re-read verification.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        tableId: z.string().min(1),
        type: z.enum(NATIVE_WIDGET_TYPES)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, pageId, tableId, type }) => {
      try {
        return textResult(
          await grist.addPageWidget(documentId, pageId, tableId, type)
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "rename_page",
    {
      description:
        "Rename exactly one existing Grist page through a bounded metadata update, with post-write re-read verification.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        name: z.string().trim().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, pageId, name }) => {
      try {
        return textResult(await grist.renamePage(documentId, pageId, name));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_page_widget",
    {
      description:
        "Update one widget title and/or a safe direct select-by link. Direct select-by is limited to another widget on the same page backed by the same table; null clears the link.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive(),
        widgetId: z.number().int().positive(),
        title: z.string().optional(),
        selectBy: z
          .object({ sourceWidgetId: z.number().int().positive() })
          .strict()
          .nullable()
          .optional()
      }).refine((value) => value.title !== undefined || value.selectBy !== undefined, {
        message: "At least one of title or selectBy must be supplied."
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, pageId, widgetId, title, selectBy }) => {
      try {
        const update: PageWidgetUpdateInput = {
          ...(title !== undefined ? { title } : {}),
          ...(selectBy !== undefined ? { selectBy } : {})
        };
        return textResult(
          await grist.updatePageWidget(documentId, pageId, widgetId, update)
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
