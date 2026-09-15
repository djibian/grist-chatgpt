import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { GristService } from "../grist/service.js";

type SchemaOperations = Pick<
  GristService,
  | "listColumns"
  | "createTables"
  | "updateTables"
  | "deleteTable"
  | "createColumns"
  | "updateColumns"
  | "renameColumn"
  | "deleteColumns"
>;

function boundedArray<T extends z.ZodType>(schema: T, max: number) {
  let result = z.array(schema).min(1);
  if (max > 0) result = result.max(max);
  return result;
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

export function registerSchemaTools(
  server: McpServer,
  grist: SchemaOperations,
  maxSchemaItems: number
): void {
  const fieldsSchema = z.record(z.string(), z.unknown());
  const columnSpecSchema = z.object({
    id: z.string().min(1),
    fields: fieldsSchema.optional()
  });
  const columnUpdateSchema = z.object({
    id: z.string().min(1),
    fields: fieldsSchema
  });
  const tableSpecSchema = z.object({
    id: z.string().min(1),
    columns: boundedArray(columnSpecSchema, maxSchemaItems).optional()
  });
  const tableUpdateSchema = z.object({
    id: z.string().min(1),
    fields: fieldsSchema
  });

  server.registerTool(
    "list_columns",
    {
      description:
        "List columns and metadata for an allowed Grist table, including types, formulas and widget options.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        hidden: z.boolean().default(false)
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, hidden }) => {
      try {
        return textResult(await grist.listColumns(documentId, tableId, { hidden }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "create_tables",
    {
      description:
        "Create Grist tables, optionally with initial columns. This changes document structure.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tables: boundedArray(tableSpecSchema, maxSchemaItems)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tables }) => {
      try {
        return textResult(await grist.createTables(documentId, tables));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_tables",
    {
      description:
        "Update Grist table metadata. fields may include tableId to rename a table or onDemand to change loading mode.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tables: boundedArray(tableUpdateSchema, maxSchemaItems)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tables }) => {
      try {
        return textResult(await grist.updateTables(documentId, tables));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "delete_table",
    {
      description:
        "Delete one explicitly identified Grist table. Inspect and present the exact target before invoking this destructive action.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId }) => {
      try {
        return textResult(await grist.deleteTable(documentId, tableId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "create_columns",
    {
      description:
        "Create columns in a Grist table. fields may include label, type, formula, isFormula, visibleCol, widgetOptions and other Grist metadata.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columns: boundedArray(columnSpecSchema, maxSchemaItems)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, columns }) => {
      try {
        return textResult(await grist.createColumns(documentId, tableId, columns));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_columns",
    {
      description:
        "Update Grist column metadata, including type, formula, label, widgetOptions and other fields accepted by Grist. Use rename_column to change the column ID.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columns: boundedArray(columnUpdateSchema, maxSchemaItems)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, columns }) => {
      try {
        return textResult(await grist.updateColumns(documentId, tableId, columns));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "rename_column",
    {
      description:
        "Rename one Grist column ID using a fixed RenameColumn operation. This changes document structure.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        oldColumnId: z.string().min(1),
        newColumnId: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, oldColumnId, newColumnId }) => {
      try {
        return textResult(
          await grist.renameColumn(
            documentId,
            tableId,
            oldColumnId,
            newColumnId
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "delete_columns",
    {
      description:
        "Delete explicitly identified Grist columns. Inspect and present the exact targets before invoking this destructive action.",
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columnIds: boundedArray(z.string().min(1), maxSchemaItems).refine(
          (ids) => new Set(ids).size === ids.length,
          "Column IDs must be unique."
        )
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false
      }
    },
    async ({ documentId, tableId, columnIds }) => {
      try {
        return textResult(await grist.deleteColumns(documentId, tableId, columnIds));
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
