import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { GristService } from "../grist/service.js";
import { getMcpToolMetadata } from "../operations/registry.js";
import {
  columnMutationFieldsSchema,
  tableMutationFieldsSchema
} from "../operations/schemaMutationContract.js";
import { errorResult, textResult } from "./results.js";

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

export function registerSchemaTools(
  server: McpServer,
  grist: SchemaOperations,
  maxSchemaItems: number
): void {
  const columnSpecSchema = z.object({
    id: z.string().min(1),
    fields: columnMutationFieldsSchema.optional()
  });
  const columnUpdateSchema = z.object({
    id: z.string().min(1),
    fields: columnMutationFieldsSchema
  });
  const tableSpecSchema = z.object({
    id: z.string().min(1),
    columns: boundedArray(columnSpecSchema, maxSchemaItems).optional()
  });
  const tableUpdateSchema = z.object({
    id: z.string().min(1),
    fields: tableMutationFieldsSchema
  });

  server.registerTool(
    "list_columns",
    {
      ...getMcpToolMetadata("list_columns"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        hidden: z.boolean().default(false)
      })
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
      ...getMcpToolMetadata("create_tables"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tables: boundedArray(tableSpecSchema, maxSchemaItems)
      })
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
      ...getMcpToolMetadata("update_tables"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tables: boundedArray(tableUpdateSchema, maxSchemaItems)
      })
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
      ...getMcpToolMetadata("delete_table"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1)
      })
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
      ...getMcpToolMetadata("create_columns"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columns: boundedArray(columnSpecSchema, maxSchemaItems)
      })
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
      ...getMcpToolMetadata("update_columns"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columns: boundedArray(columnUpdateSchema, maxSchemaItems)
      })
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
      ...getMcpToolMetadata("rename_column"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        oldColumnId: z.string().min(1),
        newColumnId: z.string().min(1)
      })
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
      ...getMcpToolMetadata("delete_columns"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        columnIds: boundedArray(z.string().min(1), maxSchemaItems).refine(
          (ids) => new Set(ids).size === ids.length,
          "Column IDs must be unique."
        )
      })
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
