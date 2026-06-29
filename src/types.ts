export type CsvRow = {
  Symbol: string;
  "Company Name": string;
  "Index Weight": string;
};

export interface InvescoHolding {
  ticker?: string | null;
  symbol?: string | null;
  cusip?: string | null;
  issuerName?: string | null;
  securityTypeName?: string | null;
  percentageOfTotalNetAssets?: number | string | null;
}

export interface InvescoHoldingsResponse {
  holdings?: InvescoHolding[];
}
