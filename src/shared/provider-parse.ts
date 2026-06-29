import type { CsvRow, InvescoHoldingsResponse } from "../types.js";

export type SheetRow = Array<string | number | boolean | Date | null | undefined>;

export function parseSsgaWorkbook(rows: SheetRow[]): CsvRow[] {
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

export function parseQqqJson(data: InvescoHoldingsResponse): CsvRow[] {
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
