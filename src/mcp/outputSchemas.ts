import * as z from "zod/v4";

const pageSummarySchema = z.object({
  pageCount: z.number().int().nonnegative(),
  widgetCount: z.number().int().nonnegative()
});

const pageInfoSchema = z.object({
  id: z.number().int().positive(),
  pageRecordId: z.number().int().positive(),
  name: z.string(),
  type: z.string(),
  indentation: z.number(),
  pagePos: z.number().optional(),
  layoutSpec: z.unknown().optional()
});

const pageListItemSchema = pageInfoSchema.extend({
  widgetCount: z.number().int().nonnegative(),
  widgetIds: z.array(z.number().int().positive())
});

const widgetSelectBySchema = z.object({
  sourceSectionId: z.number().int().positive(),
  sourceColumnRef: z.number().int().positive().optional(),
  targetColumnRef: z.number().int().positive().optional()
});

const widgetSortEntrySchema = z.object({
  columnId: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
  emptyLast: z.boolean().optional(),
  naturalSort: z.boolean().optional(),
  orderByChoice: z.boolean().optional()
});

const pageWidgetSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  tableRef: z.number().int().nonnegative(),
  tableId: z.string().optional(),
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  chartType: z.string().optional(),
  options: z.unknown().optional(),
  layoutSpec: z.unknown().optional(),
  sortColRefs: z.unknown().optional(),
  sort: z.array(widgetSortEntrySchema).optional(),
  sortNormalizationIncomplete: z.boolean().optional(),
  selectBy: widgetSelectBySchema.optional()
});

const columnSelectByOptionSchema = z
  .object({
    sourceWidgetId: z.number().int().positive(),
    sourceColumnId: z.string().min(1).optional(),
    targetColumnId: z.string().min(1).optional()
  })
  .refine(
    (value) =>
      value.sourceColumnId !== undefined || value.targetColumnId !== undefined,
    "At least one Ref/RefList column ID is required."
  );

export const pagesOutputSchema = z.object({
  documentId: z.string().min(1),
  summary: pageSummarySchema,
  pages: z.array(pageListItemSchema)
});

export const pageWidgetsOutputSchema = z.object({
  documentId: z.string().min(1),
  page: pageInfoSchema,
  widgets: z.array(
    pageWidgetSchema.extend({
      directSelectByOptions: z.array(
        z.object({
          sourceWidgetId: z.number().int().positive()
        })
      ),
      directSelectByOptionsTruncated: z.boolean(),
      columnSelectByOptions: z.array(columnSelectByOptionSchema),
      columnSelectByOptionsTruncated: z.boolean()
    })
  )
});

export const pageMutationOutputSchema = z.object({
  documentId: z.string().min(1),
  page: pageListItemSchema
});

export const widgetMutationOutputSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.number().int().positive(),
  widget: pageWidgetSchema
});
