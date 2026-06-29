import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import axios from "axios";
import { gotScraping } from "got-scraping";
import readXlsxFile from "read-excel-file/node";
import {
  CSV_DIR,
  INVESCO_QQQ_URL,
  RAW_DIR,
  SSGA_BASE,
  SSGA_TICKERS,
} from "../constants.js";
import { writeCsv } from "../csv.js";
import type { CsvRow, InvescoHoldingsResponse } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export interface DataSourceDefinition {
  id: string;
  name: string;
  provider: "SSGA" | "Invesco";
}

const SSGA_SOURCES: DataSourceDefinition[] = SSGA_TICKERS.map((ticker) => ({
  id: ticker.toUpperCase(),
  name: `${ticker.toUpperCase()} Holdings`,
  provider: "SSGA" as const,
}));

export const DATA_SOURCES: DataSourceDefinition[] = [
  ...SSGA_SOURCES,
  {
    id: "QQQ",
    name: "QQQ Holdings",
    provider: "Invesco",
  },
];

export interface DataSourceStatus extends DataSourceDefinition {
  csvFile: string;
  lastUpdated: string | null;
  rowCount: number | null;
  exists: boolean;
}

type SheetRow = Array<string | number | boolean | Date | null | undefined>;

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

async function downloadFile(url: string, dest: string): Promise<void> {
  mkdirSync(path.dirname(dest), { recursive: true });

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": USER_AGENT },
    validateStatus: (status) => status === 200,
  });

  if (!response.data?.byteLength) {
    throw new Error(`Failed to download ${url}: empty response`);
  }

  writeFileSync(dest, Buffer.from(response.data));
}

async function parseSsgaXlsx(filePath: string): Promise<CsvRow[]> {
  const sheets = await readXlsxFile(filePath);
  const rows = (sheets[0] as { data?: SheetRow[] } | undefined)?.data ?? sheets;

  const headerIdx = (rows as SheetRow[]).findIndex(
    (row) => row[0] === "Name" && row[1] === "Ticker",
  );
  if (headerIdx < 0) {
    throw new Error(`Could not find holdings header in ${filePath}`);
  }

  const holdings: CsvRow[] = [];
  for (const row of (rows as SheetRow[]).slice(headerIdx + 1)) {
    const name = row[0];
    const ticker = row[1];
    if (!name || !ticker) {
      continue;
    }

    const weight = row[4];
    holdings.push({
      Symbol: String(ticker).trim(),
      "Company Name": String(name).trim(),
      "Index Weight":
        weight === "" || weight == null ? "" : String(weight),
    });
  }

  return holdings;
}

function parseQqqJson(data: InvescoHoldingsResponse): CsvRow[] {
  const holdings: CsvRow[] = [];

  for (const item of data.holdings ?? []) {
    const symbol = item.ticker ?? item.symbol ?? item.cusip;
    if (!symbol) {
      continue;
    }

    holdings.push({
      Symbol: String(symbol).trim(),
      "Company Name": String(
        item.issuerName ?? item.securityTypeName ?? "",
      ).trim(),
      "Index Weight": String(item.percentageOfTotalNetAssets ?? ""),
    });
  }

  return holdings;
}

async function downloadSsgaSource(id: string): Promise<CsvRow[]> {
  const ticker = id.toLowerCase();
  const rawPath = path.join(RAW_DIR, `${ticker}.xlsx`);

  await downloadFile(
    `${SSGA_BASE}/holdings-daily-us-en-${ticker}.xlsx`,
    rawPath,
  );

  return parseSsgaXlsx(rawPath);
}

async function downloadQqqSource(): Promise<CsvRow[]> {
  const response = await gotScraping({
    url: INVESCO_QQQ_URL,
    headers: {
      Referer: "https://www.invesco.com/qqq-etf/en/about.html",
      Origin: "https://www.invesco.com",
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to download QQQ holdings (HTTP ${response.statusCode})`,
    );
  }

  const data = JSON.parse(response.body) as InvescoHoldingsResponse;
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(
    path.join(RAW_DIR, "qqq_holdings.json"),
    JSON.stringify(data, null, 2),
    "utf8",
  );

  return parseQqqJson(data);
}

function getSourceDefinition(id: string): DataSourceDefinition {
  const source = DATA_SOURCES.find(
    (item) => item.id.toUpperCase() === id.toUpperCase(),
  );
  if (!source) {
    throw new Error(`Unknown data source: ${id}`);
  }
  return source;
}

export async function refreshSource(id: string): Promise<DataSourceStatus> {
  const source = getSourceDefinition(id);
  mkdirSync(CSV_DIR, { recursive: true });
  mkdirSync(RAW_DIR, { recursive: true });

  const holdings =
    source.id === "QQQ"
      ? await downloadQqqSource()
      : await downloadSsgaSource(source.id);

  const csvFile = csvPathFor(source.id);
  writeCsv(csvFile, holdings);
  return getSourceStatus(source);
}

export async function refreshAllSources(): Promise<DataSourceStatus[]> {
  const results: DataSourceStatus[] = [];
  for (const source of DATA_SOURCES) {
    results.push(await refreshSource(source.id));
  }
  return results;
}
