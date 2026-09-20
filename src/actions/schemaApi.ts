import type { Express, Response } from "express";
import * as z from "zod/v4";

import type { GristService } from "../grist/service.js";
import {
  columnMutationFieldsOpenApiSchema,
  columnMutationFieldsSchema,
  tableMutationFieldsOpenApiSchema,
  tableMutationFieldsSchema
} from "../operations/schemaMutationContract.js";

export type GristSchemaOperations = Pick<
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

const columnSpecSchema = z.object({
  id: z.string().min(1),
  fields: columnMutationFieldsSchema.optional()
});
const columnUpdateSchema = z.object({
  id: z.string().min(1),
  fields: columnMutationFieldsSchema
});
const tableUpdateSchema = z.object({
  id: z.string().min(1),
  fields: tableMutationFieldsSchema
});

function boundedArray<T extends z.ZodType>(schema: T, max: number) {
  let result = z.array(schema).min(1);
  if (max > 0) result = result.max(max);
  return result;
}

function stringArraySchema(max: number) {
  return boundedArray(z.string().min(1), max).refine(
    (values) => new Set(values).size === values.length,
    "Values must be unique."
  );
}

function maxItems(max: number): Record<string, unknown> {
  return max > 0 ? { maxItems: max } : {};
}

const documentParameter = {
  name: "documentId",
  in: "path",
  required: true,
  schema: { type: "string" }
};

const tableParameter = {
  name: "tableId",
  in: "path",
  required: true,
  schema: { type: "string" }
};

