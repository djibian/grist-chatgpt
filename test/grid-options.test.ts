import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeGridOptions,
  resolveGridOptionsUpdate
} from "../src/grist/gridOptions.js";

const tableWidget = {
  id: 21,
  type: "record",
  options: {
    verticalGridlines: false,
    customView: { keep: true },
    unrelated: [1, 2, 3]
  }
};

test("normalizes documented grid defaults only for missing settings", () => {
  assert.deepEqual(normalizeGridOptions(tableWidget), {
    gridOptions: {
      verticalGridlines: false,
      horizontalGridlines: true,
      zebraStripes: false,
      rowNumbers: "number"
    }
  });

  assert.deepEqual(normalizeGridOptions({ id: 1, type: "record" }), {
    gridOptions: {
      verticalGridlines: true,
      horizontalGridlines: true,
      zebraStripes: false,
      rowNumbers: "number"
    }
  });

  assert.equal(normalizeGridOptions({ id: 2, type: "single", options: {} }), undefined);
});

test("marks malformed present values incomplete instead of replacing them with defaults", () => {
  assert.deepEqual(
    normalizeGridOptions({
      id: 21,
      type: "record",
      options: {
        verticalGridlines: "yes",
        horizontalGridlines: false,
        zebraStripes: true,
        rowNumbers: "unexpected"
      }
    }),
    {
      gridOptions: {
        horizontalGridlines: false,
        zebraStripes: true
      },
      gridOptionsNormalizationIncomplete: true
    }
  );

  assert.deepEqual(normalizeGridOptions({ id: 21, type: "record", options: "broken" }), {
    gridOptions: {},
    gridOptionsNormalizationIncomplete: true
  });
});

test("updates only targeted grid settings while preserving every unrelated option", () => {
  const result = resolveGridOptionsUpdate(tableWidget, {
    horizontalGridlines: false,
    zebraStripes: true,
    rowNumbers: "rowId"
  });

  assert.deepEqual(result.options, {
    verticalGridlines: false,
    horizontalGridlines: false,
    zebraStripes: true,
    rowNumbers: "rowId",
    customView: { keep: true },
    unrelated: [1, 2, 3]
  });
  assert.deepEqual(JSON.parse(result.optionsJson), result.options);
  assert.deepEqual(tableWidget.options, {
    verticalGridlines: false,
    customView: { keep: true },
    unrelated: [1, 2, 3]
  });
});

test("allows an absent options object but refuses malformed current options and non-table targets", () => {
  assert.deepEqual(
    resolveGridOptionsUpdate({ id: 21, type: "record" }, { rowNumbers: "hidden" }).options,
    { rowNumbers: "hidden" }
  );
  assert.throws(
    () =>
      resolveGridOptionsUpdate(
        { id: 21, type: "record", options: "broken" },
        { zebraStripes: true }
      ),
    /refusing to overwrite/
  );
  assert.throws(
    () => resolveGridOptionsUpdate({ id: 21, type: "chart", options: {} }, { zebraStripes: true }),
    /not a table widget/
  );
});
