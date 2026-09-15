import assert from "node:assert/strict";
import test from "node:test";

import { DocumentContextService } from "../src/grist/documentContext.js";

test("summarizes tables, formulas and Ref relationships without records", async () => {
  const reader = {
    listTables: async (_documentId: string, options?: { expandColumns?: boolean }) => {
      assert.equal(options?.expandColumns, true);
      return {
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
            columns: [
              { id: "Nom", fields: { label: "Nom", type: "Text" } }
            ]
          }
        ]
      };
    }
  };

  const context = (await new DocumentContextService(reader).inspect("doc-1")) as {
    summary: { tableCount: number; columnCount: number; relationCount: number };
    tables: Array<{ id: string; columns: Array<{ id: string; formula?: string }> }>;
    relations: Array<{ sourceTable: string; sourceColumn: string; targetTable: string }>;
  };

  assert.deepEqual(context.summary, {
    tableCount: 2,
    columnCount: 4,
    relationCount: 1
  });
  assert.equal(context.tables[0]?.columns[2]?.formula, "$Nom.upper()");
  assert.deepEqual(context.relations, [
    {
      sourceTable: "Eleves",
      sourceColumn: "Enseignant",
      kind: "Ref",
      targetTable: "Enseignants"
    }
  ]);
});
