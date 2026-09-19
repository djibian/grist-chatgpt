export interface FormulaColumnMetadata {
  id: string;
  type: string;
}

export interface FormulaTableMetadata {
  id: string;
  columns: readonly FormulaColumnMetadata[];
}

export interface FormulaColumnHint {
  columnId: string;
  type: string;
  referenceTarget?: {
    kind: "Ref" | "RefList";
    tableId: string;
  };
}

export type FormulaReferenceFinding =
  | {
      reference: string;
      status: "ok";
      resolved: FormulaColumnHint;
    }
  | {
      reference: string;
      status: "case_mismatch";
      suggestion: FormulaColumnHint;
    }
  | {
      reference: string;
      status: "missing";
      suggestions: FormulaColumnHint[];
    };

export type FormulaDereferenceFinding =
  | {
      path: string;
      sourceColumnId: string;
      targetTableId: string;
      field: string;
      status: "ok";
      resolved: FormulaColumnHint;
    }
  | {
      path: string;
      sourceColumnId: string;
      targetTableId: string;
      field: string;
      status: "case_mismatch";
      suggestion: FormulaColumnHint;
    }
  | {
      path: string;
      sourceColumnId: string;
      targetTableId: string;
      field: string;
      status: "missing";
      suggestions: FormulaColumnHint[];
    };

export interface FormulaAnalysis {
  references: FormulaReferenceFinding[];
  truncated: boolean;
  dereferences?: FormulaDereferenceFinding[];
  dereferencesTruncated?: boolean;
}

const MAX_REFERENCES = 100;
const MAX_DEREFERENCES = 100;
const MAX_SUGGESTIONS = 3;

type ExtractedDereference = {
  sourceReference: string;
  member: string;
};

function columnHint(column: FormulaColumnMetadata): FormulaColumnHint {
  const match = /^(Ref|RefList):(.+)$/.exec(column.type);
  return {
    columnId: column.id,
    type: column.type,
    ...(match
      ? {
          referenceTarget: {
            kind: match[1] as "Ref" | "RefList",
            tableId: match[2]!
          }
        }
      : {})
  };
}

