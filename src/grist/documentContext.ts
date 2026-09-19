import type { DocumentUiContext } from "./documentUi.js";
import {
  FormulaInspector,
  type FormulaColumnMetadata,
  type FormulaTableMetadata
} from "./formulaInspector.js";

type JsonRecord = Record<string, unknown>;
type RelationKind = "Ref" | "RefList";

type ParsedColumn = {
  tableId: string;
  id: string;
  fields: JsonRecord;
  type: string;
};

type ParsedRelationType = {
  kind: RelationKind;
  targetTable: string;
};

type DocumentRelation = {
  sourceTable: string;
  sourceColumn: string;
  kind: RelationKind;
  targetTable: string;
  reverse?: {
    table: string;
    column: string;
    kind: RelationKind;
  };
  reverseResolutionIncomplete?: true;
};

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

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function relationType(type: string): ParsedRelationType | undefined {
  const match = /^(Ref|RefList):(.+)$/.exec(type);
  if (!match) return undefined;
  return {
    kind: match[1] as RelationKind,
    targetTable: match[2]!
  };
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
    const parsedTables = sourceTables.flatMap((value) => {
      const table = record(value);
      const tableId = text(table?.id);
      if (!tableId) return [];
      const sourceColumns = Array.isArray(table?.columns) ? table.columns : [];
      const columns: ParsedColumn[] = sourceColumns.flatMap((columnValue) => {
        const column = record(columnValue);
        const columnId = text(column?.id);
        if (!columnId) return [];
        const fields = record(column?.fields) ?? {};
        return [{
          tableId,
          id: columnId,
          fields,
          type: text(fields.type) ?? "Any"
        }];
      });
      return [{ id: tableId, columns }];
    });

    const formulaTables: FormulaTableMetadata[] = parsedTables.map(table => ({
      id: table.id,
      columns: table.columns.map(column => ({ id: column.id, type: column.type }))
    }));

    const columnByRef = new Map<number, ParsedColumn>();
    for (const table of parsedTables) {
      for (const column of table.columns) {
        const colRef = positiveInteger(column.fields.colRef);
        if (colRef !== undefined) columnByRef.set(colRef, column);
      }
    }

    const relations: DocumentRelation[] = [];
    let formulaReferenceCount = 0;
    let formulaDereferenceCount = 0;
    let formulaDereferenceWarningCount = 0;
    let formulaWarningCount = 0;

    const tables = parsedTables.map((table) => {
      const formulaColumns: FormulaColumnMetadata[] = table.columns.map(column => ({
        id: column.id,
        type: column.type
      }));

      const columns = table.columns.map((column) => {
        const relation = relationType(column.type);
        if (relation) {
          const normalized: DocumentRelation = {
            sourceTable: table.id,
            sourceColumn: column.id,
            kind: relation.kind,
            targetTable: relation.targetTable
          };

          const reverseRef = positiveInteger(column.fields.reverseCol);
          if (reverseRef !== undefined) {
            const sourceRef = positiveInteger(column.fields.colRef);
            const reverseColumn = columnByRef.get(reverseRef);
            const reverseRelation = reverseColumn
              ? relationType(reverseColumn.type)
              : undefined;
            const reverseBackRef = reverseColumn
              ? positiveInteger(reverseColumn.fields.reverseCol)
              : undefined;

            if (
              sourceRef !== undefined &&
              reverseColumn !== undefined &&
              reverseRelation !== undefined &&
              reverseColumn.tableId === relation.targetTable &&
              reverseRelation.targetTable === table.id &&
              reverseBackRef === sourceRef
            ) {
              normalized.reverse = {
                table: reverseColumn.tableId,
                column: reverseColumn.id,
                kind: reverseRelation.kind
              };
            } else {
              normalized.reverseResolutionIncomplete = true;
            }
          }

          relations.push(normalized);
        }

        const isFormula = boolean(column.fields.isFormula) ?? false;
        const formula = text(column.fields.formula);
        const formulaAnalysis = isFormula && formula
          ? this.formulaInspector.inspect(formula, formulaColumns, formulaTables)
          : undefined;
        if (formulaAnalysis) {
          const referenceWarnings = formulaAnalysis.references.filter(
            reference => reference.status !== "ok"
          ).length;
          const dereferences = formulaAnalysis.dereferences ?? [];
          const dereferenceWarnings = dereferences.filter(
            dereference => dereference.status !== "ok"
          ).length;
          formulaReferenceCount += formulaAnalysis.references.length;
          formulaDereferenceCount += dereferences.length;
          formulaDereferenceWarningCount += dereferenceWarnings;
          formulaWarningCount += referenceWarnings + dereferenceWarnings;
        }

        return {
          id: column.id,
          label: text(column.fields.label) ?? column.id,
          type: column.type,
          isFormula,
          ...(formula ? { formula } : {}),
          ...(formulaAnalysis ? { formulaAnalysis } : {})
        };
      });
      return [{ id: table.id, columns }];
    }).flat();

    return {
      documentId,
      summary: {
        tableCount: tables.length,
        columnCount: tables.reduce((count, table) => count + table.columns.length, 0),
        relationCount: relations.length,
        formulaReferenceCount,
        formulaDereferenceCount,
        formulaDereferenceWarningCount,
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
