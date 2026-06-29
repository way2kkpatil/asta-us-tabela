import { defaultFilters } from "../shared/filter-math.js";
import { mergeStocks } from "../shared/holdings.js";
import { DATA_SOURCES } from "../shared/data-sources.js";
import type {
  FilterState,
  HoldingRow,
  IndexId,
  MergedStock,
  SectorEtfId,
} from "../shared/types.js";
import { INDICES, SECTOR_ETFS } from "../shared/types.js";
import {
  getHoldings,
  hasAnyHoldings,
  initDatabase,
} from "./db.js";
import { listSourceStatuses, refreshSource } from "./data-pipeline.js";

export interface AppData {
  indices: IndexId[];
  sectorEtfs: SectorEtfId[];
  indexHoldings: Record<IndexId, HoldingRow[]>;
  sectorHoldings: Record<SectorEtfId, HoldingRow[]>;
  stocks: MergedStock[];
  defaultFilters: FilterState;
}

export type InitDataStoreProgress = (message: string) => void;

export async function initDataStore(
  onProgress?: InitDataStoreProgress,
): Promise<boolean> {
  await initDatabase();
  if (await hasAnyHoldings()) {
    return false;
  }

  onProgress?.("Downloading holdings from data sources...");
  for (const source of DATA_SOURCES) {
    onProgress?.(`Downloading ${source.id} (${source.provider})...`);
    await refreshSource(source.id);
  }

  return true;
}

export async function loadAppData(): Promise<AppData> {
  const [indexEntries, sectorEntries] = await Promise.all([
    Promise.all(
      INDICES.map(async (index) => [index, await getHoldings(index)] as const),
    ),
    Promise.all(
      SECTOR_ETFS.map(
        async (sector) => [sector, await getHoldings(sector)] as const,
      ),
    ),
  ]);

  const indexHoldings = Object.fromEntries(indexEntries) as Record<
    IndexId,
    HoldingRow[]
  >;
  const sectorHoldings = Object.fromEntries(sectorEntries) as Record<
    SectorEtfId,
    HoldingRow[]
  >;
  const stocks = mergeStocks(indexHoldings);

  return {
    indices: [...INDICES],
    sectorEtfs: [...SECTOR_ETFS],
    indexHoldings,
    sectorHoldings,
    stocks,
    defaultFilters: defaultFilters(indexHoldings),
  };
}

export { listSourceStatuses };
