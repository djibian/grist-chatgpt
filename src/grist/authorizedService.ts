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
import { DocumentContextService } from "./documentContext.js";
import { DocumentUiService, type DocumentUiContext } from "./documentUi.js";
import type { GristService, QueryRecordsOptions } from "./service.js";

export class AuthorizedGristService {
  private readonly documentContext = new DocumentContextService();
  private readonly documentUi = new DocumentUiService();

  constructor(
    private readonly inner: GristService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditLogger,
    private readonly principal: Principal
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
      const ui = await this.loadDocumentUi(id);
      return this.documentUi.getPageWidgets(ui, pageId);
    });
  }

  async listTables(
    documentIdOrUrl: string,
    options: { expandColumns?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_tables", documentIdOrUrl, undefined, (id) =>
      this.inner.listTables(id, options)
    );
  }

  async listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options: { hidden?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_columns", documentIdOrUrl, undefined, (id) =>
      this.inner.listColumns(id, tableId, options)
    );
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: QueryRecordsOptions = {}
  ): Promise<unknown> {
    return this.execute("query_records", documentIdOrUrl, undefined, (id) =>
      this.inner.queryRecords(id, tableId, options)
    );
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
