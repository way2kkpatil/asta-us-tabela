import type { HoldingRow, IndexFilterState, SectorEtfId } from "../shared/types.js";
import { SECTOR_ETFS, SECTOR_ETF_META } from "../shared/types.js";
import { defaultSectorFilter } from "../shared/filter-math.js";
import { formatWeight, matchesStockSearch } from "./filter-inputs.js";
import { renderSymbolLink } from "./tradingview.js";

export interface TabelaTile {
  symbol: string;
  name: string;
  weight: number;
}

export interface TabelaColumn {
  id: string;
  title: string;
  tiles: TabelaTile[];
  sectorName?: string;
  accentColor?: string;
  textColor?: string;
}

export interface TabelaDataSources {
  getIndexHeavyweightTiles: () => TabelaTile[];
  getSectorTiles: (sector: SectorEtfId) => TabelaTile[];
}

export interface TabelaTab {
  render: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildColumns(sources: TabelaDataSources): TabelaColumn[] {
  const indexColumn: TabelaColumn = {
    id: "index-heavyweights",
    title: "Index Heavyweights",
    tiles: sources.getIndexHeavyweightTiles(),
  };

  const sectorColumns = SECTOR_ETFS.map((sector) => {
    const meta = SECTOR_ETF_META[sector];
    return {
      id: sector,
      title: sector,
      sectorName: meta.name,
      tiles: sources.getSectorTiles(sector),
      accentColor: meta.color,
      textColor: meta.textColor,
    };
  });

  return [indexColumn, ...sectorColumns];
}

function filterTiles(tiles: TabelaTile[], searchQuery: string): TabelaTile[] {
  return tiles.filter((tile) =>
    matchesStockSearch(tile.symbol, tile.name, searchQuery),
  );
}

function renderColumn(
  column: TabelaColumn,
  searchQuery: string,
  extraClass = "",
): string {
  const visibleTiles = filterTiles(column.tiles, searchQuery);
  const searchTerm = searchQuery.trim();
  const countLabel =
    searchTerm && visibleTiles.length !== column.tiles.length
      ? `${visibleTiles.length} / ${column.tiles.length}`
      : String(column.tiles.length);

  const tiles =
    visibleTiles.length > 0
      ? visibleTiles
          .map((tile, index) => {
            const rank = index + 1;
            return `
              <div
                class="tabela-tile"
                style="--tile-rank: ${rank}; --tile-total: ${visibleTiles.length};"
                data-tile-name="${escapeHtml(tile.name)}"
                data-tile-weight="${escapeHtml(formatWeight(tile.weight))}"
              >
                ${renderSymbolLink(tile.symbol, "symbol-link tabela-symbol-link")}
              </div>
            `;
          })
          .join("")
      : `<div class="tabela-empty">${
          searchTerm ? "No matches" : "No symbols"
        }</div>`;

  const headerStyle = column.accentColor
    ? `style="--column-accent: ${column.accentColor}; --column-text: ${column.textColor ?? "var(--text)"};"`
    : "";

  const headerClass = "tabela-column-header";
  const sectorSubtitle = column.sectorName
    ? `<span class="tabela-column-subtitle">${column.sectorName}</span>`
    : `<span class="tabela-column-subtitle tabela-column-subtitle-placeholder" aria-hidden="true"></span>`;

  return `
    <section class="tabela-column ${extraClass}" aria-label="${column.sectorName ?? column.title}" ${headerStyle}>
      <header class="${headerClass}">
        <span class="tabela-column-title">${column.title}</span>
        ${sectorSubtitle}
        <span class="tabela-column-count">${countLabel}</span>
      </header>
      <div class="tabela-column-stack">
        ${tiles}
      </div>
    </section>
  `;
}

export function createTabelaTab(
  mount: HTMLElement,
  sources: TabelaDataSources,
): TabelaTab {
  mount.innerHTML = `
    <section class="sub-panel tabela-panel">
      <div class="panel-header panel-header-row">
        <div>
          <h2>Tabela</h2>
          <p>
            Twelve independent columns ordered by weight. Heavier symbols rise toward the top,
            like elements in a periodic table.
          </p>
          <p id="tabela-caption" class="tabela-caption"></p>
        </div>
        <div class="panel-actions table-panel-actions">
          <label class="table-search">
            <span class="sr-only">Search by symbol or name</span>
            <input
              id="tabela-search"
              type="text"
              placeholder="Search symbol or name"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
        </div>
      </div>
      <div class="tabela-scroll">
        <div class="tabela-grid" id="tabela-grid" aria-label="US Tabela periodic layout"></div>
      </div>
      <div id="tabela-tooltip" class="tabela-tooltip" hidden></div>
    </section>
  `;

  const grid = mount.querySelector<HTMLElement>("#tabela-grid")!;
  const tooltip = mount.querySelector<HTMLElement>("#tabela-tooltip")!;
  const searchInput = mount.querySelector<HTMLInputElement>("#tabela-search")!;
  const caption = mount.querySelector<HTMLElement>("#tabela-caption")!;
  let searchQuery = "";

  setupInstantTooltips(grid, tooltip);

  function updateCaption(columns: TabelaColumn[]): void {
    const searchTerm = searchQuery.trim();
    if (!searchTerm) {
      caption.textContent = "";
      return;
    }

    const visibleTotal = columns.reduce(
      (sum, column) => sum + filterTiles(column.tiles, searchQuery).length,
      0,
    );
    const overallTotal = columns.reduce(
      (sum, column) => sum + column.tiles.length,
      0,
    );

    caption.textContent = `Matching "${searchTerm}" across all columns (${visibleTotal} of ${overallTotal} symbols).`;
  }

  function render(): void {
    const columns = buildColumns(sources);
    updateCaption(columns);
    grid.innerHTML = columns
      .map((column, index) =>
        renderColumn(
          column,
          searchQuery,
          index === 0 ? "tabela-column-index" : "",
        ),
      )
      .join("");
  }

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    render();
  });

  render();

  return { render };
}

