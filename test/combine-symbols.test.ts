import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCombineRules,
  applyCombineRulesToHoldings,
  detectMultiClassCandidates,
  getActiveCombineRules,
} from "../src/shared/combine-symbols.js";
import type { HoldingRow, MergedStock } from "../src/shared/types.js";

describe("combine symbols", () => {
  it("sums weights for combined share classes", () => {
    const stocks: MergedStock[] = [
      {
        symbol: "GOOG",
        name: "Alphabet Inc Class C",
        weights: { QQQ: 2.98, SPY: 2.56, DIA: 10.25 },
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc Class A",
        weights: { QQQ: 3.2, SPY: 3.19, DIA: 12.77 },
      },
    ];

    const combined = applyCombineRules(stocks, [
      { id: "1", sources: ["GOOG", "GOOGL"], output: "GOOG", enabled: true },
    ]);

    assert.equal(combined.length, 1);
    assert.equal(combined[0]?.symbol, "GOOG");
    assert.equal(combined[0]?.weights.QQQ, 6.18);
    assert.equal(combined[0]?.weights.SPY, 5.75);
    assert.equal(combined[0]?.weights.DIA, 23.02);
  });

  it("skips disabled combine rules", () => {
    const stocks: MergedStock[] = [
      {
        symbol: "GOOG",
        name: "Alphabet Inc Class C",
        weights: { QQQ: 2.98, SPY: 0, DIA: 0 },
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc Class A",
        weights: { QQQ: 3.2, SPY: 0, DIA: 0 },
      },
    ];

    const combined = applyCombineRules(stocks, [
      { id: "1", sources: ["GOOG", "GOOGL"], output: "GOOG", enabled: false },
    ]);

    assert.equal(combined.length, 2);
    assert.deepEqual(
      getActiveCombineRules([
        { id: "1", sources: ["GOOG"], output: "GOOG", enabled: false },
        { id: "2", sources: ["FOX"], output: "FOXA", enabled: true },
      ]).map((rule) => rule.id),
      ["2"],
    );
  });

  it("combines per-index holdings rows", () => {
    const holdings: HoldingRow[] = [
      { symbol: "FOX", name: "Fox Class B", weight: 0.01 },
      { symbol: "FOXA", name: "Fox Class A", weight: 0.015 },
    ];

    const combined = applyCombineRulesToHoldings(holdings, [
      { id: "1", sources: ["FOX", "FOXA"], output: "FOXA", enabled: true },
    ]);

    assert.equal(combined.length, 1);
    assert.equal(combined[0]?.symbol, "FOXA");
    assert.equal(combined[0]?.weight, 0.025);
  });

  it("detects likely multi-class share candidates", () => {
    const stocks: MergedStock[] = [
      {
        symbol: "GOOG",
        name: "Alphabet Inc Class C",
        weights: { QQQ: 1, SPY: 0, DIA: 0 },
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc Class A",
        weights: { QQQ: 2, SPY: 0, DIA: 0 },
      },
      {
        symbol: "AAPL",
        name: "Apple Inc",
        weights: { QQQ: 3, SPY: 0, DIA: 0 },
      },
    ];

    const suggestions = detectMultiClassCandidates(stocks);
    assert.equal(suggestions.length, 1);
    assert.deepEqual(suggestions[0]?.sources.sort(), ["GOOG", "GOOGL"]);
    assert.equal(suggestions[0]?.enabled, true);
  });
});