function referenceTarget(type: string): { kind: "Ref" | "RefList"; tableId: string } | undefined {
  const match = /^(Ref|RefList):(.+)$/.exec(type);
  return match
    ? {
        kind: match[1] as "Ref" | "RefList",
        tableId: match[2]!
      }
    : undefined;
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function extractReferences(formula: string): {
  references: string[];
  dereferences: ExtractedDereference[];
  truncated: boolean;
  dereferencesTruncated: boolean;
} {
  const references: string[] = [];
  const seen = new Set<string>();
  const dereferences: ExtractedDereference[] = [];
  const seenDereferences = new Set<string>();
  let dereferencesTruncated = false;
  let index = 0;

  while (index < formula.length) {
    const character = formula[index]!;

    if (character === "#") {
      const newline = formula.indexOf("\n", index + 1);
      index = newline === -1 ? formula.length : newline + 1;
      continue;
    }

    if (character === "'" || character === '"') {
      const quote = character;
      const triple = formula.slice(index, index + 3) === quote.repeat(3);
      index += triple ? 3 : 1;
      while (index < formula.length) {
        if (formula[index] === "\\") {
          index += 2;
          continue;
        }
        if (triple) {
          if (formula.slice(index, index + 3) === quote.repeat(3)) {
            index += 3;
            break;
          }
          index++;
          continue;
        }
        if (formula[index] === quote) {
          index++;
          break;
        }
        index++;
      }
      continue;
    }

    if (character === "$" && isIdentifierStart(formula[index + 1])) {
      let end = index + 2;
      while (isIdentifierPart(formula[end])) end++;
      const reference = formula.slice(index + 1, end);
      if (!seen.has(reference)) {
        if (references.length === MAX_REFERENCES) {
          return {
            references,
            dereferences,
            truncated: true,
            dereferencesTruncated
          };
        }
        seen.add(reference);
        references.push(reference);
      }

      if (formula[end] === "." && isIdentifierStart(formula[end + 1])) {
        let memberEnd = end + 2;
        while (isIdentifierPart(formula[memberEnd])) memberEnd++;
        const member = formula.slice(end + 1, memberEnd);
        // A called attribute is method-like rather than a direct Grist field lookup.
        // Leave arbitrary Python/method semantics to Grist instead of guessing here.
        if (formula[memberEnd] !== "(") {
          const key = `${reference}\u0000${member}`;
          if (!seenDereferences.has(key)) {
            if (dereferences.length === MAX_DEREFERENCES) {
              dereferencesTruncated = true;
            } else {
              seenDereferences.add(key);
              dereferences.push({ sourceReference: reference, member });
            }
          }
        }
      }

      index = end;
      continue;
    }

    index++;
  }

  return {
    references,
    dereferences,
    truncated: false,
    dereferencesTruncated
  };
}

function editDistance(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    for (let column = 1; column <= b.length; column++) {
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }

  return previous[b.length] ?? Math.max(a.length, b.length);
}

function suggestionThreshold(reference: string): number {
  if (reference.length <= 4) return 1;
  if (reference.length <= 8) return 2;
  return 3;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function closeSuggestions(
  reference: string,
  columns: readonly FormulaColumnMetadata[]
): FormulaColumnHint[] {
  const threshold = suggestionThreshold(reference);
  return columns
    .map(column => ({ column, distance: editDistance(reference, column.id) }))
    .filter(candidate => candidate.distance <= threshold)
    .sort((left, right) =>
      left.distance - right.distance || compareIds(left.column.id, right.column.id)
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(candidate => columnHint(candidate.column));
}

function classifyReference(
  reference: string,
  columns: readonly FormulaColumnMetadata[]
): FormulaReferenceFinding {
  const exact = columns.find(column => column.id === reference);
  if (exact) {
    return {
      reference,
      status: "ok",
      resolved: columnHint(exact)
    };
  }

  const caseMatches = columns.filter(
    column => column.id.toLowerCase() === reference.toLowerCase()
  );
  if (caseMatches.length === 1) {
    return {
      reference,
      status: "case_mismatch",
      suggestion: columnHint(caseMatches[0]!)
    };
  }

  return {
    reference,
    status: "missing",
    suggestions: closeSuggestions(reference, columns)
  };
}

function classifyDereference(
  sourceColumnId: string,
  targetTableId: string,
  field: string,
  columns: readonly FormulaColumnMetadata[]
): FormulaDereferenceFinding {
  const path = `$${sourceColumnId}.${field}`;
  const exact = columns.find(column => column.id === field);
  if (exact) {
    return {
      path,
      sourceColumnId,
      targetTableId,
      field,
      status: "ok",
      resolved: columnHint(exact)
    };
  }

  const caseMatches = columns.filter(
    column => column.id.toLowerCase() === field.toLowerCase()
  );
  if (caseMatches.length === 1) {
    return {
      path,
      sourceColumnId,
      targetTableId,
      field,
      status: "case_mismatch",
      suggestion: columnHint(caseMatches[0]!)
    };
  }

  return {
    path,
    sourceColumnId,
    targetTableId,
    field,
    status: "missing",
    suggestions: closeSuggestions(field, columns)
  };
}

/**
 * Advisory lexical inspection only. It never executes or rewrites a Grist formula.
 * References inside Python comments and quoted string literals are deliberately ignored.
 * When document schema metadata is supplied, one-hop `$Ref.Field` / `$RefList.Field`
 * lookups are checked against the exact referenced table without attempting to interpret
 * arbitrary Python or deeper chains.
 */
export class FormulaInspector {
  inspect(
    formula: string,
    columns: readonly FormulaColumnMetadata[],
    tables: readonly FormulaTableMetadata[] = []
  ): FormulaAnalysis {
    const extracted = extractReferences(formula);
    const references = extracted.references.map(reference =>
      classifyReference(reference, columns)
    );

    const currentById = new Map(columns.map(column => [column.id, column] as const));
    const tableById = new Map(tables.map(table => [table.id, table] as const));
    const dereferences = extracted.dereferences.flatMap(candidate => {
      const source = currentById.get(candidate.sourceReference);
      const target = source ? referenceTarget(source.type) : undefined;
      if (!source || !target) return [];

      // `id` is an implicit Grist record attribute and may not be present in expanded
      // table-column metadata. Avoid manufacturing a missing-column warning for it.
      if (candidate.member === "id") return [];

      const targetTable = tableById.get(target.tableId);
      if (!targetTable) return [];
      return [
        classifyDereference(
          source.id,
          target.tableId,
          candidate.member,
          targetTable.columns
        )
      ];
    });

    return {
      references,
      truncated: extracted.truncated,
      ...(dereferences.length > 0 ? { dereferences } : {}),
      ...(extracted.dereferencesTruncated ? { dereferencesTruncated: true } : {})
    };
  }
}
