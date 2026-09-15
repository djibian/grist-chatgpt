interface TableReader {
  listTables(
    documentIdOrUrl: string,
    options?: { expandColumns?: boolean }
  ): Promise<unknown>;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export class DocumentContextService {
  constructor(private readonly grist: TableReader) {}

  async inspect(documentId: string): Promise<unknown> {
    const raw = record(await this.grist.listTables(documentId, { expandColumns: true }));
    const sourceTables = Array.isArray(raw?.tables) ? raw.tables : [];
    const relations: Array<{
      sourceTable: string;
      sourceColumn: string;
      kind: "Ref" | "RefList";
      targetTable: string;
    }> = [];

    const tables = sourceTables.flatMap((value) => {
      const table = record(value);
      const tableId = text(table?.id);
      if (!tableId) return [];
      const sourceColumns = Array.isArray(table?.columns) ? table.columns : [];
      const columns = sourceColumns.flatMap((columnValue) => {
        const column = record(columnValue);
        const columnId = text(column?.id);
        if (!columnId) return [];
        const fields = record(column?.fields) ?? {};
        const type = text(fields.type) ?? "Any";
        const match = /^(Ref|RefList):(.+)$/.exec(type);
        if (match) {
          relations.push({
            sourceTable: tableId,
            sourceColumn: columnId,
            kind: match[1] as "Ref" | "RefList",
            targetTable: match[2]!
          });
        }
        return [
          {
            id: columnId,
            label: text(fields.label) ?? columnId,
            type,
            isFormula: boolean(fields.isFormula) ?? false,
            ...(text(fields.formula) ? { formula: text(fields.formula) } : {})
          }
        ];
      });
      return [{ id: tableId, columns }];
    });

    return {
      documentId,
      summary: {
        tableCount: tables.length,
        columnCount: tables.reduce((count, table) => count + table.columns.length, 0),
        relationCount: relations.length
      },
      tables,
      relations
    };
  }
}
