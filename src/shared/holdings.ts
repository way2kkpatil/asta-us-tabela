import type { CsvRow } from "../types.js";
import type { HoldingRow, IndexId, MergedStock } from "./types.js";
import { INDICES } from "./types.js";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

export function parseCsvContent(content: string): HoldingRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const rows: HoldingRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }

    const parts = parseCsvLine(line);
    if (parts.length < 3) {
      continue;
    }

    const symbol = parts[0]?.trim();
    const name = parts[1]?.trim();
    const weight = Number(parts[2]);
    if (!symbol || Number.isNaN(weight)) {
      continue;
    }

    rows.push({ symbol, name: name || symbol, weight });
  }

  return rows;
}

export function csvRowsToHoldings(rows: CsvRow[]): HoldingRow[] {
  const holdings: HoldingRow[] = [];

  for (const row of rows) {
    const symbol = row.Symbol.trim();
    const weight = Number(row["Index Weight"]);
    if (!symbol || Number.isNaN(weight)) {
      continue;
    }

    holdings.push({
      symbol,
      name: row["Company Name"].trim() || symbol,
      weight,
    });
  }

  return holdings;
}

export function mergeStocks(
  indexHoldings: Record<IndexId, HoldingRow[]>,
): MergedStock[] {
  const bySymbol = new Map<string, MergedStock>();

  for (const index of INDICES) {
    for (const row of indexHoldings[index]) {
      const existing = bySymbol.get(row.symbol);
      if (existing) {
        existing.weights[index] = row.weight;
        if (row.name.length > existing.name.length) {
          existing.name = row.name;
        }
        continue;
      }

      bySymbol.set(row.symbol, {
        symbol: row.symbol,
        name: row.name,
        weights: {
          QQQ: index === "QQQ" ? row.weight : 0,
          SPY: index === "SPY" ? row.weight : 0,
          DIA: index === "DIA" ? row.weight : 0,
        },
      });
    }
  }

  return [...bySymbol.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );
}
