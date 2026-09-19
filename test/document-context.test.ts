import assert from "node:assert/strict";
import test from "node:test";

import { DocumentContextService } from "../src/grist/documentContext.js";

test("summarizes tables, formulas and Ref relationships without records", () => {
  const tableResponse = {
    tables: [
      {
        id: "Eleves",
        columns: [
          { id: "Nom", fields: { label: "Nom", type: "Text" } },
          {
            id: "Enseignant",
            fields: { label: "Enseignant", type: "Ref:Enseignants" }
          },
          {
            id: "Libelle",
            fields: {
              label: "Libellé",
              type: "Text",
              isFormula: true,
              formula: "$Nom.upper()"
            }
          }
        ]
      },
      {
        id: "Enseignants",
        columns: [{ id: "Nom", fields: { label: "Nom", type: "Text" } }]
      }
    ]
  };

  const context = new DocumentContextService().build("doc-1", tableResponse) as {
    summary: {
      tableCount: number;
      columnCount: number;
      relationCount: number;
      formulaReferenceCount: number;
      formulaWarningCount: number;
    };
    tables: Array<{
      id: string;
      columns: Array<{
        id: string;
        formula?: string;
        formulaAnalysis?: {
          references: Array<{ reference: string; status: string }>;
          truncated: boolean;
        };
      }>;
    }>;
    relations: Array<{
      sourceTable: string;
      sourceColumn: string;
      kind: "Ref" | "RefList";
      targetTable: string;
    }>;
  };

  assert.deepEqual(context.summary, {
    tableCount: 2,
    columnCount: 4,
    relationCount: 1,
    formulaReferenceCount: 1,
    formulaWarningCount: 0
  });
  assert.equal(context.tables[0]?.columns[2]?.formula, "$Nom.upper()");
  assert.deepEqual(context.tables[0]?.columns[2]?.formulaAnalysis, {
    references: [
      {
        reference: "Nom",
        status: "ok",
        resolved: { columnId: "Nom", type: "Text" }
      }
    ],
    truncated: false
  });
  assert.deepEqual(context.relations, [
    {
      sourceTable: "Eleves",
      sourceColumn: "Enseignant",
      kind: "Ref",
      targetTable: "Enseignants"
    }
  ]);
});

test("surfaces advisory formula warnings in compact document context", () => {
  const tableResponse = {
    tables: [
      {
        id: "Eleves",
        columns: [
          { id: "Nom", fields: { type: "Text" } },
          { id: "Age", fields: { type: "Numeric" } },
          {
            id: "Diagnostic",
            fields: {
              type: "Text",
              isFormula: true,
              formula: "$nom + $Ag"
            }
          }
        ]
      }
    ]
  };

  const context = new DocumentContextService().build("doc-1", tableResponse) as {
    summary: { formulaReferenceCount: number; formulaWarningCount: number };
    tables: Array<{ columns: Array<{ formulaAnalysis?: unknown }> }>;
  };

  assert.equal(context.summary.formulaReferenceCount, 2);
  assert.equal(context.summary.formulaWarningCount, 2);
  assert.deepEqual(context.tables[0]?.columns[2]?.formulaAnalysis, {
    references: [
      {
        reference: "nom",
        status: "case_mismatch",
        suggestion: { columnId: "Nom", type: "Text" }
      },
      {
        reference: "Ag",
        status: "missing",
        suggestions: [{ columnId: "Age", type: "Numeric" }]
      }
    ],
    truncated: false
  });
});
