import { DATA_SOURCES, getDataSource } from "../shared/data-sources.js";
import type { HoldingRow } from "../shared/types.js";
import {
  getHoldings,
  listSourceRecords,
  replaceHoldings,
  type SourceRecord,
} from "./db.js";

const FETCH_TIMEOUT_MS = 45_000;

export interface DataSourceStatus extends SourceRecord {
  csvFile: string;
}

function toStatus(record: SourceRecord): DataSourceStatus {
  return {
    ...record,
    csvFile: `${record.id}.csv`,
  };
}

async function fetchHoldingsFromServer(sourceId: string): Promise<HoldingRow[]> {
  const response = await fetch(
    `/api/holdings/${encodeURIComponent(sourceId)}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep default message when body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as HoldingRow[];
}

export async function listSourceStatuses(): Promise<DataSourceStatus[]> {
  const records = await listSourceRecords();
  return records.map(toStatus);
}

export async function refreshSource(id: string): Promise<DataSourceStatus> {
  getDataSource(id);
  const holdings = await fetchHoldingsFromServer(id);
  await replaceHoldings(id, holdings);
  const records = await listSourceRecords();
  return toStatus(records.find((item) => item.id === id.toUpperCase())!);
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
