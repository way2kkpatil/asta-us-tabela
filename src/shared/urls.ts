export const SSGA_BASE =
  "https://www.ssga.com/library-content/products/fund-data/etfs/us";

export const INVESCO_QQQ_URL =
  "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/QQQ/holdings/fund?idType=ticker&interval=daily&productType=ETF";

export const SSGA_TICKERS = [
  "spy",
  "dia",
  "xli",
  "xlv",
  "xlf",
  "xlre",
  "xle",
  "xlu",
  "xlk",
  "xlb",
  "xlp",
  "xly",
  "xlc",
] as const;

export const CSV_HEADERS = [
  "Symbol",
  "Company Name",
  "Index Weight",
] as const;
