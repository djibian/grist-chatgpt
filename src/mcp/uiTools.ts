import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  NATIVE_WIDGET_TYPES,
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
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error)
        })
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
}
