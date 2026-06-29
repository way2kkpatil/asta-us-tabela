// Provider URLs are server-only. Clients request holdings by source id.
export const SSGA_BASE =
  "https://www.ssga.com/library-content/products/fund-data/etfs/us";

export const INVESCO_QQQ_URL =
  "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/QQQ/holdings/fund?idType=ticker&interval=daily&productType=ETF";

export function getSsgaDownloadUrl(id: string): string {
  return `${SSGA_BASE}/holdings-daily-us-en-${id.toLowerCase()}.xlsx`;
}
