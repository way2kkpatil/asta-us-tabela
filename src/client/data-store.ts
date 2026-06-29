import { defaultFilters } from "../shared/filter-math.js";
import { parseCsvContent, mergeStocks } from "../shared/holdings.js";
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
  replaceHoldings,
} from "./db.js";
import { listSourceStatuses } from "./data-pipeline.js";

export interface AppData {
  indices: IndexId[];
  sectorEtfs: SectorEtfId[];
  indexHoldings: Record<IndexId, HoldingRow[]>;
  sectorHoldings: Record<SectorEtfId, HoldingRow[]>;
  stocks: MergedStock[];
  defaultFilters: FilterState;
}

async function seedFromStaticFiles(): Promise<void> {
  for (const source of DATA_SOURCES) {
    const response = await fetch(`/seed/${source.id}.csv`);
    if (!response.ok) {
      continue;
    }

    const content = await response.text();
    const holdings = parseCsvContent(content);
    if (holdings.length > 0) {
      await replaceHoldings(source.id, holdings);
    }
  }
}

export async function initDataStore(): Promise<void> {
  await initDatabase();
  if (!(await hasAnyHoldings())) {
    await seedFromStaticFiles();
  }
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
