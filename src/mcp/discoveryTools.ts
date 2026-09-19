import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getMcpToolMetadata } from "../operations/registry.js";
import { progressiveOperationHelp } from "../operations/progressiveHelp.js";
import {
  pageWidgetsOutputSchema,
  pagesOutputSchema
} from "./outputSchemas.js";
import { errorResult, structuredResult, textResult } from "./results.js";

interface ContextOperations {
  inspectDocument(documentId: string): Promise<unknown>;
  getPages(documentId: string): Promise<unknown>;
  getPageWidgets(documentId: string, pageId: number): Promise<unknown>;
}

const helpInputSchema = z
  .object({
    operations: z.array(z.string().min(1)).max(20).optional(),
    category: z
      .enum(["discovery", "data", "schema", "context", "ui", "utility"])
      .optional(),
    includeWorkflows: z.boolean().default(false)
  })
  .refine(
    ({ operations, category }) => !(operations && category),
    "Filter Grist help by operations or category, not both."
  );

export function registerDiscoveryTools(
  server: McpServer,
  grist: ContextOperations
): void {
  server.registerTool(
    "grist_help",
    {
      ...getMcpToolMetadata("grist_help"),
      inputSchema: helpInputSchema
    },
    async ({ operations, category, includeWorkflows }) => {
      try {
        return textResult(
          progressiveOperationHelp({
            ...(operations ? { operations } : {}),
            ...(category ? { category } : {}),
            includeWorkflows
          })
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "inspect_document",
    {
      ...getMcpToolMetadata("inspect_document"),
      inputSchema: z.object({ documentId: z.string().min(1) })
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
      ...getMcpToolMetadata("get_pages"),
      inputSchema: z.object({ documentId: z.string().min(1) }),
      outputSchema: pagesOutputSchema
    },
    async ({ documentId }) => {
      try {
        const output = pagesOutputSchema.parse(await grist.getPages(documentId));
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_page_widgets",
    {
      ...getMcpToolMetadata("get_page_widgets"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        pageId: z.number().int().positive()
      }),
      outputSchema: pageWidgetsOutputSchema
    },
    async ({ documentId, pageId }) => {
      try {
        const output = pageWidgetsOutputSchema.parse(
          await grist.getPageWidgets(documentId, pageId)
        );
        return structuredResult(output);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
