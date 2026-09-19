import type { DocumentUiContext, GristPageWidget } from "./documentUi.js";

// One index per snapshot, and one graph walk per source, shared across targets.
export function directSelectByValidator(context: DocumentUiContext) {
  const widgets = new Map(context.pages.flatMap(page => page.widgets.map(widget => [widget.id, widget] as const)));
  const paths = new Map<number, { ancestors: Set<number>; cycle: boolean }>();
  return (source: GristPageWidget, target: GristPageWidget): void => {
    if (source.id === target.id) throw new Error("A Grist widget cannot select itself.");
    if (source.pageId !== target.pageId) {
      throw new Error("Direct select-by is limited to widgets on the same Grist page.");
    }
    if (source.tableRef !== target.tableRef || source.tableId !== target.tableId) {
      throw new Error("This tranche only allows direct select-by between widgets backed by the same Grist table.");
    }
    if (source.type === "chart" || source.type === "custom") {
      throw new Error(`Widget type "${source.type}" is not allowed as a direct select-by source in this safe subset.`);
    }
    let path = paths.get(source.id);
    if (!path) {
      const ancestors = new Set<number>();
      const visited = new Set<number>();
      let current: GristPageWidget | undefined = source;
      let cycle = false;
      while (current?.selectBy?.sourceSectionId) {
        if (visited.has(current.id)) { cycle = true; break; }
        visited.add(current.id);
        ancestors.add(current.selectBy.sourceSectionId);
        current = widgets.get(current.selectBy.sourceSectionId);
      }
      path = { ancestors, cycle };
      paths.set(source.id, path);
    }
    if (path.ancestors.has(target.id)) {
      throw new Error("The requested select-by link would create a cycle; refusing the update.");
    }
    if (path.cycle) {
      throw new Error("The existing select-by graph already contains a cycle; refusing to modify it.");
    }
  };
}

export function assertDirectSelectByAllowed(
  context: DocumentUiContext, source: GristPageWidget, target: GristPageWidget
): void {
  directSelectByValidator(context)(source, target);
}
