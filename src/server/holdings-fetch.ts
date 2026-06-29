import readXlsxFile from "read-excel-file/node";
import { getDataSource } from "../shared/data-sources.js";
import { csvRowsToHoldings } from "../shared/holdings.js";
import {
  parseQqqJson,
  parseSsgaWorkbook,
  type SheetRow,
} from "../shared/provider-parse.js";
import type { InvescoHoldingsResponse } from "../types.js";
import type { HoldingRow } from "../shared/types.js";
import { getSsgaDownloadUrl, INVESCO_QQQ_URL } from "./provider-urls.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const FETCH_TIMEOUT_MS = 45_000;

async function fetchBuffer(
  url: string,
  headers: Record<string, string> = {},
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function downloadSsgaHoldings(id: string): Promise<HoldingRow[]> {
  const buffer = await fetchBuffer(getSsgaDownloadUrl(id));
  const sheets = await readXlsxFile(Buffer.from(buffer));
  const rows = (sheets[0] as { data?: SheetRow[] } | undefined)?.data ?? sheets;
  const csvRows = parseSsgaWorkbook(rows as SheetRow[]);
  return csvRowsToHoldings(csvRows);
}

async function downloadQqqHoldings(): Promise<HoldingRow[]> {
  const data = await fetchJson<InvescoHoldingsResponse>(INVESCO_QQQ_URL, {
    Referer: "https://www.invesco.com/qqq-etf/en/about.html",
    Origin: "https://www.invesco.com",
  });
  return csvRowsToHoldings(parseQqqJson(data));
}

export async function fetchHoldingsForSource(
  sourceId: string,
): Promise<HoldingRow[]> {
  const source = getDataSource(sourceId);
  if (source.id === "QQQ") {
    return downloadQqqHoldings();
  }
  return downloadSsgaHoldings(source.id);
}
