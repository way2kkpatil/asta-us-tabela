import type { HoldingRow } from "../shared/types.js";
import { DATA_SOURCES } from "../shared/data-sources.js";

const DB_NAME = "data";
const DB_VERSION = 1;

interface HoldingRecord extends HoldingRow {
  sourceId: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  provider: string;
  lastUpdated: string | null;
  rowCount: number;
  exists: boolean;
}

let database: IDBDatabase | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function normalizeSourceId(sourceId: string): string {
  return sourceId.toUpperCase();
}

function holdingKey(sourceId: string, symbol: string): string {
  return `${normalizeSourceId(sourceId)}:${symbol}`;
}

async function ensureSourceRecords(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction("sources", "readwrite");
  const store = transaction.objectStore("sources");

  for (const source of DATA_SOURCES) {
    const existing = await requestToPromise(store.get(source.id));
    if (!existing) {
      store.put({
        id: source.id,
        name: source.name,
        provider: source.provider,
        lastUpdated: null,
        rowCount: 0,
      });
    }
  }

  await transactionDone(transaction);
}

export async function initDatabase(): Promise<IDBDatabase> {
  if (database) {
    return database;
  }

  localStorage.removeItem("data:sqlite");

  database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sources")) {
        db.createObjectStore("sources", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("holdings")) {
        const holdings = db.createObjectStore("holdings", { keyPath: "id" });
        holdings.createIndex("bySourceId", "sourceId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB"));
  });

  await ensureSourceRecords(database);
  return database;
}

function getDatabase(): IDBDatabase {
  if (!database) {
    throw new Error("IndexedDB has not been initialized");
  }
  return database;
}

async function deleteHoldingsForSource(
  db: IDBDatabase,
  sourceId: string,
): Promise<void> {
  const normalizedId = normalizeSourceId(sourceId);
  const transaction = db.transaction("holdings", "readwrite");
  const index = transaction.objectStore("holdings").index("bySourceId");

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(IDBKeyRange.only(normalizedId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    cursorRequest.onerror = () =>
      reject(cursorRequest.error ?? new Error("Failed to clear holdings"));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to clear holdings"));
  });
}

export async function replaceHoldings(
  sourceId: string,
  holdings: HoldingRow[],
  lastUpdated = new Date().toISOString(),
): Promise<void> {
  const db = getDatabase();
  const normalizedId = normalizeSourceId(sourceId);

  await deleteHoldingsForSource(db, normalizedId);

  const transaction = db.transaction(["holdings", "sources"], "readwrite");
  const holdingsStore = transaction.objectStore("holdings");
  const sourcesStore = transaction.objectStore("sources");

  for (const row of holdings) {
    holdingsStore.put({
      id: holdingKey(normalizedId, row.symbol),
      sourceId: normalizedId,
      symbol: row.symbol,
      name: row.name,
      weight: row.weight,
    } satisfies HoldingRecord);
  }

  const definition = DATA_SOURCES.find((source) => source.id === normalizedId);

  sourcesStore.put({
    id: normalizedId,
    name: definition?.name ?? normalizedId,
    provider: definition?.provider ?? "SSGA",
    lastUpdated,
    rowCount: holdings.length,
  });

  await transactionDone(transaction);
}

export async function getHoldings(sourceId: string): Promise<HoldingRow[]> {
  const db = getDatabase();
  const normalizedId = normalizeSourceId(sourceId);
  const transaction = db.transaction("holdings", "readonly");
  const index = transaction.objectStore("holdings").index("bySourceId");
  const records = await requestToPromise(index.getAll(normalizedId));

  return (records as HoldingRecord[])
    .map((row) => ({
      symbol: row.symbol,
      name: row.name,
      weight: row.weight,
    }))
    .sort((left, right) => {
      const byWeight = right.weight - left.weight;
      return byWeight !== 0 ? byWeight : left.symbol.localeCompare(right.symbol);
    });
}

export async function listSourceRecords(): Promise<SourceRecord[]> {
  const db = getDatabase();
  const transaction = db.transaction("sources", "readonly");
  const records = await requestToPromise(
    transaction.objectStore("sources").getAll(),
  );

  return (records as Array<Omit<SourceRecord, "exists"> & { rowCount: number }>)
    .map((record) => ({
      id: record.id,
      name: record.name,
      provider: record.provider,
      lastUpdated: record.lastUpdated,
      rowCount: record.rowCount,
      exists: record.rowCount > 0,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function hasAnyHoldings(): Promise<boolean> {
  const db = getDatabase();
  const transaction = db.transaction("holdings", "readonly");
  const count = await requestToPromise(transaction.objectStore("holdings").count());
  return count > 0;
}
