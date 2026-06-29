import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  HoldingRow,
  IndexId,
  MergedStock,
  SectorEtfId,
} from "../shared/types.js";
import { INDICES, SECTOR_ETFS } from "../shared/types.js";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const csvDir = path.join(workspace, "csv");

function parseCsv(content: string): HoldingRow[] {
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

export function loadIndexHoldings(): Record<IndexId, HoldingRow[]> {
  const result = {} as Record<IndexId, HoldingRow[]>;

  for (const index of INDICES) {
    const filePath = path.join(csvDir, `${index}.csv`);
    const content = readFileSync(filePath, "utf8");
    result[index] = parseCsv(content);
  }

  return result;
}

export function loadSectorHoldings(): Record<SectorEtfId, HoldingRow[]> {
  const result = {} as Record<SectorEtfId, HoldingRow[]>;

  for (const sector of SECTOR_ETFS) {
    const filePath = path.join(csvDir, `${sector}.csv`);
    const content = readFileSync(filePath, "utf8");
    result[sector] = parseCsv(content);
  }

  return result;
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
