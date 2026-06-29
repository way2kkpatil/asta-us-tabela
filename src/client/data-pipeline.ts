import readXlsxFile from "read-excel-file/browser";
import {
  DATA_SOURCES,
  getDataSource,
  getSsgaDownloadUrl,
  INVESCO_QQQ_URL,
} from "../shared/data-sources.js";
import { csvRowsToHoldings } from "../shared/holdings.js";
import type { CsvRow, InvescoHoldingsResponse } from "../types.js";
import type { HoldingRow } from "../shared/types.js";
import {
  getHoldings,
  listSourceRecords,
  replaceHoldings,
  type SourceRecord,
} from "./db.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const FETCH_TIMEOUT_MS = 45_000;

type SheetRow = Array<string | number | boolean | Date | null | undefined>;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return response;
}

export interface DataSourceStatus extends SourceRecord {
  csvFile: string;
}

function toStatus(record: SourceRecord): DataSourceStatus {
  return {
    ...record,
    csvFile: `${record.id}.csv`,
  };
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetchWithTimeout(
    `/api/proxy?url=${encodeURIComponent(url)}`,
    { headers: { "User-Agent": USER_AGENT } },
  );

  if (!response.ok) {
    throw new Error(`Failed to download ${url} (HTTP ${response.status})`);
  }

  return response.arrayBuffer();
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetchWithTimeout(
    `/api/proxy?url=${encodeURIComponent(url)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Failed to download ${url} (HTTP ${response.status})`);
  }

  return (await response.json()) as T;
}

function parseSsgaWorkbook(rows: SheetRow[]): CsvRow[] {
  const headerIdx = rows.findIndex(
    (row) => row[0] === "Name" && row[1] === "Ticker",
  );
  if (headerIdx < 0) {
    throw new Error("Could not find holdings header in SSGA workbook");
  }

  const holdings: CsvRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
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
  const buffer = await fetchBinary(getSsgaDownloadUrl(id));
  const sheets = await readXlsxFile(buffer);
  const rows = (sheets[0] as { data?: SheetRow[] } | undefined)?.data ?? sheets;
  return parseSsgaWorkbook(rows as SheetRow[]);
}

async function downloadQqqSource(): Promise<CsvRow[]> {
  const data = await fetchJson<InvescoHoldingsResponse>(INVESCO_QQQ_URL, {
    Referer: "https://www.invesco.com/qqq-etf/en/about.html",
    Origin: "https://www.invesco.com",
  });

  return parseQqqJson(data);
}

export async function listSourceStatuses(): Promise<DataSourceStatus[]> {
  const records = await listSourceRecords();
  return records.map(toStatus);
}

export async function refreshSource(id: string): Promise<DataSourceStatus> {
  const source = getDataSource(id);
  const rows =
    source.id === "QQQ"
      ? await downloadQqqSource()
      : await downloadSsgaSource(source.id);

  const holdings = csvRowsToHoldings(rows);
  await replaceHoldings(source.id, holdings);
  const records = await listSourceRecords();
  return toStatus(records.find((item) => item.id === source.id)!);
}

export async function refreshAllSources(): Promise<DataSourceStatus[]> {
  const results: DataSourceStatus[] = [];
  for (const source of DATA_SOURCES) {
    results.push(await refreshSource(source.id));
  }
  return results;
}

export async function exportSourceHoldings(id: string): Promise<HoldingRow[]> {
  return getHoldings(id);
}
