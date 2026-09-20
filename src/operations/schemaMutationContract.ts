import * as z from "zod/v4";

/**
 * Stable model-facing table metadata that the bridge intentionally supports.
 * Internal Grist metadata fields remain server-side implementation details.
 */
export const tableMutationFieldsSchema = z
  .object({
    tableId: z.string().min(1).optional(),
    onDemand: z.boolean().optional()
  })
  .strict();

/**
 * Stable model-facing column metadata mirrored by public schema inspection.
 * Numeric engine references such as visibleCol/displayCol are deliberately
 * excluded; semantic operations must resolve those server-side when needed.
 */
export const columnMutationFieldsSchema = z
  .object({
    label: z.string().optional(),
    type: z.string().optional(),
    isFormula: z.boolean().optional(),
    formula: z.string().optional(),
    description: z.string().optional(),
    widgetOptions: z.string().optional()
  })
  .strict();

export const tableMutationFieldsOpenApiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tableId: {
      type: "string",
      minLength: 1,
      description: "New stable table ID when renaming the table."
    },
    onDemand: {
      type: "boolean",
      description: "Whether Grist loads the table on demand."
    }
  }
} as const;

export const columnMutationFieldsOpenApiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    type: { type: "string" },
    isFormula: { type: "boolean" },
    formula: { type: "string" },
    description: { type: "string" },
    widgetOptions: {
      type: "string",
      description: "JSON string in the format expected by Grist."
    }
  }
} as const;
