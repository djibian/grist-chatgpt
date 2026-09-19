import {
  OPERATION_REGISTRY,
  getOperation,
  operationHelp as registryOperationHelp,
  type OperationCategory,
  type OperationDefinition
} from "./registry.js";

export interface ProgressiveHelpOptions {
  operations?: readonly string[];
  category?: OperationCategory;
  includeWorkflows?: boolean;
}

export interface HelpWorkflow {
  id: string;
  summary: string;
  steps: Array<{
    operation: string;
    title: string;
    capability: OperationDefinition["capability"];
    destructive: boolean;
  }>;
}

const WORKFLOW_SPECS = [
  {
    id: "discover-and-inspect",
    summary: "Find an allowed document, then inspect its semantic structure before complex work.",
    operations: ["list_documents", "inspect_document"]
  },
  {
    id: "read-bounded-records",
    summary: "Discover table/column IDs before issuing a bounded filtered record query.",
    operations: ["list_tables", "list_columns", "query_records"]
  },
  {
    id: "create-records-and-verify",
    summary: "Inspect the target schema, create records, then re-read the created rows for verification.",
    operations: ["list_columns", "create_records", "query_records"]
  },
  {
    id: "change-schema-and-verify",
    summary: "Inspect current schema, perform one bounded schema change, then inspect schema again.",
    operations: ["list_tables", "list_columns", "update_columns", "list_columns"]
  },
  {
    id: "inspect-and-configure-ui",
    summary: "Inspect pages/widgets, apply one bounded widget configuration, then re-read the widget state.",
    operations: ["get_pages", "get_page_widgets", "update_page_widget", "get_page_widgets"]
  }
] as const;

function workflow(spec: (typeof WORKFLOW_SPECS)[number]): HelpWorkflow {
  return {
    id: spec.id,
    summary: spec.summary,
    steps: spec.operations.map((name) => {
      const operation = getOperation(name);
      return {
        operation: operation.name,
        title: operation.title,
        capability: operation.capability,
        destructive: operation.destructive
      };
    })
  };
}

export function progressiveOperationHelp(options: ProgressiveHelpOptions = {}) {
  if (options.operations && options.category) {
    throw new Error("Filter Grist help by operations or category, not both.");
  }

  const operations = options.category
    ? OPERATION_REGISTRY.filter((operation) => operation.category === options.category)
    : registryOperationHelp(options.operations).operations;

  const categoryCounts = new Map<OperationCategory, number>();
  for (const operation of OPERATION_REGISTRY) {
    categoryCounts.set(
      operation.category,
      (categoryCounts.get(operation.category) ?? 0) + 1
    );
  }

  return {
    categories: [...categoryCounts.entries()].map(([category, operationCount]) => ({
      category,
      operationCount
    })),
    operations,
    ...(options.includeWorkflows
      ? { workflows: WORKFLOW_SPECS.map(workflow) }
      : {})
  };
}
