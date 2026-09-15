import type { AuditLogger } from "../audit/auditLogger.js";
import type { AuthorizationService } from "../auth/authorizationService.js";
import type { GristCapability, Principal } from "../auth/principal.js";
import type {
  GristColumnSpec,
  GristColumnUpdate,
  GristTableSpec,
  GristTableUpdate,
  NewGristRecord,
  UpdateGristRecord
} from "./client.js";
import type { GristService, QueryRecordsOptions } from "./service.js";

export class AuthorizedGristService {
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
    const requestId = this.audit.nextRequestId();
    const started = Date.now();
    try {
      const documents = (await this.authorization.listDocuments(this.principal)).map(
        ({ org, workspace, document }) => ({
          org: { id: org.id, name: org.name, domain: org.domain },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            access: workspace.access
          },
          document
        })
      );
      this.audit.record({
        requestId,
        principal: this.principal.id,
        transport: this.principal.transport,
        operation: "list_documents",
        capability: "doc:read",
        status: "success",
        durationMs: Date.now() - started
      });
      return { documents };
    } catch (error) {
      this.auditFailure(requestId, started, "list_documents", "doc:read", undefined, error);
      throw error;
    }
  }

  async listTables(
    documentIdOrUrl: string,
    options: { expandColumns?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_tables", "doc:read", documentIdOrUrl, undefined, (id) =>
      this.inner.listTables(id, options)
    );
  }

  async listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options: { hidden?: boolean } = {}
  ): Promise<unknown> {
    return this.execute("list_columns", "doc:read", documentIdOrUrl, undefined, (id) =>
      this.inner.listColumns(id, tableId, options)
    );
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: QueryRecordsOptions = {}
  ): Promise<unknown> {
    return this.execute("query_records", "doc:read", documentIdOrUrl, undefined, (id) =>
      this.inner.queryRecords(id, tableId, options)
    );
  }

  async createRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: NewGristRecord[]
  ): Promise<unknown> {
    return this.execute("create_records", "doc:write", documentIdOrUrl, records.length, (id) =>
      this.inner.createRecords(id, tableId, records)
    );
  }

  async updateRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    return this.execute("update_records", "doc:write", documentIdOrUrl, records.length, (id) =>
      this.inner.updateRecords(id, tableId, records)
    );
  }

  async deleteRecords(
    documentIdOrUrl: string,
    tableId: string,
    recordIds: number[]
  ): Promise<unknown> {
    return this.execute("delete_records", "doc:write", documentIdOrUrl, recordIds.length, (id) =>
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
    return this.execute("create_tables", "doc.schema:write", documentIdOrUrl, itemCount, (id) =>
      this.inner.createTables(id, tables)
    );
  }

  async updateTables(
    documentIdOrUrl: string,
    tables: GristTableUpdate[]
  ): Promise<unknown> {
    return this.execute("update_tables", "doc.schema:write", documentIdOrUrl, tables.length, (id) =>
      this.inner.updateTables(id, tables)
    );
  }

  async deleteTable(documentIdOrUrl: string, tableId: string): Promise<unknown> {
    return this.execute("delete_table", "doc.schema:write", documentIdOrUrl, 1, (id) =>
      this.inner.deleteTable(id, tableId)
    );
  }

  async createColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnSpec[]
  ): Promise<unknown> {
    return this.execute("create_columns", "doc.schema:write", documentIdOrUrl, columns.length, (id) =>
      this.inner.createColumns(id, tableId, columns)
    );
  }

  async updateColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnUpdate[]
  ): Promise<unknown> {
    return this.execute("update_columns", "doc.schema:write", documentIdOrUrl, columns.length, (id) =>
      this.inner.updateColumns(id, tableId, columns)
    );
  }

  async renameColumn(
    documentIdOrUrl: string,
    tableId: string,
    oldColumnId: string,
    newColumnId: string
  ): Promise<unknown> {
    return this.execute("rename_column", "doc.schema:write", documentIdOrUrl, 1, (id) =>
      this.inner.renameColumn(id, tableId, oldColumnId, newColumnId)
    );
  }

  async deleteColumns(
    documentIdOrUrl: string,
    tableId: string,
    columnIds: string[]
  ): Promise<unknown> {
    return this.execute("delete_columns", "doc.schema:write", documentIdOrUrl, columnIds.length, (id) =>
      this.inner.deleteColumns(id, tableId, columnIds)
    );
  }

  private async execute(
    operation: string,
    capability: GristCapability,
    documentIdOrUrl: string,
    itemCount: number | undefined,
    action: (documentId: string) => Promise<unknown>
  ): Promise<unknown> {
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
        operation,
        capability,
        documentId,
        ...(itemCount !== undefined ? { itemCount } : {}),
        status: "success",
        durationMs: Date.now() - started
      });
      return result;
    } catch (error) {
      this.auditFailure(requestId, started, operation, capability, documentId, error, itemCount);
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
