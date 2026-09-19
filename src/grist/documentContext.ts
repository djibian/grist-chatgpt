import type { DocumentUiContext } from "./documentUi.js";
import { FormulaInspector, type FormulaColumnMetadata } from "./formulaInspector.js";

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
  private readonly formulaInspector = new FormulaInspector();

  build(
    documentId: string,
    tableResponse: unknown,
    ui?: DocumentUiContext
  ): unknown {
    const raw = record(tableResponse);
    const sourceTables = Array.isArray(raw?.tables) ? raw.tables : [];
    const relations: Array<{
      sourceTable: string;
      sourceColumn: string;
      kind: "Ref" | "RefList";
      targetTable: string;
    }> = [];
    let formulaReferenceCount = 0;
    let formulaWarningCount = 0;

    const tables = sourceTables.flatMap((value) => {
      const table = record(value);
      const tableId = text(table?.id);
      if (!tableId) return [];
      const sourceColumns = Array.isArray(table?.columns) ? table.columns : [];
      const parsedColumns = sourceColumns.flatMap((columnValue) => {
        const column = record(columnValue);
        const columnId = text(column?.id);
        if (!columnId) return [];
        const fields = record(column?.fields) ?? {};
        const type = text(fields.type) ?? "Any";
        return [{ id: columnId, fields, type }];
      });
      const formulaColumns: FormulaColumnMetadata[] = parsedColumns.map(column => ({
        id: column.id,
        type: column.type
      }));

      const columns = parsedColumns.map(({ id: columnId, fields, type }) => {
        const match = /^(Ref|RefList):(.+)$/.exec(type);
        if (match) {
          relations.push({
            sourceTable: tableId,
            sourceColumn: columnId,
            kind: match[1] as "Ref" | "RefList",
            targetTable: match[2]!
          });
        }

        const isFormula = boolean(fields.isFormula) ?? false;
        const formula = text(fields.formula);
        const formulaAnalysis = isFormula && formula
          ? this.formulaInspector.inspect(formula, formulaColumns)
          : undefined;
        if (formulaAnalysis) {
          formulaReferenceCount += formulaAnalysis.references.length;
          formulaWarningCount += formulaAnalysis.references.filter(
            reference => reference.status !== "ok"
          ).length;
        }

        return {
          id: columnId,
          label: text(fields.label) ?? columnId,
          type,
          isFormula,
          ...(formula ? { formula } : {}),
          ...(formulaAnalysis ? { formulaAnalysis } : {})
        };
      });
      return [{ id: tableId, columns }];
    });

    return {
      documentId,
      summary: {
        tableCount: tables.length,
        columnCount: tables.reduce((count, table) => count + table.columns.length, 0),
        relationCount: relations.length,
        formulaReferenceCount,
        formulaWarningCount,
        ...(ui
          ? {
              pageCount: ui.summary.pageCount,
              widgetCount: ui.summary.widgetCount
            }
          : {})
      },
      tables,
      relations,
      ...(ui ? { ui } : {})
    };
  }
}
