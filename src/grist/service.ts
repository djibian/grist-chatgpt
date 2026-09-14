import { AccessPolicy } from "./accessPolicy.js";
import {
  GristClient,
  type GristColumnSpec,
  type GristColumnUpdate,
  type GristTableSpec,
  type GristTableUpdate,
  type NewGristRecord,
  type UpdateGristRecord
} from "./client.js";

export interface GristServiceOptions {
  maxReadRecords: number;
  maxWriteRecords: number;
  writeBatchRecords: number;
  maxSchemaItems: number;
}

export interface QueryRecordsOptions {
  filter?: Record<string, unknown[]>;
  sort?: string;
  limit?: number;
  hidden?: boolean;
  cellFormat?: "normal" | "typed";
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function batchedResult(results: unknown[]): unknown {
  if (results.length === 1) return results[0];
  return {
    batches: results.length,
    results
  };
}

export class GristService {
  constructor(
    private readonly client: GristClient,
    private readonly accessPolicy: AccessPolicy,
    private readonly options: GristServiceOptions
  ) {}

  get maxReadRecords(): number {
    return this.options.maxReadRecords;
  }

  get maxWriteRecords(): number {
    return this.options.maxWriteRecords;
  }

  get writeBatchRecords(): number {
    return this.options.writeBatchRecords;
  }

  get maxSchemaItems(): number {
    return this.options.maxSchemaItems;
  }

  async listDocuments(): Promise<unknown> {
    return {
      documents: (await this.accessPolicy.listAllowedDocuments()).map(
        ({ org, workspace, document }) => ({
          org: {
            id: org.id,
            name: org.name,
            domain: org.domain
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            access: workspace.access
          },
          document
        })
      )
    };
  }

  async listTables(
    documentIdOrUrl: string,
    options: { expandColumns?: boolean } = {}
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    return this.client.listTables(documentId, options);
  }

  async createTables(
    documentIdOrUrl: string,
    tables: GristTableSpec[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertSchemaCount(tables.length);
    this.assertUniqueStrings(tables.map((table) => table.id), "Table IDs");
    for (const table of tables) {
      this.assertIdentifier(table.id, "Table ID");
      if (table.columns) {
        this.assertSchemaCount(table.columns.length);
        this.assertUniqueStrings(table.columns.map((column) => column.id), "Column IDs");
      }
    }
    return this.client.createTables(documentId, tables);
  }

  async updateTables(
    documentIdOrUrl: string,
    tables: GristTableUpdate[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertSchemaCount(tables.length);
    this.assertUniqueStrings(tables.map((table) => table.id), "Table IDs");
    for (const table of tables) this.assertIdentifier(table.id, "Table ID");
    return this.client.updateTables(documentId, tables);
  }

  async deleteTable(documentIdOrUrl: string, tableId: string): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    return this.client.applyUserActions(documentId, [["RemoveTable", tableId]]);
  }

  async listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options: { hidden?: boolean } = {}
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    return this.client.listColumns(documentId, tableId, options);
  }

  async createColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnSpec[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    this.assertSchemaCount(columns.length);
    this.assertUniqueStrings(columns.map((column) => column.id), "Column IDs");
    for (const column of columns) this.assertIdentifier(column.id, "Column ID");
    return this.client.createColumns(documentId, tableId, columns);
  }

  async updateColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnUpdate[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    this.assertSchemaCount(columns.length);
    this.assertUniqueStrings(columns.map((column) => column.id), "Column IDs");
    for (const column of columns) this.assertIdentifier(column.id, "Column ID");
    return this.client.updateColumns(documentId, tableId, columns);
  }

  async renameColumn(
    documentIdOrUrl: string,
    tableId: string,
    oldColumnId: string,
    newColumnId: string
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    this.assertIdentifier(oldColumnId, "Old column ID");
    this.assertIdentifier(newColumnId, "New column ID");
    if (oldColumnId === newColumnId) {
      throw new Error("New column ID must differ from the current column ID.");
    }
    return this.client.applyUserActions(documentId, [
      ["RenameColumn", tableId, oldColumnId, newColumnId]
    ]);
  }

