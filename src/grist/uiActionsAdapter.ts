import type { GristClient } from "./client.js";

export const NATIVE_WIDGET_TYPES = [
  "record",
  "single",
  "detail",
  "form",
  "chart",
  "calendar",
  "custom"
] as const;

export type NativeWidgetType = (typeof NATIVE_WIDGET_TYPES)[number];

type ApplyUserActionsClient = Pick<GristClient, "applyUserActions">;
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function singleReturnValue(response: unknown, actionName: string): JsonRecord {
  const root = record(response);
  const retValues = Array.isArray(root?.retValues) ? root.retValues : undefined;
  const value = retValues?.length === 1 ? record(retValues[0]) : null;
  if (!value) {
    throw new Error(`Grist ${actionName} returned an unexpected /apply response.`);
  }
  return value;
}

export class UiWriteVerificationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly createdId: number,
    message: string
  ) {
    super(`${message} The Grist write may already have succeeded; do not retry the whole operation blindly.`);
    this.name = "UiWriteVerificationError";
  }
}

export class GristUiActionsAdapter {
  constructor(private readonly client: ApplyUserActionsClient) {}

  async createEmptyPage(
    documentId: string,
    tableId: string,
    name: string
  ): Promise<{ pageId: number }> {
    const pageName = name.trim();
    if (!pageName) throw new Error("Page name must not be empty.");
    if (!tableId.trim()) throw new Error("Table ID must not be empty.");

    const response = await this.client.applyUserActions(documentId, [
      ["AddView", tableId, "empty", pageName]
    ]);
    const result = singleReturnValue(response, "AddView");
    const pageId = positiveInteger(result.id);
    if (!pageId) {
      throw new Error("Grist AddView did not return a positive page ID.");
    }
    return { pageId };
  }

  async addPageWidget(
    documentId: string,
    pageId: number,
    tableRef: number,
    type: NativeWidgetType
  ): Promise<{ pageId: number; tableRef: number; widgetId: number }> {
    if (!Number.isInteger(pageId) || pageId < 1) {
      throw new Error("Grist page ID must be a positive integer.");
    }
    if (!Number.isInteger(tableRef) || tableRef < 1) {
      throw new Error("Grist table reference must be a positive integer.");
    }
    if (!NATIVE_WIDGET_TYPES.includes(type)) {
      throw new Error(`Unsupported Grist widget type "${type}".`);
    }

    const response = await this.client.applyUserActions(documentId, [
      ["CreateViewSection", tableRef, pageId, type, null, null]
    ]);
    const result = singleReturnValue(response, "CreateViewSection");
    const returnedTableRef = positiveInteger(result.tableRef);
    const returnedPageId = positiveInteger(result.viewRef);
    const widgetId = positiveInteger(result.sectionRef);

    if (
      returnedTableRef !== tableRef ||
      returnedPageId !== pageId ||
      widgetId === undefined
    ) {
      throw new Error("Grist CreateViewSection returned inconsistent identifiers.");
    }

    return { pageId: returnedPageId, tableRef: returnedTableRef, widgetId };
  }
}
