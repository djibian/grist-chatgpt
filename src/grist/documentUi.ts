import { directSelectByValidator } from "./selectBy.js";
import { GristApiError } from "./client.js";

type JsonRecord = Record<string, unknown>;

interface MetaRecord {
  id: number;
  fields: JsonRecord;
}

export interface GristPageWidget {
  id: number;
  pageId: number;
  tableRef: number;
  tableId?: string;
  type: string;
  title: string;
  description?: string;
  chartType?: string;
  options?: unknown;
  layoutSpec?: unknown;
  sortColRefs?: unknown;
  selectBy?: {
    sourceSectionId: number;
    sourceColumnRef?: number;
    targetColumnRef?: number;
  };
}

export interface GristPage {
  id: number;
  pageRecordId: number;
  name: string;
  type: string;
  indentation: number;
  pagePos?: number;
  layoutSpec?: unknown;
  widgets: GristPageWidget[];
}

export interface DocumentUiContext {
  documentId: string;
  summary: {
    pageCount: number;
    widgetCount: number;
  };
  pages: GristPage[];
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): MetaRecord[] {
  const root = record(value);
  const source = Array.isArray(root?.records) ? root.records : [];
  return source.flatMap((entry) => {
    const item = record(entry);
    const id = typeof item?.id === "number" && Number.isInteger(item.id) ? item.id : undefined;
    const fields = record(item?.fields);
    return id !== undefined && fields ? [{ id, fields }] : [];
  });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function ref(value: unknown): number {
  const candidate = number(value);
  return candidate !== undefined && Number.isInteger(candidate) && candidate > 0
    ? candidate
    : 0;
}

function jsonText(value: unknown): unknown | undefined {
  const source = text(value);
  if (!source) return undefined;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return source;
  }
}

function tableRefMap(tableResponse: unknown): Map<number, string> {
  const root = record(tableResponse);
  const source = Array.isArray(root?.tables) ? root.tables : [];
  const result = new Map<number, string>();
  for (const entry of source) {
    const table = record(entry);
    const id = text(table?.id);
    const fields = record(table?.fields);
    const tableRef = ref(fields?.tableRef);
    if (id && tableRef) result.set(tableRef, id);
  }
  return result;
}

export class DocumentUiService {
  build(
    documentId: string,
    tableResponse: unknown,
    pagesResponse: unknown,
    viewsResponse: unknown,
    sectionsResponse: unknown
  ): DocumentUiContext {
    const tableIds = tableRefMap(tableResponse);
    const views = new Map(records(viewsResponse).map((view) => [view.id, view]));
    const sections = records(sectionsResponse);

    const widgetsByPage = new Map<number, GristPageWidget[]>();
    for (const section of sections) {
      const pageId = ref(section.fields.parentId);
      if (!pageId) continue;

      const tableRef = ref(section.fields.tableRef);
      const tableId = tableIds.get(tableRef);
      const description = text(section.fields.description);
      const chartType = text(section.fields.chartType);
      const options = jsonText(section.fields.options);
      const layoutSpec = jsonText(section.fields.layoutSpec);
      const sortColRefs = jsonText(section.fields.sortColRefs);
      const sourceSectionId = ref(section.fields.linkSrcSectionRef);
      const sourceColumnRef = ref(section.fields.linkSrcColRef);
      const targetColumnRef = ref(section.fields.linkTargetColRef);

      const widget: GristPageWidget = {
        id: section.id,
        pageId,
        tableRef,
        ...(tableId !== undefined ? { tableId } : {}),
        type: text(section.fields.parentKey) ?? "unknown",
        title: text(section.fields.title) ?? "",
        ...(description !== undefined && description !== "" ? { description } : {}),
        ...(chartType !== undefined && chartType !== "" ? { chartType } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(layoutSpec !== undefined ? { layoutSpec } : {}),
        ...(sortColRefs !== undefined ? { sortColRefs } : {}),
        ...(sourceSectionId
          ? {
              selectBy: {
                sourceSectionId,
                ...(sourceColumnRef ? { sourceColumnRef } : {}),
                ...(targetColumnRef ? { targetColumnRef } : {})
              }
            }
          : {})
      };
      const widgets = widgetsByPage.get(pageId) ?? [];
      widgets.push(widget);
      widgetsByPage.set(pageId, widgets);
    }

    const pages = records(pagesResponse)
      .flatMap((pageRecord) => {
        const pageId = ref(pageRecord.fields.viewRef);
        if (!pageId) return [];
        const view = views.get(pageId);
        if (!view) return [];

        const pagePos = number(pageRecord.fields.pagePos);
        const layoutSpec = jsonText(view.fields.layoutSpec);
        const widgets = (widgetsByPage.get(pageId) ?? []).sort((a, b) => a.id - b.id);
        const page: GristPage = {
          id: pageId,
          pageRecordId: pageRecord.id,
          name: text(view.fields.name) ?? `Page ${pageId}`,
          type: text(view.fields.type) ?? "",
          indentation: number(pageRecord.fields.indentation) ?? 0,
          ...(pagePos !== undefined ? { pagePos } : {}),
          ...(layoutSpec !== undefined ? { layoutSpec } : {}),
          widgets
        };
        return [page];
      })
      .sort((a, b) => {
        if (a.pagePos !== undefined && b.pagePos !== undefined) return a.pagePos - b.pagePos;
        if (a.pagePos !== undefined) return -1;
        if (b.pagePos !== undefined) return 1;
        return a.pageRecordId - b.pageRecordId;
      });

    return {
      documentId,
      summary: {
        pageCount: pages.length,
        widgetCount: pages.reduce((count, page) => count + page.widgets.length, 0)
      },
      pages
    };
  }

  listPages(context: DocumentUiContext): unknown {
    return {
      documentId: context.documentId,
      summary: context.summary,
      pages: context.pages.map(({ widgets, ...page }) => ({
        ...page,
        widgetCount: widgets.length,
        widgetIds: widgets.map((widget) => widget.id)
      }))
    };
  }

  getPageWidgets(context: DocumentUiContext, pageId: number): unknown {
    const page = context.pages.find((candidate) => candidate.id === pageId);
    if (!page) {
      throw new GristApiError(
        `Grist page ${pageId} does not exist in document "${context.documentId}".`,
        404
      );
    }
    const { widgets, ...pageInfo } = page;
    const assertAllowed = directSelectByValidator(context);
    let remainingOptions = 1000;
    let remainingCandidates = 10000;
    return {
      documentId: context.documentId,
      page: pageInfo,
      widgets: widgets.map((target) => {
        const directSelectByOptions: Array<{ sourceWidgetId: number }> = [];
        let examined = 0;
        for (const source of widgets) {
          if (remainingOptions === 0 || remainingCandidates === 0) break;
          examined++;
          remainingCandidates--;
          try {
            assertAllowed(source, target);
            directSelectByOptions.push({ sourceWidgetId: source.id });
            remainingOptions--;
          } catch {
            // Unsupported candidates never become advertised update inputs.
          }
        }
        return {
          ...target,
          directSelectByOptions,
          directSelectByOptionsTruncated: examined < widgets.length
        };
      })
    };
  }
}
