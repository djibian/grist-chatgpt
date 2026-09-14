import { AccessPolicy } from "./accessPolicy.js";
import {
  GristClient,
  type NewGristRecord,
  type UpdateGristRecord
} from "./client.js";

export interface GristServiceOptions {
  maxReadRecords: number;
  maxWriteRecords: number;
}

export interface QueryRecordsOptions {
  filter?: Record<string, unknown[]>;
  sort?: string;
  limit?: number;
  hidden?: boolean;
  cellFormat?: "normal" | "typed";
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
    return this.client.createRecords(documentId, tableId, records);
  }

  async updateRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    const documentId = await this.accessPolicy.assertDocumentAllowed(documentIdOrUrl);
    this.assertWriteCount(records.length);
    return this.client.updateRecords(documentId, tableId, records);
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
}
