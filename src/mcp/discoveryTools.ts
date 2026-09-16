import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { operationHelp } from "../operations/registry.js";

interface ContextOperations {
  inspectDocument(documentId: string): Promise<unknown>;
  getPages(documentId: string): Promise<unknown>;
  getPageWidgets(documentId: string, pageId: number): Promise<unknown>;
}

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      }
    ]
  };
}

export function registerDiscoveryTools(
  server: McpServer,
  grist: ContextOperations
): void {
  server.registerTool(
    "grist_help",
    {
      description:
        "Discover bridge operations and required capabilities. Omit operations to list the complete operation catalog.",
      inputSchema: z.object({
        operations: z.array(z.string().min(1)).max(20).optional()
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ operations }) => {
      try {
        return textResult(operationHelp(operations));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "inspect_document",
    {
      description:
        "Inspect one allowed Grist document before complex work. Returns compact semantic context for tables, columns, formulas, Ref/RefList relationships, pages and widgets, without reading user-table rows.",
      inputSchema: z.object({ documentId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId }) => {
      try {
        return textResult(await grist.inspectDocument(documentId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_pages",
    {
      description:
        "List pages in one allowed Grist document, including page IDs, names, layout metadata and widget IDs, without reading user-table rows.",
      inputSchema: z.object({ documentId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId }) => {
      try {
        return textResult(await grist.getPages(documentId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_page_widgets",
    {
      description:
        "Inspect the widgets of one Grist page, including widget type, table, title, options, layout metadata and select-by links.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive()
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, pageId }) => {
      try {
        return textResult(await grist.getPageWidgets(documentId, pageId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
