import type { HoldingRow, IndexFilterState, IndexId, MergedStock } from "./types.js";
import { INDICES } from "./types.js";

export function sortHoldingsByWeight(holdings: HoldingRow[]): HoldingRow[] {
  return [...holdings].sort((a, b) => b.weight - a.weight);
}

export function weightToCountPercent(
  holdings: HoldingRow[],
  weightMin: number,
): number {
  const total = holdings.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) {
    return 0;
  }

  const covered = holdings
    .filter((row) => row.weight >= weightMin)
    .reduce((sum, row) => sum + row.weight, 0);

  return (covered / total) * 100;
}

export function countPercentToWeight(
  holdings: HoldingRow[],
  countPercent: number,
): number {
  const sorted = sortHoldingsByWeight(holdings);
  const total = sorted.reduce((sum, row) => sum + row.weight, 0);

  if (total <= 0 || countPercent <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (countPercent >= 100) {
    return sorted.at(-1)?.weight ?? 0;
  }

  const target = total * (countPercent / 100);
  let cumulative = 0;

  for (const row of sorted) {
    cumulative += row.weight;
    if (cumulative >= target) {
      return row.weight;
    }
  }

  return sorted.at(-1)?.weight ?? 0;
}

export function syncFromWeight(
  holdings: HoldingRow[],
  weightMin: number,
): IndexFilterState {
  const safeWeight = Math.max(0, weightMin);
  return {
    weightMin: safeWeight,
    countPercent: weightToCountPercent(holdings, safeWeight),
  };
}

export function syncFromCount(
  holdings: HoldingRow[],
  countPercent: number,
): IndexFilterState {
  const safeCount = Math.min(100, Math.max(0, countPercent));
  return {
    countPercent: safeCount,
    weightMin: countPercentToWeight(holdings, safeCount),
  };
}

export const DEFAULT_WEIGHT_FILTERS: Record<IndexId, number> = {
  SPY: 0.125,
  QQQ: 0.5,
  DIA: 2.5,
};

export function defaultFilters(
  indexHoldings: Record<IndexId, HoldingRow[]>,
): Record<IndexId, IndexFilterState> {
  return {
    QQQ: syncFromWeight(indexHoldings.QQQ, DEFAULT_WEIGHT_FILTERS.QQQ),
    SPY: syncFromWeight(indexHoldings.SPY, DEFAULT_WEIGHT_FILTERS.SPY),
    DIA: syncFromWeight(indexHoldings.DIA, DEFAULT_WEIGHT_FILTERS.DIA),
  };
}

export function stockPassesIndex(
  stock: MergedStock,
  index: IndexId,
  filter: IndexFilterState,
): boolean {
  const weight = stock.weights[index] ?? 0;
  if (weight <= 0) {
    return false;
  }

  if (!Number.isFinite(filter.weightMin)) {
    return false;
  }

  return weight >= filter.weightMin;
}

export function applyOrFilter(
  stocks: MergedStock[],
  filters: Record<IndexId, IndexFilterState>,
): MergedStock[] {
  return stocks.filter((stock) =>
    INDICES.some((index) => stockPassesIndex(stock, index, filters[index])),
  );
}

export function applyOrExcludeFilter(
  stocks: MergedStock[],
  filters: Record<IndexId, IndexFilterState>,
): MergedStock[] {
  return stocks.filter(
    (stock) =>
      !INDICES.some((index) => stockPassesIndex(stock, index, filters[index])),
  );
}

export const DEFAULT_SECTOR_COUNT_PERCENT = 75;

export function defaultSectorFilter(holdings: HoldingRow[]): IndexFilterState {
  return syncFromCount(holdings, DEFAULT_SECTOR_COUNT_PERCENT);
}

export function holdingPassesFilter(
  row: HoldingRow,
  filter: IndexFilterState,
): boolean {
  if (row.weight <= 0) {
    return false;
  }

  if (!Number.isFinite(filter.weightMin)) {
    return false;
  }

  return row.weight >= filter.weightMin;
}

export function applySingleFilter(
  holdings: HoldingRow[],
  filter: IndexFilterState,
): HoldingRow[] {
  return holdings.filter((row) => holdingPassesFilter(row, filter));
}

export function applySingleExcludeFilter(
  holdings: HoldingRow[],
  filter: IndexFilterState,
): HoldingRow[] {
  return holdings.filter((row) => !holdingPassesFilter(row, filter));
}

export function addNormalizedWeightsToHoldings(
  holdings: HoldingRow[],
): Array<HoldingRow & { normalizedWeight: number }> {
  const total = holdings.reduce((sum, row) => sum + row.weight, 0);
  return holdings.map((row) => ({
    ...row,
    normalizedWeight: total > 0 ? (row.weight / total) * 100 : 0,
  }));
}

export function addNormalizedWeights(stocks: MergedStock[]): Array<
  MergedStock & { normalizedWeight: number }
> {
  const totals = stocks.map(
    (stock) =>
      stock.weights.QQQ + stock.weights.SPY + stock.weights.DIA,
  );
  const grandTotal = totals.reduce((sum, value) => sum + value, 0);

  return stocks.map((stock, index) => ({
    ...stock,
    normalizedWeight:
      grandTotal > 0 ? (totals[index]! / grandTotal) * 100 : 0,
  }));
}
