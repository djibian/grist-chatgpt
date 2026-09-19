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
