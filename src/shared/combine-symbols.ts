import type { HoldingRow, IndexId, MergedStock } from "./types.js";
import { INDICES } from "./types.js";

import { ConfigKeys, loadConfig, saveConfig } from "./config-store.js";

export interface SymbolCombineRule {
  id: string;
  sources: string[];
  output: string;
  enabled: boolean;
}

function normalizeRule(rule: Partial<SymbolCombineRule>): SymbolCombineRule | null {
  const sources = Array.isArray(rule.sources)
    ? rule.sources.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean)
    : [];
  const output = String(rule.output ?? "").trim().toUpperCase();

  if (sources.length === 0 || !output) {
    return null;
  }

  return {
    id: rule.id || crypto.randomUUID(),
    sources,
    output,
    enabled: rule.enabled !== false,
  };
}

export function getActiveCombineRules(
  rules: SymbolCombineRule[],
): SymbolCombineRule[] {
  return rules.filter((rule) => rule.enabled);
}

function buildSymbolMap(rules: SymbolCombineRule[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const rule of getActiveCombineRules(rules)) {
    const output = rule.output.trim().toUpperCase();
    map.set(output, output);
    for (const source of rule.sources) {
      map.set(source.trim().toUpperCase(), output);
    }
  }

  return map;
}

function resolveOutputSymbol(
  symbol: string,
  symbolMap: Map<string, string>,
): string {
  return symbolMap.get(symbol.trim().toUpperCase()) ?? symbol.trim().toUpperCase();
}

function pickName(current: string, candidate: string, outputSymbol: string): string {
  if (!current) {
    return candidate;
  }

  const upperCandidate = candidate.toUpperCase();
  if (upperCandidate.includes(outputSymbol)) {
    return candidate;
  }

  return candidate.length > current.length ? candidate : current;
}

