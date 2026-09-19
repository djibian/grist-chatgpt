export interface FormulaColumnMetadata {
  id: string;
  type: string;
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

export interface FormulaAnalysis {
  references: FormulaReferenceFinding[];
  truncated: boolean;
}

const MAX_REFERENCES = 100;
const MAX_SUGGESTIONS = 3;

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

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function extractReferences(formula: string): { references: string[]; truncated: boolean } {
  const references: string[] = [];
  const seen = new Set<string>();
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
          return { references, truncated: true };
        }
        seen.add(reference);
        references.push(reference);
      }
      index = end;
      continue;
    }

    index++;
  }

  return { references, truncated: false };
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

/**
 * Advisory lexical inspection only. It never executes or rewrites a Grist formula.
 * References inside Python comments and quoted string literals are deliberately ignored.
 */
export class FormulaInspector {
  inspect(
    formula: string,
    columns: readonly FormulaColumnMetadata[]
  ): FormulaAnalysis {
    const extracted = extractReferences(formula);
    const exact = new Map(columns.map(column => [column.id, column] as const));
    const caseInsensitive = new Map<string, FormulaColumnMetadata[]>();
    for (const column of columns) {
      const key = column.id.toLowerCase();
      const matches = caseInsensitive.get(key) ?? [];
      matches.push(column);
      caseInsensitive.set(key, matches);
    }

    const references = extracted.references.map((reference): FormulaReferenceFinding => {
      const resolved = exact.get(reference);
      if (resolved) {
        return {
          reference,
          status: "ok",
          resolved: columnHint(resolved)
        };
      }

      const caseMatches = caseInsensitive.get(reference.toLowerCase()) ?? [];
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
    });

    return { references, truncated: extracted.truncated };
  }
}
