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

export interface WidgetSelectByRefs {
  sourceSectionId: number;
  sourceColumnRef?: number;
  targetColumnRef?: number;
}

export interface WidgetUiUpdate {
  title?: string;
  description?: string;
  selectBy?: WidgetSelectByRefs | null;
}

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

function assertPositiveId(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export class UiWriteVerificationError extends Error {
  public readonly createdId: number | undefined;

  constructor(
    public readonly operation: string,
    messageOrCreatedId: string | number | undefined,
    createdIdOrMessage?: number | string
  ) {
    const message =
      typeof messageOrCreatedId === "string"
        ? messageOrCreatedId
        : typeof createdIdOrMessage === "string"
          ? createdIdOrMessage
          : "Grist UI write could not be verified.";
    super(`${message} The Grist write may already have succeeded; do not retry the whole operation blindly.`);
    this.name = "UiWriteVerificationError";
    this.createdId =
      typeof messageOrCreatedId === "number"
        ? messageOrCreatedId
        : typeof createdIdOrMessage === "number"
          ? createdIdOrMessage
          : undefined;
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

    let result: JsonRecord;
    try {
      result = singleReturnValue(response, "AddView");
    } catch (error) {
      throw new UiWriteVerificationError(
        "create_page",
        error instanceof Error ? error.message : "Grist AddView response could not be interpreted."
      );
    }

    const pageId = positiveInteger(result.id);
    if (!pageId) {
      throw new UiWriteVerificationError(
        "create_page",
        "Grist AddView did not return a positive page ID."
      );
    }
    return { pageId };
  }

  async addPageWidget(
    documentId: string,
    pageId: number,
    tableRef: number,
    type: NativeWidgetType
  ): Promise<{ pageId: number; tableRef: number; widgetId: number }> {
    assertPositiveId(pageId, "Grist page ID");
    assertPositiveId(tableRef, "Grist table reference");
    if (!NATIVE_WIDGET_TYPES.includes(type)) {
      throw new Error(`Unsupported Grist widget type "${type}".`);
    }

    const response = await this.client.applyUserActions(documentId, [
      ["CreateViewSection", tableRef, pageId, type, null, null]
    ]);

    let result: JsonRecord;
    try {
      result = singleReturnValue(response, "CreateViewSection");
    } catch (error) {
      throw new UiWriteVerificationError(
        "add_page_widget",
        error instanceof Error
          ? error.message
          : "Grist CreateViewSection response could not be interpreted."
      );
    }

    const returnedTableRef = positiveInteger(result.tableRef);
    const returnedPageId = positiveInteger(result.viewRef);
    const widgetId = positiveInteger(result.sectionRef);

    if (
      returnedTableRef !== tableRef ||
      returnedPageId !== pageId ||
      widgetId === undefined
    ) {
      throw new UiWriteVerificationError(
        "add_page_widget",
        "Grist CreateViewSection returned inconsistent identifiers.",
        widgetId
      );
    }

    return { pageId: returnedPageId, tableRef: returnedTableRef, widgetId };
  }

  async renamePage(documentId: string, pageId: number, name: string): Promise<void> {
    assertPositiveId(pageId, "Grist page ID");
    const pageName = name.trim();
    if (!pageName) throw new Error("Page name must not be empty.");

    await this.client.applyUserActions(documentId, [
      ["UpdateRecord", "_grist_Views", pageId, { name: pageName }]
    ]);
  }

  async updatePageWidget(
    documentId: string,
    widgetId: number,
    update: WidgetUiUpdate
  ): Promise<void> {
    assertPositiveId(widgetId, "Grist widget ID");

    const fields: Record<string, unknown> = {};
    if (update.title !== undefined) {
      fields.title = update.title.trim();
    }
    if (update.description !== undefined) {
      fields.description = update.description.trim();
    }
    if (update.selectBy !== undefined) {
      if (update.selectBy === null) {
        fields.linkSrcSectionRef = 0;
        fields.linkSrcColRef = 0;
        fields.linkTargetColRef = 0;
      } else {
        assertPositiveId(update.selectBy.sourceSectionId, "Grist source widget ID");
        const sourceColumnRef = update.selectBy.sourceColumnRef ?? 0;
        const targetColumnRef = update.selectBy.targetColumnRef ?? 0;
        if (!Number.isInteger(sourceColumnRef) || sourceColumnRef < 0) {
          throw new Error("Grist source column reference must be a non-negative integer.");
        }
        if (!Number.isInteger(targetColumnRef) || targetColumnRef < 0) {
          throw new Error("Grist target column reference must be a non-negative integer.");
        }
        fields.linkSrcSectionRef = update.selectBy.sourceSectionId;
        fields.linkSrcColRef = sourceColumnRef;
        fields.linkTargetColRef = targetColumnRef;
      }
    }

    if (Object.keys(fields).length === 0) {
      throw new Error("At least one widget UI field must be updated.");
    }

    await this.client.applyUserActions(documentId, [
      ["UpdateRecord", "_grist_Views_section", widgetId, fields]
    ]);
  }
}
