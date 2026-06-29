import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CSV_HEADERS } from "./constants.js";
import type { CsvRow } from "./types.js";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function writeCsv(filePath: string, rows: CsvRow[]): void {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((header) => escapeCsvField(row[header])).join(","),
    ),
  ];

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}
