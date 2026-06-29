import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addNormalizedWeights,
  addNormalizedWeightsToHoldings,
  applyOrExcludeFilter,
  applyOrFilter,
  applySingleExcludeFilter,
  applySingleFilter,
  defaultFilters,
  defaultSectorFilter,
  syncFromCount,
  syncFromWeight,
  weightToCountPercent,
} from "../src/shared/filter-math.js";
import type { HoldingRow, MergedStock } from "../src/shared/types.js";

const qqqHoldings: HoldingRow[] = [
  { symbol: "NVDA", name: "NVIDIA", weight: 8 },
  { symbol: "AAPL", name: "Apple", weight: 7 },
  { symbol: "MSFT", name: "Microsoft", weight: 5 },
];

describe("filter math", () => {
  it("syncs weight and count filters bidirectionally", () => {
    const fromWeight = syncFromWeight(qqqHoldings, 5);
    const fromCount = syncFromCount(qqqHoldings, fromWeight.countPercent);

    assert.equal(fromWeight.countPercent, 100);
    assert.equal(fromCount.weightMin, 5);
    assert.equal(weightToCountPercent(qqqHoldings, 5), 100);
  });

  it("maps count percent to top stock count and cutoff weight", () => {
    const holdings = Array.from({ length: 100 }, (_, index) => ({
      symbol: `S${index}`,
      name: `Stock ${index}`,
      weight: 100 - index,
    }));

    const filter = syncFromCount(holdings, 85);

    assert.equal(filter.countPercent, 85);
    assert.equal(filter.weightMin, 16);
    assert.equal(
      applySingleFilter(holdings, filter).length,
      85,
    );
  });

  it("derives count percent from minimum weight cutoff", () => {
    const holdings = Array.from({ length: 100 }, (_, index) => ({
      symbol: `S${index}`,
      name: `Stock ${index}`,
      weight: 100 - index,
    }));

    const filter = syncFromWeight(holdings, 16);

    assert.equal(filter.countPercent, 85);
    assert.equal(filter.weightMin, 16);
  });

  it("uses configured default weight filters", () => {
    const filters = defaultFilters({
      QQQ: qqqHoldings,
      SPY: qqqHoldings,
      DIA: qqqHoldings,
    });

    assert.equal(filters.SPY.weightMin, 0.125);
    assert.equal(filters.QQQ.weightMin, 0.5);
    assert.equal(filters.DIA.weightMin, 2.5);
  });

  it("applies OR filter across indices", () => {
    const stocks: MergedStock[] = [
      {
        symbol: "NVDA",
        name: "NVIDIA",
        weights: { QQQ: 8, SPY: 7, DIA: 0 },
      },
      {
        symbol: "GS",
        name: "Goldman",
        weights: { QQQ: 0, SPY: 0, DIA: 12 },
      },
      {
        symbol: "AAPL",
        name: "Apple",
        weights: { QQQ: 0.1, SPY: 0, DIA: 0 },
      },
    ];

    const filters = {
      QQQ: syncFromWeight(qqqHoldings, 0.5),
      SPY: syncFromWeight(qqqHoldings, 0.125),
      DIA: syncFromWeight(
        [{ symbol: "GS", name: "Goldman", weight: 12 }],
        2.5,
      ),
    };

    assert.deepEqual(
      applyOrFilter(stocks, filters)
        .map((row) => row.symbol)
        .sort(),
      ["GS", "NVDA"],
    );
    assert.deepEqual(
      applyOrExcludeFilter(stocks, filters).map((row) => row.symbol),
      ["AAPL"],
    );
  });

  it("recalculates normalized weights for filtered rows", () => {
    const stocks: MergedStock[] = [
      {
        symbol: "NVDA",
        name: "NVIDIA",
        weights: { QQQ: 8, SPY: 2, DIA: 0 },
      },
      {
        symbol: "AAPL",
        name: "Apple",
        weights: { QQQ: 4, SPY: 4, DIA: 0 },
      },
    ];

    const normalized = addNormalizedWeights(stocks);
    assert.equal(normalized[0]?.normalizedWeight, 55.55555555555556);
    assert.equal(normalized[1]?.normalizedWeight, 44.44444444444444);
  });

  it("applies single-index filters to sector holdings", () => {
    const holdings: HoldingRow[] = [
      { symbol: "CAT", name: "Caterpillar", weight: 8 },
      { symbol: "GE", name: "GE Aerospace", weight: 5 },
      { symbol: "RTX", name: "RTX", weight: 0.05 },
    ];
    const filter = syncFromWeight(holdings, 5);

    assert.deepEqual(
      applySingleFilter(holdings, filter).map((row) => row.symbol),
      ["CAT", "GE"],
    );
    assert.deepEqual(
      applySingleExcludeFilter(holdings, filter).map((row) => row.symbol),
      ["RTX"],
    );

    const normalized = addNormalizedWeightsToHoldings(
      applySingleFilter(holdings, filter),
    );
    assert.equal(normalized[0]?.normalizedWeight, 61.53846153846154);
  });

  it("uses 75% count as the default sector filter", () => {
    const holdings: HoldingRow[] = [
      { symbol: "CAT", name: "Caterpillar", weight: 8 },
      { symbol: "GE", name: "GE Aerospace", weight: 5 },
      { symbol: "RTX", name: "RTX", weight: 0.05 },
    ];

    const filter = defaultSectorFilter(holdings);
    assert.equal(filter.countPercent, 75);
    assert.equal(filter.weightMin, 5);
    assert.deepEqual(
      applySingleFilter(holdings, filter).map((row) => row.symbol),
      ["CAT", "GE"],
    );
  });
});
