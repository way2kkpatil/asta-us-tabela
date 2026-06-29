export function formatWeight(value: number): string {
  if (value <= 0) {
    return "0.0000";
  }
  return value.toFixed(4);
}

export function isCompleteNumberInput(value: string): boolean {
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "." ||
    trimmed === "-." ||
    trimmed.endsWith(".")
  ) {
    return false;
  }

  return !Number.isNaN(Number(trimmed));
}

export function matchesStockSearch(
  symbol: string,
  name: string,
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) {
    return true;
  }

  return (
    symbol.toLowerCase().includes(term) ||
    name.toLowerCase().includes(term)
  );
}
