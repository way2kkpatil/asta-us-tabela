function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function tradingViewChartUrl(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalized)}`;
}

export function renderSymbolLink(
  symbol: string,
  className = "symbol-link",
): string {
  const safeSymbol = escapeHtml(symbol);
  const url = tradingViewChartUrl(symbol);
  return `<a href="${url}" class="${className}" target="_blank" rel="noopener noreferrer" title="Open ${safeSymbol} on TradingView">${safeSymbol}</a>`;
}

export function renderSymbolCell(symbol: string): string {
  return `<td>${renderSymbolLink(symbol)}</td>`;
}
