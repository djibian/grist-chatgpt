import assert from "node:assert/strict";
import test from "node:test";

import type { GristClient } from "../src/grist/client.js";
import { GristUiActionsAdapter } from "../src/grist/uiActionsAdapter.js";

function harness(retValues: unknown[]) {
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

test("adapter fails closed on inconsistent Grist return identifiers", async () => {
  const { adapter } = harness([
    { tableRef: 2, viewRef: 8, sectionRef: 11 }
  ]);

  await assert.rejects(
    () => adapter.addPageWidget("doc-1", 7, 2, "record"),
    /inconsistent identifiers/
  );
});
