import { CSV_HEADERS } from "./urls.js";
import type { CsvRow } from "../types.js";
import type { HoldingRow } from "./types.js";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function holdingsToCsvRows(holdings: HoldingRow[]): CsvRow[] {
  return holdings.map((row) => ({
    Symbol: row.symbol,
    "Company Name": row.name,
    "Index Weight": String(row.weight),
  }));
}

export function formatCsvContent(rows: CsvRow[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((header) => escapeCsvField(row[header])).join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function formatHoldingsCsv(holdings: HoldingRow[]): string {
  return formatCsvContent(holdingsToCsvRows(holdings));
}
