export const INDICES = ["QQQ", "SPY", "DIA"] as const;
export type IndexId = (typeof INDICES)[number];

export const SECTOR_ETFS = [
  "XLI",
  "XLV",
  "XLF",
  "XLRE",
  "XLE",
  "XLU",
  "XLK",
  "XLB",
  "XLP",
  "XLY",
  "XLC",
] as const;
export type SectorEtfId = (typeof SECTOR_ETFS)[number];

export interface SectorEtfMeta {
  id: SectorEtfId;
  name: string;
  color: string;
  textColor: string;
}

export const SECTOR_ETF_META: Record<SectorEtfId, SectorEtfMeta> = {
  XLI: { id: "XLI", name: "Industrial", color: "#7dd3fc", textColor: "#0f172a" },
  XLV: { id: "XLV", name: "Health Care", color: "#67e8f9", textColor: "#0f172a" },
  XLF: { id: "XLF", name: "Financials", color: "#bef264", textColor: "#0f172a" },
  XLRE: { id: "XLRE", name: "Real Estate", color: "#f87171", textColor: "#0f172a" },
  XLE: { id: "XLE", name: "Energy", color: "#fde047", textColor: "#0f172a" },
  XLU: { id: "XLU", name: "Utilities", color: "#fb923c", textColor: "#0f172a" },
  XLK: { id: "XLK", name: "Technology", color: "#f472b6", textColor: "#0f172a" },
  XLB: { id: "XLB", name: "Materials", color: "#a78bfa", textColor: "#0f172a" },
  XLP: { id: "XLP", name: "Consumer Staples", color: "#2dd4bf", textColor: "#0f172a" },
  XLY: { id: "XLY", name: "Consumer Discretionary", color: "#4ade80", textColor: "#0f172a" },
  XLC: { id: "XLC", name: "Communication Services", color: "#c084fc", textColor: "#0f172a" },
};

export interface HoldingRow {
  symbol: string;
  name: string;
  weight: number;
}

export interface MergedStock {
  symbol: string;
  name: string;
  weights: Record<IndexId, number>;
}

export interface IndexFilterState {
  weightMin: number;
  countPercent: number;
}

export type FilterState = Record<IndexId, IndexFilterState>;

export interface IndexMeta {
  id: IndexId;
  holdings: HoldingRow[];
  totalWeight: number;
}

export interface StockRow extends MergedStock {
  normalizedWeight: number;
}