export function buildSchemaOpenApiPaths(maxSchemaItems: number): Record<string, unknown> {
  const errorResponses = {
    "400": { description: "Invalid schema request or configured guardrail exceeded" },
    "401": { description: "Missing or invalid GPT Actions bearer token" },
    "403": { description: "Document is outside the ChatGPT access policy" },
    "502": { description: "Grist upstream API error" }
  };

  const columnSpec = {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string", minLength: 1 },
      fields: columnMutationFieldsOpenApiSchema
    }
  };
  const columnUpdate = {
    type: "object",
    additionalProperties: false,
    required: ["id", "fields"],
    properties: {
      id: { type: "string", minLength: 1 },
      fields: columnMutationFieldsOpenApiSchema
    }
  };
  const columnArray = {
    type: "array",
    minItems: 1,
    ...maxItems(maxSchemaItems),
    items: columnSpec
  };
  const tableSpec = {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string", minLength: 1 },
      columns: columnArray
    }
  };

  return {
    "/api/v1/documents/{documentId}/tables/{tableId}/columns": {
      get: {
        operationId: "listGristColumns",
        summary: "List columns and metadata in a Grist table",
        description:
          "Read-only. Inspect column IDs, labels, types, formulas and widget metadata before changing schema.",
        "x-openai-isConsequential": false,
        parameters: [
          documentParameter,
          tableParameter,
          {
            name: "hidden",
            in: "query",
            required: false,
            schema: { type: "boolean", default: false },
            description: "Include hidden columns such as manualSort."
          }
        ],
        responses: { "200": { description: "Grist column metadata" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/schema/tables/create": {
      post: {
        operationId: "createGristTables",
        summary: "Create Grist tables, optionally with initial columns",
        description: "Consequential schema write. Uses the official Grist tables API.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["tables"],
                properties: {
                  tables: {
                    type: "array",
                    minItems: 1,
                    ...maxItems(maxSchemaItems),
                    items: tableSpec
                  }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Tables created" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/schema/tables/update": {
      post: {
        operationId: "updateGristTables",
        summary: "Update Grist table metadata, including table ID and on-demand mode",
        description:
          "Consequential schema write. fields supports only tableId to rename a table and onDemand to change loading mode.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["tables"],
                properties: {
                  tables: {
                    type: "array",
                    minItems: 1,
                    ...maxItems(maxSchemaItems),
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "fields"],
                      properties: {
                        id: { type: "string", minLength: 1 },
                        fields: tableMutationFieldsOpenApiSchema
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Tables updated" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/schema/tables/delete": {
      post: {
        operationId: "deleteGristTable",
        summary: "Delete one explicitly identified Grist table",
        description:
          "Destructive schema write. First inspect the document structure and present the exact table to the user. Internally the bridge emits only the fixed RemoveTable Grist action.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["tableId"],
                properties: { tableId: { type: "string", minLength: 1 } }
              }
            }
          }
        },
        responses: { "200": { description: "Table deleted" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/tables/{tableId}/columns/create": {
      post: {
        operationId: "createGristColumns",
        summary: "Create columns in a Grist table",
        description:
          "Consequential schema write. Column fields support only label, type, formula, isFormula, description and widgetOptions.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter, tableParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["columns"],
                properties: { columns: columnArray }
              }
            }
          }
        },
        responses: { "200": { description: "Columns created" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/tables/{tableId}/columns/update": {
      post: {
        operationId: "updateGristColumns",
        summary: "Update Grist column metadata",
        description:
          "Consequential schema write. Supports only label, type, formula, isFormula, description and widgetOptions. Use renameGristColumn to change a column ID.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter, tableParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["columns"],
                properties: {
                  columns: {
                    type: "array",
                    minItems: 1,
                    ...maxItems(maxSchemaItems),
                    items: columnUpdate
                  }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Columns updated" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/tables/{tableId}/columns/rename": {
      post: {
        operationId: "renameGristColumn",
        summary: "Rename one Grist column ID",
        description:
          "Consequential schema write. Internally the bridge emits only the fixed RenameColumn Grist action.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter, tableParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["oldColumnId", "newColumnId"],
                properties: {
                  oldColumnId: { type: "string", minLength: 1 },
                  newColumnId: { type: "string", minLength: 1 }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Column ID renamed" }, ...errorResponses }
      }
    },
    "/api/v1/documents/{documentId}/tables/{tableId}/columns/delete": {
      post: {
        operationId: "deleteGristColumns",
        summary: "Delete explicitly identified Grist columns",
        description:
          "Destructive schema write. First inspect and present the exact columns that will be deleted.",
        "x-openai-isConsequential": true,
        parameters: [documentParameter, tableParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["columnIds"],
                properties: {
                  columnIds: {
                    type: "array",
                    minItems: 1,
                    uniqueItems: true,
                    ...maxItems(maxSchemaItems),
                    items: { type: "string", minLength: 1 }
                  }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Columns deleted" }, ...errorResponses }
      }
    }
  };
}

export function registerSchemaActionApi(
  app: Express,
  options: {
    grist: GristSchemaOperations;
    maxSchemaItems: number;
    sendError: (res: Response, error: unknown) => void;
  }
): void {
  const tableSpecSchema = z.object({
    id: z.string().min(1),
    columns: boundedArray(columnSpecSchema, options.maxSchemaItems).optional()
  });
  const createTablesSchema = z
    .object({ tables: boundedArray(tableSpecSchema, options.maxSchemaItems) })
    .strict();
  const updateTablesSchema = z
    .object({ tables: boundedArray(tableUpdateSchema, options.maxSchemaItems) })
    .strict();
  const deleteTableSchema = z.object({ tableId: z.string().min(1) }).strict();
  const createColumnsSchema = z
    .object({ columns: boundedArray(columnSpecSchema, options.maxSchemaItems) })
    .strict();
  const updateColumnsSchema = z
    .object({ columns: boundedArray(columnUpdateSchema, options.maxSchemaItems) })
    .strict();
  const renameColumnSchema = z
    .object({
      oldColumnId: z.string().min(1),
      newColumnId: z.string().min(1)
    })
    .strict();
  const deleteColumnsSchema = z
    .object({ columnIds: stringArraySchema(options.maxSchemaItems) })
    .strict();

  const documentParams = z.object({ documentId: z.string().min(1) });
  const tableParams = z.object({
    documentId: z.string().min(1),
    tableId: z.string().min(1)
  });

  app.get(
    "/api/v1/documents/:documentId/tables/:tableId/columns",
    async (req, res) => {
      try {
        const { documentId, tableId } = tableParams.parse(req.params);
        const hidden = req.query.hidden === "true";
        res.json(await options.grist.listColumns(documentId, tableId, { hidden }));
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );

  app.post("/api/v1/documents/:documentId/schema/tables/create", async (req, res) => {
    try {
      const { documentId } = documentParams.parse(req.params);
      const { tables } = createTablesSchema.parse(req.body);
      res.json(await options.grist.createTables(documentId, tables));
    } catch (error) {
      options.sendError(res, error);
    }
  });

  app.post("/api/v1/documents/:documentId/schema/tables/update", async (req, res) => {
    try {
      const { documentId } = documentParams.parse(req.params);
      const { tables } = updateTablesSchema.parse(req.body);
      res.json(await options.grist.updateTables(documentId, tables));
    } catch (error) {
      options.sendError(res, error);
    }
  });

  app.post("/api/v1/documents/:documentId/schema/tables/delete", async (req, res) => {
    try {
      const { documentId } = documentParams.parse(req.params);
      const { tableId } = deleteTableSchema.parse(req.body);
      res.json(await options.grist.deleteTable(documentId, tableId));
    } catch (error) {
      options.sendError(res, error);
    }
  });

  app.post(
    "/api/v1/documents/:documentId/tables/:tableId/columns/create",
    async (req, res) => {
      try {
        const { documentId, tableId } = tableParams.parse(req.params);
        const { columns } = createColumnsSchema.parse(req.body);
        res.json(await options.grist.createColumns(documentId, tableId, columns));
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );

  app.post(
    "/api/v1/documents/:documentId/tables/:tableId/columns/update",
    async (req, res) => {
      try {
        const { documentId, tableId } = tableParams.parse(req.params);
        const { columns } = updateColumnsSchema.parse(req.body);
        res.json(await options.grist.updateColumns(documentId, tableId, columns));
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );

  app.post(
    "/api/v1/documents/:documentId/tables/:tableId/columns/rename",
    async (req, res) => {
      try {
        const { documentId, tableId } = tableParams.parse(req.params);
        const { oldColumnId, newColumnId } = renameColumnSchema.parse(req.body);
        res.json(
          await options.grist.renameColumn(
            documentId,
            tableId,
            oldColumnId,
            newColumnId
          )
        );
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );

  app.post(
    "/api/v1/documents/:documentId/tables/:tableId/columns/delete",
    async (req, res) => {
      try {
        const { documentId, tableId } = tableParams.parse(req.params);
        const { columnIds } = deleteColumnsSchema.parse(req.body);
        res.json(await options.grist.deleteColumns(documentId, tableId, columnIds));
      } catch (error) {
        options.sendError(res, error);
      }
    }
  );
}
