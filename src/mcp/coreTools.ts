import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { AuthorizedGristService } from "../grist/authorizedService.js";
import { getMcpToolMetadata } from "../operations/registry.js";
import { errorResult, textResult } from "./results.js";

type CoreOperations = Pick<
  AuthorizedGristService,
  | "listDocuments"
  | "listTables"
  | "queryRecords"
  | "createRecords"
  | "updateRecords"
  | "deleteRecords"
>;

export interface CoreToolLimits {
  maxReadRecords: number;
  maxWriteRecords: number;
}

function boundedPositiveInt(max: number, defaultValue: number) {
  let schema = z.number().int().min(1);
  if (max > 0) schema = schema.max(max);
  return schema.default(defaultValue);
}

function boundedArray<T extends z.ZodType>(schema: T, max: number) {
  let result = z.array(schema).min(1);
  if (max > 0) result = result.max(max);
  return result;
}

export function registerCoreTools(
  server: McpServer,
  grist: CoreOperations,
  limits: CoreToolLimits
): void {
  server.registerTool(
    "list_documents",
    {
      ...getMcpToolMetadata("list_documents"),
      inputSchema: z.object({})
    },
    async () => {
      try {
        return textResult(await grist.listDocuments());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_tables",
    {
      ...getMcpToolMetadata("list_tables"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        expandColumns: z.boolean().default(false)
      })
    },
    async ({ documentId, expandColumns }) => {
      try {
        return textResult(await grist.listTables(documentId, { expandColumns }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "query_records",
    {
      ...getMcpToolMetadata("query_records"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        filter: z.record(z.string(), z.array(z.unknown())).optional(),
        sort: z.string().min(1).optional(),
        limit: boundedPositiveInt(
          limits.maxReadRecords,
          limits.maxReadRecords > 0 ? Math.min(50, limits.maxReadRecords) : 50
        ),
        hidden: z.boolean().optional(),
        cellFormat: z.enum(["normal", "typed"]).optional()
      })
    },
    async ({ documentId, tableId, filter, sort, limit, hidden, cellFormat }) => {
      try {
        return textResult(
          await grist.queryRecords(documentId, tableId, {
            ...(filter ? { filter } : {}),
            ...(sort ? { sort } : {}),
            limit,
            ...(hidden !== undefined ? { hidden } : {}),
            ...(cellFormat ? { cellFormat } : {})
          })
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  const newRecordSchema = z.object({
    fields: z.record(z.string(), z.unknown())
  });
  server.registerTool(
    "create_records",
    {
      ...getMcpToolMetadata("create_records"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        records: boundedArray(newRecordSchema, limits.maxWriteRecords)
      })
    },
    async ({ documentId, tableId, records }) => {
      try {
        return textResult(await grist.createRecords(documentId, tableId, records));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  const updateRecordSchema = z.object({
    id: z.number().int().positive(),
    fields: z.record(z.string(), z.unknown())
  });
  server.registerTool(
    "update_records",
    {
      ...getMcpToolMetadata("update_records"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        records: boundedArray(updateRecordSchema, limits.maxWriteRecords)
      })
    },
    async ({ documentId, tableId, records }) => {
      try {
        return textResult(await grist.updateRecords(documentId, tableId, records));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "delete_records",
    {
      ...getMcpToolMetadata("delete_records"),
      inputSchema: z.object({
        documentId: z.string().min(1),
        tableId: z.string().min(1),
        recordIds: boundedArray(
          z.number().int().positive(),
          limits.maxWriteRecords
        ).refine(
          (ids) => new Set(ids).size === ids.length,
          "Record IDs must be unique."
        )
      })
    },
    async ({ documentId, tableId, recordIds }) => {
      try {
        return textResult(await grist.deleteRecords(documentId, tableId, recordIds));
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
