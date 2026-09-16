import assert from "node:assert/strict";
import test from "node:test";

import type { GristClient } from "../src/grist/client.js";
import { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function harness(retValues: unknown[] = []) {
  const observed: unknown[][][] = [];
  const client = {
    applyUserActions: async (_documentId: string, actions: unknown[][]) => {
      observed.push(actions);
      return { actionNum: 1, retValues };
    }
  } as Pick<GristClient, "applyUserActions">;
  return { adapter: new GristUiActionsAdapter(client), observed };
}

test("createEmptyPage emits exactly one bounded AddView action", async () => {
  const { adapter, observed } = harness([{ id: 7, sections: [] }]);

  const result = await adapter.createEmptyPage("doc-1", "Personnes", "Vue générale");

  assert.deepEqual(result, { pageId: 7 });
  assert.deepEqual(observed, [
    [["AddView", "Personnes", "empty", "Vue générale"]]
  ]);
});

test("addPageWidget emits exactly one bounded CreateViewSection action", async () => {
  const { adapter, observed } = harness([
    { tableRef: 2, viewRef: 7, sectionRef: 11 }
  ]);

  const result = await adapter.addPageWidget(
    "doc-1",
    7,
    2,
    "record"
  );

  assert.deepEqual(result, { pageId: 7, tableRef: 2, widgetId: 11 });
  assert.deepEqual(observed, [
    [["CreateViewSection", 2, 7, "record", null, null]]
  ]);
});

test("renamePage emits only the bounded _grist_Views name update", async () => {
  const { adapter, observed } = harness();

  await adapter.renamePage("doc-1", 7, "Nouvelle page");

  assert.deepEqual(observed, [
    [["UpdateRecord", "_grist_Views", 7, { name: "Nouvelle page" }]]
  ]);
});

test("updatePageWidget combines title and direct select-by in one bounded action", async () => {
  const { adapter, observed } = harness();

  await adapter.updatePageWidget("doc-1", 11, {
    title: "Fiche personne",
    selectBy: { sourceSectionId: 9 }
  });

  assert.deepEqual(observed, [
    [["UpdateRecord", "_grist_Views_section", 11, {
      title: "Fiche personne",
      linkSrcSectionRef: 9,
      linkSrcColRef: 0,
      linkTargetColRef: 0
    }]]
  ]);
});

test("updatePageWidget clears all three select-by references atomically", async () => {
  const { adapter, observed } = harness();

  await adapter.updatePageWidget("doc-1", 11, { selectBy: null });

  assert.deepEqual(observed, [
    [["UpdateRecord", "_grist_Views_section", 11, {
      linkSrcSectionRef: 0,
      linkSrcColRef: 0,
      linkTargetColRef: 0
    }]]
  ]);
});

test("adapter fails closed on inconsistent Grist return identifiers", async () => {
  const { adapter } = harness([
    { tableRef: 2, viewRef: 8, sectionRef: 11 }
  ]);

  await assert.rejects(
    () => adapter.addPageWidget("doc-1", 7, 2, "record"),
    /inconsistent identifiers/
  );
});
