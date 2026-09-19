import type { AuditLogger } from "../audit/auditLogger.js";
import type { AuthorizationService } from "../auth/authorizationService.js";
import type { GristCapability, Principal } from "../auth/principal.js";
import {
  getOperation,
  getRequiredCapability
} from "../operations/registry.js";
import type {
  GristColumnSpec,
  GristColumnUpdate,
  GristTableSpec,
  GristTableUpdate,
  NewGristRecord,
  UpdateGristRecord
} from "./client.js";
import type { GristChartType } from "./chartTypes.js";
import {
  assertDirectSelectByAllowed,
  resolveColumnSelectByAllowed,
  type ColumnSelectByInput
} from "./selectBy.js";
import { DocumentContextService } from "./documentContext.js";
import { DocumentUiService, type DocumentUiContext, type GristPageWidget } from "./documentUi.js";
import {
  projectPublicColumns,
  projectPublicTables
} from "./publicMetadata.js";
import type { GristService, QueryRecordsOptions } from "./service.js";
import {
  GristUiActionsAdapter,
  UiWriteVerificationError,
  type NativeWidgetType
} from "./uiActionsAdapter.js";
import {
  resolveWidgetSort,
  type ResolvedWidgetSortSpec,
  type WidgetSortInput
} from "./widgetSort.js";

export interface PageWidgetUpdateInput {
  title?: string;
  description?: string;
  chartType?: GristChartType;
  sort?: readonly WidgetSortInput[] | null;
  selectBy?: ColumnSelectByInput | null;
}

