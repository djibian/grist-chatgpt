import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { operationHelp } from "../operations/registry.js";

interface ContextOperations {
  inspectDocument(documentId: string): Promise<unknown>;
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
        "Inspect one allowed Grist document before complex work. Returns a compact semantic context with tables, columns, formulas and Ref/RefList relationships, without reading table rows.",
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
}