function setupInstantTooltips(
  grid: HTMLElement,
  tooltip: HTMLElement,
): void {
  let activeTile: HTMLElement | null = null;

  const hide = (): void => {
    tooltip.hidden = true;
    activeTile = null;
  };

  const show = (tile: HTMLElement): void => {
    const name = tile.dataset.tileName ?? "";
    const weight = tile.dataset.tileWeight ?? "";
    tooltip.innerHTML = `
      <span class="tabela-tooltip-name">${name}</span>
      <span class="tabela-tooltip-weight">${weight}%</span>
    `;
    tooltip.hidden = false;

    const rect = tile.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 8;

    if (top < 8) {
      top = rect.bottom + 8;
    }

    left = Math.max(
      8,
      Math.min(left, window.innerWidth - tooltipWidth - 8),
    );

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  grid.addEventListener("mouseover", (event) => {
    const tile = (event.target as HTMLElement).closest<HTMLElement>(
      ".tabela-tile",
    );
    if (!tile || !grid.contains(tile) || tile === activeTile) {
      return;
    }

    activeTile = tile;
    show(tile);
  });

  grid.addEventListener("mouseout", (event) => {
    const from = (event.target as HTMLElement).closest<HTMLElement>(
      ".tabela-tile",
    );
    if (!from) {
      return;
    }

    const to = event.relatedTarget;
    if (to instanceof Node && from.contains(to)) {
      return;
    }

    hide();
  });

  grid.addEventListener("scroll", hide, true);
  mountScrollParents(grid, hide);
}

function mountScrollParents(element: HTMLElement, onScroll: () => void): void {
  let parent = element.parentElement;
  while (parent) {
    parent.addEventListener("scroll", onScroll, { passive: true });
    parent = parent.parentElement;
  }
}

export function createDefaultSectorFilters(
  sectorHoldings: Record<SectorEtfId, HoldingRow[]>,
): Record<SectorEtfId, IndexFilterState> {
  const filters = {} as Record<SectorEtfId, IndexFilterState>;
  for (const sector of SECTOR_ETFS) {
    filters[sector] = defaultSectorFilter(sectorHoldings[sector] ?? []);
  }
  return filters;
}