function sameSortSpec(
  actual: unknown,
  expected: readonly ResolvedWidgetSortSpec[]
): boolean {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export class AuthorizedGristService {
  private readonly documentContext = new DocumentContextService();
  private readonly documentUi = new DocumentUiService();

  constructor(
    private readonly inner: GristService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditLogger,
    private readonly principal: Principal,
    private readonly uiActions: GristUiActionsAdapter
  ) {}

  get maxReadRecords(): number {
    return this.inner.maxReadRecords;
  }

  get maxWriteRecords(): number {
    return this.inner.maxWriteRecords;
  }

  get writeBatchRecords(): number {
    return this.inner.writeBatchRecords;
  }

  get maxSchemaItems(): number {
    return this.inner.maxSchemaItems;
  }

  async listDocuments(): Promise<unknown> {
    const definition = getOperation("list_documents");
    const capability = getRequiredCapability(definition.name);
    const requestId = this.audit.nextRequestId();
    const started = Date.now();
    try {
      const documents = (
        await this.authorization.listDocuments(this.principal, capability)
      ).map(({ org, workspace, document }) => ({
        org: { id: org.id, name: org.name, domain: org.domain },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          access: workspace.access
        },
        document
      }));
      this.audit.record({
        requestId,
        principal: this.principal.id,
        transport: this.principal.transport,
        operation: definition.name,
        capability,
        status: "success",
        durationMs: Date.now() - started
      });
      return { documents };
    } catch (error) {
      this.auditFailure(
        requestId,
        started,
        definition.name,
        capability,
        undefined,
        error
      );
      throw error;
    }
  }

  async inspectDocument(documentIdOrUrl: string): Promise<unknown> {
    return this.execute("inspect_document", documentIdOrUrl, undefined, async (id) => {
      const tableResponse = await this.inner.listTables(id, { expandColumns: true });
      const ui = await this.loadDocumentUi(id, tableResponse);
      return this.documentContext.build(id, tableResponse, ui);
    });
  }

  async getPages(documentIdOrUrl: string): Promise<unknown> {
    return this.execute("get_pages", documentIdOrUrl, undefined, async (id) => {
      const ui = await this.loadDocumentUi(id);
      return this.documentUi.listPages(ui);
    });
  }

  async getPageWidgets(documentIdOrUrl: string, pageId: number): Promise<unknown> {
    if (!Number.isInteger(pageId) || pageId < 1) {
      throw new Error("Grist page ID must be a positive integer.");
    }
    return this.execute("get_page_widgets", documentIdOrUrl, undefined, async (id) => {
      const tableResponse = await this.inner.listTables(id, { expandColumns: true });
      const ui = await this.loadDocumentUi(id, tableResponse);
      return this.documentUi.getPageWidgets(ui, pageId, tableResponse);
    });
  }

  async createPage(
    documentIdOrUrl: string,
    tableId: string,
    name: string
  ): Promise<unknown> {
    return this.execute("create_page", documentIdOrUrl, 1, async (id) => {
      await this.resolveTableRef(id, tableId);
      const created = await this.uiActions.createEmptyPage(id, tableId, name);
      try {
        const ui = await this.loadDocumentUi(id);
        const page = ui.pages.find((candidate) => candidate.id === created.pageId);
        if (!page) {
          throw new Error(`Created page ${created.pageId} was not found on re-read.`);
        }
        const { widgets, ...pageInfo } = page;
        return {
          documentId: id,
          page: {
            ...pageInfo,
            widgetCount: widgets.length,
            widgetIds: widgets.map((widget) => widget.id)
          }
        };
      } catch (error) {
        throw new UiWriteVerificationError(
          "create_page",
          created.pageId,
          error instanceof Error ? error.message : "Created page could not be verified."
        );
      }
    });
  }

  async addPageWidget(
    documentIdOrUrl: string,
    pageId: number,
    tableId: string,
    type: NativeWidgetType
  ): Promise<unknown> {
    if (!Number.isInteger(pageId) || pageId < 1) {
      throw new Error("Grist page ID must be a positive integer.");
    }
    return this.execute("add_page_widget", documentIdOrUrl, 1, async (id) => {
      const before = await this.loadDocumentUi(id);
      if (!before.pages.some((page) => page.id === pageId)) {
        throw new Error(`Grist page ${pageId} does not exist in document "${id}".`);
      }
      const tableRef = await this.resolveTableRef(id, tableId);
      const created = await this.uiActions.addPageWidget(
        id,
        pageId,
        tableRef,
        type
      );
      try {
        const after = await this.loadDocumentUi(id);
        const page = after.pages.find((candidate) => candidate.id === pageId);
        const widget = page?.widgets.find(
          (candidate) => candidate.id === created.widgetId
        );
        if (!widget) {
          throw new Error(`Created widget ${created.widgetId} was not found on re-read.`);
        }
        return { documentId: id, pageId, widget };
      } catch (error) {
        throw new UiWriteVerificationError(
          "add_page_widget",
          created.widgetId,
          error instanceof Error ? error.message : "Created widget could not be verified."
        );
      }
    });
  }

  async renamePage(
    documentIdOrUrl: string,
    pageId: number,
    name: string
  ): Promise<unknown> {
    if (!Number.isInteger(pageId) || pageId < 1) {
      throw new Error("Grist page ID must be a positive integer.");
    }
    const pageName = name.trim();
    if (!pageName) throw new Error("Page name must not be empty.");

    return this.execute("rename_page", documentIdOrUrl, 1, async (id) => {
      const before = await this.loadDocumentUi(id);
      if (!before.pages.some((page) => page.id === pageId)) {
        throw new Error(`Grist page ${pageId} does not exist in document "${id}".`);
      }

      await this.uiActions.renamePage(id, pageId, pageName);
      try {
        const after = await this.loadDocumentUi(id);
        const page = after.pages.find((candidate) => candidate.id === pageId);
        if (!page || page.name !== pageName) {
          throw new Error(`Renamed page ${pageId} did not match the requested name on re-read.`);
        }
        const { widgets, ...pageInfo } = page;
        return {
          documentId: id,
          page: {
            ...pageInfo,
            widgetCount: widgets.length,
            widgetIds: widgets.map((widget) => widget.id)
          }
        };
      } catch (error) {
        throw new UiWriteVerificationError(
          "rename_page",
          error instanceof Error ? error.message : "Renamed page could not be verified."
        );
      }
    });
  }

  async updatePageWidget(
    documentIdOrUrl: string,
    pageId: number,
    widgetId: number,
    update: PageWidgetUpdateInput
  ): Promise<unknown> {
    if (!Number.isInteger(pageId) || pageId < 1) {
      throw new Error("Grist page ID must be a positive integer.");
    }
    if (!Number.isInteger(widgetId) || widgetId < 1) {
      throw new Error("Grist widget ID must be a positive integer.");
    }
    if (
      update.title === undefined &&
      update.description === undefined &&
      update.chartType === undefined &&
      update.sort === undefined &&
      update.selectBy === undefined
    ) {
      throw new Error("At least one widget UI field must be updated.");
    }

    return this.execute("update_page_widget", documentIdOrUrl, 1, async (id) => {
      const usesColumnSelectBy =
        update.selectBy !== undefined &&
        update.selectBy !== null &&
        (update.selectBy.sourceColumnId !== undefined ||
          update.selectBy.targetColumnId !== undefined);
      const tableResponse = await this.inner.listTables(id, {
        expandColumns: usesColumnSelectBy || update.sort !== undefined
      });
      const before = await this.loadDocumentUi(id, tableResponse);
      const page = before.pages.find((candidate) => candidate.id === pageId);
      if (!page) {
        throw new Error(`Grist page ${pageId} does not exist in document "${id}".`);
      }
      const target = page.widgets.find((candidate) => candidate.id === widgetId);
      if (!target) {
        throw new Error(`Grist widget ${widgetId} does not exist on page ${pageId}.`);
      }
      if (update.chartType !== undefined && target.type !== "chart") {
        throw new Error(`Grist widget ${widgetId} is not a chart widget.`);
      }

      const adapterUpdate: Parameters<GristUiActionsAdapter["updatePageWidget"]>[2] = {};
      const expectedTitle = update.title !== undefined ? update.title.trim() : undefined;
      if (expectedTitle !== undefined) {
        adapterUpdate.title = expectedTitle;
      }
      const expectedDescription =
        update.description !== undefined ? update.description.trim() : undefined;
      if (expectedDescription !== undefined) {
        adapterUpdate.description = expectedDescription;
      }
      const expectedChartType = update.chartType;
      if (expectedChartType !== undefined) {
        adapterUpdate.chartType = expectedChartType;
      }
      const expectedSortColRefs =
        update.sort !== undefined
          ? resolveWidgetSort(target, tableResponse, update.sort)
          : undefined;
      if (expectedSortColRefs !== undefined) {
        adapterUpdate.sortColRefs = expectedSortColRefs;
      }

      let expectedSourceWidgetId: number | null | undefined;
      let expectedSourceColumnRef: number | undefined;
      let expectedTargetColumnRef: number | undefined;
      if (update.selectBy !== undefined) {
        if (update.selectBy === null) {
          adapterUpdate.selectBy = null;
          expectedSourceWidgetId = null;
        } else {
          const sourceWidgetId = update.selectBy.sourceWidgetId;
          if (!Number.isInteger(sourceWidgetId) || sourceWidgetId < 1) {
            throw new Error("Select-by source widget ID must be a positive integer.");
          }
          if (sourceWidgetId === widgetId) {
            throw new Error("A Grist widget cannot select itself.");
          }
          const source = page.widgets.find((candidate) => candidate.id === sourceWidgetId);
          if (!source) {
            throw new Error(`Select-by source widget ${sourceWidgetId} does not exist on page ${pageId}.`);
          }

          if (usesColumnSelectBy) {
            const resolved = resolveColumnSelectByAllowed(
              before,
              tableResponse,
              source,
              target,
              update.selectBy
            );
            adapterUpdate.selectBy = resolved;
            expectedSourceColumnRef = resolved.sourceColumnRef;
            expectedTargetColumnRef = resolved.targetColumnRef;
          } else {
            assertDirectSelectByAllowed(before, source, target);
            adapterUpdate.selectBy = { sourceSectionId: sourceWidgetId };
          }
          expectedSourceWidgetId = sourceWidgetId;
        }
      }

      await this.uiActions.updatePageWidget(id, widgetId, adapterUpdate);
      try {
        const after = await this.loadDocumentUi(id);
        const updatedPage = after.pages.find((candidate) => candidate.id === pageId);
        const widget = updatedPage?.widgets.find((candidate) => candidate.id === widgetId);
        if (!widget) {
          throw new Error(`Updated widget ${widgetId} was not found on re-read.`);
        }
        if (expectedTitle !== undefined && widget.title !== expectedTitle) {
          throw new Error(`Updated widget ${widgetId} did not match the requested title on re-read.`);
        }
        if (
          expectedDescription !== undefined &&
          (expectedDescription === ""
            ? widget.description !== undefined
            : widget.description !== expectedDescription)
        ) {
          throw new Error(`Updated widget ${widgetId} did not match the requested description on re-read.`);
        }
        if (
          expectedChartType !== undefined &&
          widget.chartType !== expectedChartType
        ) {
          throw new Error(`Updated widget ${widgetId} did not match the requested chart type on re-read.`);
        }
        if (
          expectedSortColRefs !== undefined &&
          !sameSortSpec(widget.sortColRefs, expectedSortColRefs)
        ) {
          throw new Error(`Updated widget ${widgetId} did not match the requested saved sort on re-read.`);
        }
        if (expectedSourceWidgetId === null && widget.selectBy !== undefined) {
          throw new Error(`Updated widget ${widgetId} still had a select-by link after clearing it.`);
        }
        if (
          typeof expectedSourceWidgetId === "number" &&
          (widget.selectBy?.sourceSectionId !== expectedSourceWidgetId ||
            widget.selectBy.sourceColumnRef !== expectedSourceColumnRef ||
            widget.selectBy.targetColumnRef !== expectedTargetColumnRef)
        ) {
          throw new Error(`Updated widget ${widgetId} did not match the requested select-by link on re-read.`);
        }
        return { documentId: id, pageId, widget };
      } catch (error) {
        throw new UiWriteVerificationError(
          "update_page_widget",
          error instanceof Error ? error.message : "Updated widget could not be verified."
        );
      }
    });
  }

  async listTables(
    documentIdOrUrl: string,
    options: { expandColumns?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_tables", documentIdOrUrl, undefined, async (id) =>
      projectPublicTables(await this.inner.listTables(id, options))
    );
  }

  async listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options: { hidden?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_columns", documentIdOrUrl, undefined, async (id) =>
      projectPublicColumns(await this.inner.listColumns(id, tableId, options))
    );
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: QueryRecordsOptions = {}
  ): Promise<unknown> {
    return this.execute("query_records", documentIdOrUrl, undefined, (id) => {
      if (tableId.startsWith("_grist_")) {
        throw new Error(
          "Grist metadata tables are internal to the bridge; use the semantic document/page/widget inspection operations instead."
        );
      }
      return this.inner.queryRecords(id, tableId, options);
    });
  }

  async createRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: NewGristRecord[]
  ): Promise<unknown> {
    return this.execute("create_records", documentIdOrUrl, records.length, (id) =>
      this.inner.createRecords(id, tableId, records)
    );
  }

  async updateRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    return this.execute("update_records", documentIdOrUrl, records.length, (id) =>
      this.inner.updateRecords(id, tableId, records)
    );
  }

  async deleteRecords(
    documentIdOrUrl: string,
    tableId: string,
    recordIds: number[]
  ): Promise<unknown> {
    return this.execute("delete_records", documentIdOrUrl, recordIds.length, (id) =>
      this.inner.deleteRecords(id, tableId, recordIds)
    );
  }

  async createTables(
    documentIdOrUrl: string,
    tables: GristTableSpec[]
  ): Promise<unknown> {
    const itemCount = tables.reduce(
      (count, table) => count + 1 + (table.columns?.length ?? 0),
      0
    );
    return this.execute("create_tables", documentIdOrUrl, itemCount, (id) =>
      this.inner.createTables(id, tables)
    );
  }

  async updateTables(
    documentIdOrUrl: string,
    tables: GristTableUpdate[]
  ): Promise<unknown> {
    return this.execute("update_tables", documentIdOrUrl, tables.length, (id) =>
      this.inner.updateTables(id, tables)
    );
  }

  async deleteTable(documentIdOrUrl: string, tableId: string): Promise<unknown> {
    return this.execute("delete_table", documentIdOrUrl, 1, (id) =>
      this.inner.deleteTable(id, tableId)
    );
  }

  async createColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnSpec[]
  ): Promise<unknown> {
    return this.execute("create_columns", documentIdOrUrl, columns.length, (id) =>
      this.inner.createColumns(id, tableId, columns)
    );
  }

  async updateColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnUpdate[]
  ): Promise<unknown> {
    return this.execute("update_columns", documentIdOrUrl, columns.length, (id) =>
      this.inner.updateColumns(id, tableId, columns)
    );
  }

  async renameColumn(
    documentIdOrUrl: string,
    tableId: string,
    oldColumnId: string,
    newColumnId: string
  ): Promise<unknown> {
    return this.execute("rename_column", documentIdOrUrl, 1, (id) =>
      this.inner.renameColumn(id, tableId, oldColumnId, newColumnId)
    );
  }

  async deleteColumns(
    documentIdOrUrl: string,
    tableId: string,
    columnIds: string[]
  ): Promise<unknown> {
    return this.execute("delete_columns", documentIdOrUrl, columnIds.length, (id) =>
      this.inner.deleteColumns(id, tableId, columnIds)
    );
  }

  private async resolveTableRef(documentId: string, tableId: string): Promise<number> {
    if (!tableId.trim()) throw new Error("Table ID must not be empty.");
    if (tableId.startsWith("_grist_")) {
      throw new Error("Internal Grist metadata tables cannot be used as page widget sources.");
    }
    const raw = await this.inner.listTables(documentId);
    const root = raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
    const tables = Array.isArray(root?.tables) ? root.tables : [];
    for (const entry of tables) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
      const table = entry as Record<string, unknown>;
      if (table.id !== tableId) continue;
      const fields = table.fields !== null && typeof table.fields === "object" && !Array.isArray(table.fields)
        ? (table.fields as Record<string, unknown>)
        : null;
      const tableRef = fields?.tableRef;
      if (typeof tableRef === "number" && Number.isInteger(tableRef) && tableRef > 0) {
        return tableRef;
      }
      throw new Error(`Grist table "${tableId}" has no usable table reference.`);
    }
    throw new Error(`Grist table "${tableId}" does not exist in document "${documentId}".`);
  }

  private async loadDocumentUi(
    documentId: string,
    tableResponse?: unknown
  ): Promise<DocumentUiContext> {
    const metadataLimit = this.inner.maxReadRecords > 0
      ? this.inner.maxReadRecords
      : 5000;
    const [tables, pages, views, sections] = await Promise.all([
      tableResponse ?? this.inner.listTables(documentId),
      this.inner.queryRecords(documentId, "_grist_Pages", {
        limit: metadataLimit,
        hidden: true
      }),
      this.inner.queryRecords(documentId, "_grist_Views", {
        limit: metadataLimit,
        hidden: true
      }),
      this.inner.queryRecords(documentId, "_grist_Views_section", {
        limit: metadataLimit,
        hidden: true
      })
    ]);
    return this.documentUi.build(documentId, tables, pages, views, sections);
  }

  private async execute(
    operation: string,
    documentIdOrUrl: string,
    itemCount: number | undefined,
    action: (documentId: string) => Promise<unknown>
  ): Promise<unknown> {
    const definition = getOperation(operation);
    const capability = getRequiredCapability(operation);
    const requestId = this.audit.nextRequestId();
    const started = Date.now();
    let documentId = documentIdOrUrl;
    try {
      documentId = await this.authorization.assertDocumentAllowed(
        this.principal,
        documentIdOrUrl,
        capability
      );
      const result = await action(documentId);
      this.audit.record({
        requestId,
        principal: this.principal.id,
        transport: this.principal.transport,
        operation: definition.name,
        capability,
        documentId,
        ...(itemCount !== undefined ? { itemCount } : {}),
        status: "success",
        durationMs: Date.now() - started
      });
      return result;
    } catch (error) {
      this.auditFailure(
        requestId,
        started,
        definition.name,
        capability,
        documentId,
        error,
        itemCount
      );
      throw error;
    }
  }

  private auditFailure(
    requestId: string,
    started: number,
    operation: string,
    capability: GristCapability,
    documentId: string | undefined,
    error: unknown,
    itemCount?: number
  ): void {
    this.audit.record({
      requestId,
      principal: this.principal.id,
      transport: this.principal.transport,
      operation,
      capability,
      ...(documentId ? { documentId } : {}),
      ...(itemCount !== undefined ? { itemCount } : {}),
      status: "error",
      durationMs: Date.now() - started,
      errorType: error instanceof Error ? error.name : "UnknownError"
    });
  }
}
