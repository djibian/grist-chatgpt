import assert from "node:assert/strict";
import test from "node:test";

import { FormulaInspector } from "../src/grist/formulaInspector.js";

const columns = [
  { id: "Nom", type: "Text" },
  { id: "Age", type: "Numeric" },
  { id: "Enseignant", type: "Ref:Enseignants" },
  { id: "Groupes", type: "RefList:Groupes" }
];

test("inspects formula column references without executing or rewriting them", () => {
  const analysis = new FormulaInspector().inspect(
    `$Nom + $nom + $No + $Enseignant.Nom + $Groupes\n` +
      `# $Commentaire is not a reference\n` +
      `"$DansUneChaine" + '$AutreChaine' + '''$Triple'''`,
    columns
  );

  assert.equal(analysis.truncated, false);
  assert.deepEqual(analysis.references, [
    {
      reference: "Nom",
      status: "ok",
      resolved: { columnId: "Nom", type: "Text" }
    },
    {
      reference: "nom",
      status: "case_mismatch",
      suggestion: { columnId: "Nom", type: "Text" }
    },
    {
      reference: "No",
      status: "missing",
      suggestions: [{ columnId: "Nom", type: "Text" }]
    },
    {
      reference: "Enseignant",
      status: "ok",
      resolved: {
        columnId: "Enseignant",
        type: "Ref:Enseignants",
        referenceTarget: { kind: "Ref", tableId: "Enseignants" }
      }
    },
    {
      reference: "Groupes",
      status: "ok",
      resolved: {
        columnId: "Groupes",
        type: "RefList:Groupes",
        referenceTarget: { kind: "RefList", tableId: "Groupes" }
      }
    }
  ]);
});

test("deduplicates references and bounds advisory analysis", () => {
  const formula = ["$Nom", "$Nom", ...Array.from({ length: 101 }, (_, index) => `$C${index}`)].join(" + ");
  const analysis = new FormulaInspector().inspect(formula, columns);

  assert.equal(analysis.truncated, true);
  assert.equal(analysis.references.length, 100);
  assert.equal(analysis.references[0]?.reference, "Nom");
  assert.equal(analysis.references[1]?.reference, "C0");
  assert.equal(analysis.references[99]?.reference, "C98");
});

test("does not guess a unique case correction when identifiers are ambiguous", () => {
  const analysis = new FormulaInspector().inspect("$name", [
    { id: "Name", type: "Text" },
    { id: "NAME", type: "Text" }
  ]);

  assert.equal(analysis.references[0]?.status, "missing");
  assert.deepEqual(
    analysis.references[0]?.status === "missing"
      ? analysis.references[0].suggestions.map(suggestion => suggestion.columnId)
      : [],
    ["NAME", "Name"]
  );
});

test("checks one-hop Ref and RefList fields against referenced table metadata", () => {
  const analysis = new FormulaInspector().inspect(
    [
      "$Enseignant.Nom",
      "$Enseignant.nom",
      "$Enseignant.No",
      "$Groupes.Libelle",
      "$Enseignant.id",
      "$Enseignant.Nom.upper()",
      "$Groupes.find.le(1)",
      "$Nom.upper()"
    ].join(" + "),
    columns,
    [
      {
        id: "Enseignants",
        columns: [
          { id: "Nom", type: "Text" },
          { id: "Bureau", type: "Text" }
        ]
      },
      {
        id: "Groupes",
        columns: [{ id: "Libelle", type: "Text" }]
      }
    ]
  );

  assert.deepEqual(analysis.dereferences, [
    {
      path: "$Enseignant.Nom",
      sourceColumnId: "Enseignant",
      targetTableId: "Enseignants",
      field: "Nom",
      status: "ok",
      resolved: { columnId: "Nom", type: "Text" }
    },
    {
      path: "$Enseignant.nom",
      sourceColumnId: "Enseignant",
      targetTableId: "Enseignants",
      field: "nom",
      status: "case_mismatch",
      suggestion: { columnId: "Nom", type: "Text" }
    },
    {
      path: "$Enseignant.No",
      sourceColumnId: "Enseignant",
      targetTableId: "Enseignants",
      field: "No",
      status: "missing",
      suggestions: [{ columnId: "Nom", type: "Text" }]
    },
    {
      path: "$Groupes.Libelle",
      sourceColumnId: "Groupes",
      targetTableId: "Groupes",
      field: "Libelle",
      status: "ok",
      resolved: { columnId: "Libelle", type: "Text" }
    }
  ]);
  assert.equal(analysis.dereferencesTruncated, undefined);
});

test("does not invent dereference diagnostics when target metadata is unavailable", () => {
  const analysis = new FormulaInspector().inspect(
    "$Enseignant.Nom",
    columns,
    []
  );

  assert.equal(analysis.references[0]?.status, "ok");
  assert.equal(analysis.dereferences, undefined);
});

test("bounds one-hop dereference analysis independently", () => {
  const targetColumns = Array.from({ length: 101 }, (_, index) => ({
    id: `C${index}`,
    type: "Text"
  }));
  const formula = targetColumns.map(column => `$Enseignant.${column.id}`).join(" + ");
  const analysis = new FormulaInspector().inspect(formula, columns, [
    { id: "Enseignants", columns: targetColumns }
  ]);

  assert.equal(analysis.references.length, 1);
  assert.equal(analysis.dereferences?.length, 100);
  assert.equal(analysis.dereferencesTruncated, true);
});
