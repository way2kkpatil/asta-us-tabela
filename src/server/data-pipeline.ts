import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import {
  DATA_SOURCES,
  getDataSource,
  type DataSourceDefinition,
} from "../shared/data-sources.js";
import { holdingsToCsvRows } from "../shared/csv-format.js";
import { CSV_DIR } from "../constants.js";
import { writeCsv } from "../csv.js";
import { fetchHoldingsForSource } from "./holdings-fetch.js";

export interface DataSourceStatus extends DataSourceDefinition {
  csvFile: string;
  lastUpdated: string | null;
  rowCount: number | null;
  exists: boolean;
}

function csvPathFor(id: string): string {
  return path.join(CSV_DIR, `${id.toUpperCase()}.csv`);
}

function countCsvRows(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  const lines = readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
}

function getFileTimestamp(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  return statSync(filePath).mtime.toISOString();
}

export function getSourceStatus(source: DataSourceDefinition): DataSourceStatus {
  const csvFile = csvPathFor(source.id);
  const exists = existsSync(csvFile);

  return {
    ...source,
    csvFile,
    exists,
    lastUpdated: exists ? getFileTimestamp(csvFile) : null,
    rowCount: exists ? countCsvRows(csvFile) : null,
  };
}

export function listSourceStatuses(): DataSourceStatus[] {
  return DATA_SOURCES.map(getSourceStatus);
}

export async function refreshSource(id: string): Promise<DataSourceStatus> {
  const source = getDataSource(id);
  mkdirSync(CSV_DIR, { recursive: true });

  const holdings = await fetchHoldingsForSource(source.id);
  const csvFile = csvPathFor(source.id);
  writeCsv(csvFile, holdingsToCsvRows(holdings));
  return getSourceStatus(source);
}

export async function refreshAllSources(): Promise<DataSourceStatus[]> {
  const results: DataSourceStatus[] = [];
  for (const source of DATA_SOURCES) {
    results.push(await refreshSource(source.id));
  }
  return results;
}

export { DATA_SOURCES };