export function applyCombineRules(
  stocks: MergedStock[],
  rules: SymbolCombineRule[],
): MergedStock[] {
  const activeRules = getActiveCombineRules(rules);
  if (activeRules.length === 0) {
    return stocks.map((stock) => ({
      ...stock,
      symbol: stock.symbol.toUpperCase(),
    }));
  }

  const symbolMap = buildSymbolMap(rules);
  const combined = new Map<string, MergedStock>();

  for (const stock of stocks) {
    const outputSymbol = resolveOutputSymbol(stock.symbol, symbolMap);
    const existing = combined.get(outputSymbol);

    if (!existing) {
      combined.set(outputSymbol, {
        symbol: outputSymbol,
        name: stock.name,
        weights: { ...stock.weights },
      });
      continue;
    }

    for (const index of INDICES) {
      existing.weights[index] += stock.weights[index];
    }
    existing.name = pickName(existing.name, stock.name, outputSymbol);
  }

  return [...combined.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function applyCombineRulesToHoldings(
  holdings: HoldingRow[],
  rules: SymbolCombineRule[],
): HoldingRow[] {
  const activeRules = getActiveCombineRules(rules);
  if (activeRules.length === 0) {
    return holdings;
  }

  const symbolMap = buildSymbolMap(rules);
  const combined = new Map<string, HoldingRow>();

  for (const row of holdings) {
    const outputSymbol = resolveOutputSymbol(row.symbol, symbolMap);
    const existing = combined.get(outputSymbol);

    if (!existing) {
      combined.set(outputSymbol, {
        symbol: outputSymbol,
        name: row.name,
        weight: row.weight,
      });
      continue;
    }

    existing.weight += row.weight;
    existing.name = pickName(existing.name, row.name, outputSymbol);
  }

  return [...combined.values()].sort((a, b) => b.weight - a.weight);
}

export function applyCombineRulesToAllIndices(
  indexHoldings: Record<IndexId, HoldingRow[]>,
  rules: SymbolCombineRule[],
): Record<IndexId, HoldingRow[]> {
  return {
    QQQ: applyCombineRulesToHoldings(indexHoldings.QQQ, rules),
    SPY: applyCombineRulesToHoldings(indexHoldings.SPY, rules),
    DIA: applyCombineRulesToHoldings(indexHoldings.DIA, rules),
  };
}

function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+(INC|CORP|CO|PLC|LTD)\b.*$/i, "")
    .replace(/\s+CLASS\s+[A-Z]\b.*$/i, "")
    .replace(/\s+CL\s+[A-Z]\b.*$/i, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectMultiClassCandidates(
  stocks: MergedStock[],
): SymbolCombineRule[] {
  const groups = new Map<string, MergedStock[]>();

  for (const stock of stocks) {
    const totalWeight =
      stock.weights.QQQ + stock.weights.SPY + stock.weights.DIA;
    if (totalWeight <= 0) {
      continue;
    }

    const key = normalizeCompanyName(stock.name);
    if (!key) {
      continue;
    }

    const members = groups.get(key) ?? [];
    members.push(stock);
    groups.set(key, members);
  }

  const suggestions: SymbolCombineRule[] = [];

  for (const members of groups.values()) {
    const uniqueSymbols = [...new Set(members.map((stock) => stock.symbol))];
    if (uniqueSymbols.length < 2) {
      continue;
    }

    const output = [...members]
      .sort(
        (left, right) =>
          left.weights.QQQ +
          left.weights.SPY +
          left.weights.DIA -
          (right.weights.QQQ + right.weights.SPY + right.weights.DIA),
      )[0]!.symbol;

    suggestions.push({
      id: crypto.randomUUID(),
      sources: uniqueSymbols,
      output,
      enabled: true,
    });
  }

  return suggestions.sort((a, b) => a.output.localeCompare(b.output));
}

export const DEFAULT_COMBINE_RULES: SymbolCombineRule[] = [
  {
    id: "default-goog",
    sources: ["GOOG", "GOOGL"],
    output: "GOOG",
    enabled: true,
  },
  {
    id: "default-fox",
    sources: ["FOX", "FOXA"],
    output: "FOXA",
    enabled: true,
  },
  {
    id: "default-news",
    sources: ["NWS", "NWSA"],
    output: "NWSA",
    enabled: true,
  },
  {
    id: "default-berkshire",
    sources: ["BRK.A", "BRK.B"],
    output: "BRK.B",
    enabled: false,
  },
  {
    id: "default-under-armour",
    sources: ["UA", "UAA"],
    output: "UAA",
    enabled: false,
  },
  {
    id: "default-lennar",
    sources: ["LEN", "LEN.B"],
    output: "LEN",
    enabled: false,
  },
  {
    id: "default-brown-forman",
    sources: ["BF.A", "BF.B"],
    output: "BF.B",
    enabled: false,
  },
];

function mergeWithDefaultRules(saved: SymbolCombineRule[]): SymbolCombineRule[] {
  const merged = [...saved];
  const knownIds = new Set(saved.map((rule) => rule.id));

  for (const defaultRule of DEFAULT_COMBINE_RULES) {
    if (!knownIds.has(defaultRule.id)) {
      merged.push(structuredClone(defaultRule));
    }
  }

  return merged.sort((a, b) => a.output.localeCompare(b.output));
}

export function loadCombineRules(): SymbolCombineRule[] {
  try {
    const raw = loadConfig<Partial<SymbolCombineRule>[] | null>(
      ConfigKeys.COMBINE_RULES,
      null,
    );
    if (!raw) {
      return structuredClone(DEFAULT_COMBINE_RULES);
    }

    if (!Array.isArray(raw)) {
      return structuredClone(DEFAULT_COMBINE_RULES);
    }

    const saved = raw
      .map((rule) => normalizeRule(rule))
      .filter((rule): rule is SymbolCombineRule => rule !== null);

    return mergeWithDefaultRules(saved);
  } catch {
    return structuredClone(DEFAULT_COMBINE_RULES);
  }
}

export function saveCombineRules(rules: SymbolCombineRule[]): void {
  saveConfig(
    ConfigKeys.COMBINE_RULES,
    rules
      .map((rule) => normalizeRule(rule))
      .filter((rule): rule is SymbolCombineRule => rule !== null),
  );
}
