import { existsSync } from "node:fs";
import path from "node:path";
import { defaultFilters } from "../shared/filter-math.js";
import type {
  HoldingRow,
  IndexId,
  MergedStock,
  SectorEtfId,
} from "../shared/types.js";
import { INDICES, SECTOR_ETFS } from "../shared/types.js";
import {
  loadIndexHoldings,
  loadSectorHoldings,
  mergeStocks,
} from "./data-loader.js";

export interface AppData {
  indices: IndexId[];
  sectorEtfs: SectorEtfId[];
  indexHoldings: Record<IndexId, HoldingRow[]>;
  sectorHoldings: Record<SectorEtfId, HoldingRow[]>;
  stocks: MergedStock[];
  defaultFilters: ReturnType<typeof defaultFilters>;
}

export function loadAppData(): AppData {
  const indexHoldings = loadIndexHoldings();
  const sectorHoldings = loadSectorHoldings();
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

export function getCsvDownloadPath(id: string, csvDir: string): string {
  const filePath = path.join(csvDir, `${id.toUpperCase()}.csv`);
  if (!existsSync(filePath)) {
    throw new Error(`CSV file not found for ${id}`);
  }
  return filePath;
}