  async deleteColumns(
    documentIdOrUrl: string,
    tableId: string,
    columnIds: string[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertIdentifier(tableId, "Table ID");
    this.assertSchemaCount(columnIds.length);
    this.assertUniqueStrings(columnIds, "Column IDs");
    for (const columnId of columnIds) this.assertIdentifier(columnId, "Column ID");

    const results: unknown[] = [];
    for (const columnId of columnIds) {
      results.push(await this.client.deleteColumn(documentId, tableId, columnId));
    }
    return batchedResult(results);
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: QueryRecordsOptions = {}
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    const requestedLimit = options.limit ?? this.defaultReadLimit();
    this.assertReadLimit(requestedLimit);

    return this.client.queryRecords(documentId, tableId, {
      ...(options.filter ? { filter: options.filter } : {}),
      ...(options.sort ? { sort: options.sort } : {}),
      limit: requestedLimit,
      ...(options.hidden !== undefined ? { hidden: options.hidden } : {}),
      ...(options.cellFormat ? { cellFormat: options.cellFormat } : {})
    });
  }

  async createRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: NewGristRecord[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertWriteCount(records.length);
    const results: unknown[] = [];
    for (const batch of chunk(records, this.options.writeBatchRecords)) {
      results.push(await this.client.createRecords(documentId, tableId, batch));
    }
    return batchedResult(results);
  }

  async updateRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertWriteCount(records.length);
    const results: unknown[] = [];
    for (const batch of chunk(records, this.options.writeBatchRecords)) {
      results.push(await this.client.updateRecords(documentId, tableId, batch));
    }
    return batchedResult(results);
  }

  async deleteRecords(
    documentIdOrUrl: string,
    tableId: string,
    recordIds: number[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertRecordIds(recordIds);
    this.assertWriteCount(recordIds.length);
    const results: unknown[] = [];
    for (const batch of chunk(recordIds, this.options.writeBatchRecords)) {
      results.push(await this.client.deleteRecords(documentId, tableId, batch));
    }
    return batchedResult(results);
  }

  private defaultReadLimit(): number {
    if (this.options.maxReadRecords === 0) return 50;
    return Math.min(50, this.options.maxReadRecords);
  }

  private assertReadLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Read limit must be a positive integer.");
    }
    if (this.options.maxReadRecords > 0 && limit > this.options.maxReadRecords) {
      throw new Error(
        `Read limit ${limit} exceeds configured maximum ${this.options.maxReadRecords}.`
      );
    }
  }

  private assertWriteCount(count: number): void {
    if (count < 1) {
      throw new Error("At least one record is required.");
    }
    if (this.options.maxWriteRecords > 0 && count > this.options.maxWriteRecords) {
      throw new Error(
        `Write count ${count} exceeds configured maximum ${this.options.maxWriteRecords}.`
      );
    }
  }

  private assertSchemaCount(count: number): void {
    if (count < 1) {
      throw new Error("At least one schema item is required.");
    }
    if (this.options.maxSchemaItems > 0 && count > this.options.maxSchemaItems) {
      throw new Error(
        `Schema item count ${count} exceeds configured maximum ${this.options.maxSchemaItems}.`
      );
    }
  }

  private assertIdentifier(value: string, label: string): void {
    if (!value.trim()) throw new Error(`${label} must not be empty.`);
  }

  private assertUniqueStrings(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new Error(`${label} must be unique.`);
    }
  }

  private assertRecordIds(recordIds: number[]): void {
    if (recordIds.some((id) => !Number.isInteger(id) || id < 1)) {
      throw new Error("Record IDs must be positive integers.");
    }
    if (new Set(recordIds).size !== recordIds.length) {
      throw new Error("Record IDs must be unique.");
    }
  }
}
