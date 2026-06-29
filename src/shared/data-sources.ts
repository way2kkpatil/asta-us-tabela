import { SSGA_TICKERS } from "./urls.js";

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

export function getDataSource(id: string): DataSourceDefinition {
  const source = DATA_SOURCES.find(
    (item) => item.id.toUpperCase() === id.toUpperCase(),
  );
  if (!source) {
    throw new Error(`Unknown data source: ${id}`);
  }
  return source;
}
