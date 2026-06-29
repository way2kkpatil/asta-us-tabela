import type {
  HoldingRow,
  IndexFilterState,
  SectorEtfId,
} from "../shared/types.js";
import { SECTOR_ETFS, SECTOR_ETF_META } from "../shared/types.js";
import {
  applySingleExcludeFilter,
  applySingleFilter,
  defaultSectorFilter,
  syncFromCount,
  syncFromWeight,
} from "../shared/filter-math.js";
import { applyCombineRulesToHoldings } from "../shared/combine-symbols.js";
import type { SymbolCombineRule } from "../shared/combine-symbols.js";
import { createStocksPanel } from "./stocks-panel.js";
import { formatWeight, isCompleteNumberInput, matchesStockSearch } from "./filter-inputs.js";
import { renderSymbolCell } from "./tradingview.js";
import { ConfigKeys, loadConfig, saveConfig } from "../shared/config-store.js";
import { createDefaultSectorFilters, type TabelaTile } from "./tabela-tab.js";

interface SectorTabState {
  rawSectorHoldings: Record<SectorEtfId, HoldingRow[]>;
  sectorHoldings: Record<SectorEtfId, HoldingRow[]>;
  sectorFilters: Record<SectorEtfId, IndexFilterState>;
  selectedSector: SectorEtfId;
  filter: IndexFilterState;
  combineRules: SymbolCombineRule[];
  updating: boolean;
}

export interface SpSectorsTab {
  setData: (
    sectorHoldings: Record<SectorEtfId, HoldingRow[]>,
    combineRules: SymbolCombineRule[],
  ) => void;
  setCombineRules: (combineRules: SymbolCombineRule[]) => void;
  getFilteredTiles: (sector: SectorEtfId) => TabelaTile[];
  onFilterChange: (listener: () => void) => void;
}

export function createSpSectorsTab(mount: HTMLElement): SpSectorsTab {
  mount.innerHTML = `
    <section class="sub-panel sector-filters-panel">
      <div class="panel-header">
        <h2>Sector Filters</h2>
        <p>Select one sector ETF and set a weight or count cutoff for its holdings.</p>
      </div>
      <div class="sector-filter-bar">
        <div class="sector-button-group" id="sector-button-group" role="radiogroup" aria-label="S&P sector ETFs"></div>
        <div class="sector-filter-inputs">
          <div class="field">
            <label for="sector-weight">Weight filter (min %)</label>
            <input id="sector-weight" type="text" inputmode="decimal" autocomplete="off" />
          </div>
          <div class="field">
            <label for="sector-count">Count filter (top cumulative %)</label>
            <input id="sector-count" type="text" inputmode="decimal" autocomplete="off" />
          </div>
        </div>
      </div>
      <p class="filter-meta" id="sector-filter-meta"></p>
      <div class="filter-actions">
        <button type="button" id="reset-sector-filters">Reset filter</button>
      </div>
    </section>
    <div id="sector-stocks-panel"></div>
  `;

  const sectorButtonGroup = mount.querySelector<HTMLElement>("#sector-button-group")!;
  const weightInput = mount.querySelector<HTMLInputElement>("#sector-weight")!;
  const countInput = mount.querySelector<HTMLInputElement>("#sector-count")!;
  const filterMeta = mount.querySelector<HTMLElement>("#sector-filter-meta")!;
  const resetButton = mount.querySelector<HTMLButtonElement>("#reset-sector-filters")!;
  const stocksMount = mount.querySelector<HTMLElement>("#sector-stocks-panel")!;

  const state: SectorTabState = {
    rawSectorHoldings: {} as Record<SectorEtfId, HoldingRow[]>,
    sectorHoldings: {} as Record<SectorEtfId, HoldingRow[]>,
    sectorFilters: {} as Record<SectorEtfId, IndexFilterState>,
    selectedSector: "XLI",
    filter: { weightMin: 0, countPercent: 0 },
    combineRules: [],
    updating: false,
  };

  const filterChangeListeners = new Set<() => void>();

  function notifyFilterChange(): void {
    filterChangeListeners.forEach((listener) => listener());
  }

  function getFilterForSector(sector: SectorEtfId): IndexFilterState {
    const holdings = state.sectorHoldings[sector] ?? [];
    return state.sectorFilters[sector] ?? defaultSectorFilter(holdings);
  }

  function persistSectorFiltersToConfig(): void {
    saveConfig(ConfigKeys.SECTOR_FILTERS, state.sectorFilters);
  }

  function loadSectorFiltersFromConfig(): Record<SectorEtfId, IndexFilterState> {
    const saved = loadConfig<Partial<Record<SectorEtfId, IndexFilterState>> | null>(
      ConfigKeys.SECTOR_FILTERS,
      null,
    );
    const defaults = createDefaultSectorFilters(state.sectorHoldings);
    if (!saved) {
      return defaults;
    }

    const merged = { ...defaults };
    for (const sector of SECTOR_ETFS) {
      if (saved[sector]) {
        merged[sector] = saved[sector]!;
      }
    }
    return merged;
  }

  function persistCurrentFilter(): void {
    state.sectorFilters[state.selectedSector] = state.filter;
  }

  const stocksPanel = createStocksPanel<HoldingRow>({
    mount: stocksMount,
    title: "Stocks",
    defaultSortKey: "weight",
    defaultSortDirection: "desc",
    columns: [
      {
        key: "symbol",
        label: "Symbol",
        getSortValue: (row) => row.symbol,
        renderCell: (row) => renderSymbolCell(row.symbol),
      },
      {
        key: "name",
        label: "Name",
        getSortValue: (row) => row.name,
        renderCell: (row) => `<td>${row.name}</td>`,
      },
      {
        key: "weight",
        label: "Weight",
        align: "right",
        getSortValue: (row) => row.weight,
        renderCell: (row) => {
          const className =
            row.weight > 0 ? "num weight-positive" : "num weight-zero";
          return `<td class="${className}">${formatWeight(row.weight)}</td>`;
        },
      },
    ],
    getTotals: () => {
      const holdings = state.sectorHoldings[state.selectedSector] ?? [];
      const included = applySingleFilter(holdings, state.filter);
      return { total: holdings.length, included: included.length };
    },
    getRows: ({ showExcluded }) => {
      const holdings = state.sectorHoldings[state.selectedSector] ?? [];
      return showExcluded
        ? applySingleExcludeFilter(holdings, state.filter)
        : applySingleFilter(holdings, state.filter);
    },
    searchMatch: (row, query) =>
      matchesStockSearch(row.symbol, row.name, query),
    getCaption: (stats) => {
      const sector = SECTOR_ETF_META[state.selectedSector];
      const searchTerm = stats.searchQuery.trim();
      const searchNote = searchTerm
        ? ` Matching "${searchTerm}" (${stats.visibleCount} of ${stats.baseSetCount}).`
        : "";
      const modeLabel = stats.showExcluded
        ? `Showing ${stats.visibleCount} excluded symbol(s) from ${sector.id} (${stats.includedCount} included).`
        : `Showing ${stats.visibleCount} of ${stats.totalCount} ${sector.id} holdings.`;

      return `${modeLabel}${searchNote}`;
    },
    emptyMessage: ({ showExcluded, searchQuery }) => {
      const sector = SECTOR_ETF_META[state.selectedSector];
      const searchTerm = searchQuery.trim();
      if (searchTerm) {
        return `No ${showExcluded ? "excluded" : "included"} stocks match "${searchTerm}" in ${sector.id}.`;
      }

      return showExcluded
        ? `No stocks are excluded by the current ${sector.id} filter.`
        : `No stocks match the current ${sector.id} filter.`;
    },
  });

  function currentHoldings(): HoldingRow[] {
    return state.sectorHoldings[state.selectedSector] ?? [];
  }

  function refreshDerivedHoldings(): void {
    const next = {} as Record<SectorEtfId, HoldingRow[]>;
    for (const sector of SECTOR_ETFS) {
      next[sector] = applyCombineRulesToHoldings(
        state.rawSectorHoldings[sector] ?? [],
        state.combineRules,
      );
    }
    state.sectorHoldings = next;
  }

  function updateFilterInputs(
    options: { skipWeight?: boolean; skipCount?: boolean } = {},
  ): void {
    state.updating = true;
    if (!options.skipWeight) {
      weightInput.value = Number.isFinite(state.filter.weightMin)
        ? String(state.filter.weightMin)
        : "";
    }
    if (!options.skipCount) {
      countInput.value = String(state.filter.countPercent);
    }
    state.updating = false;
  }

  function refreshMeta(): void {
    const holdings = currentHoldings();
    const included = holdings.filter(
      (row) => row.weight >= state.filter.weightMin,
    ).length;
    const sector = SECTOR_ETF_META[state.selectedSector];
    filterMeta.textContent = `${included} of ${holdings.length} ${sector.id} holdings included at this cutoff.`;
  }

  function setFilter(
    next: IndexFilterState,
    options: { skipWeight?: boolean; skipCount?: boolean } = {},
  ): void {
    state.filter = next;
    state.sectorFilters[state.selectedSector] = next;
    updateFilterInputs(options);
    refreshMeta();
    stocksPanel.render();
    notifyFilterChange();
    persistSectorFiltersToConfig();
  }

  function selectSector(sector: SectorEtfId): void {
    persistCurrentFilter();
    state.selectedSector = sector;
    state.filter = getFilterForSector(sector);

    sectorButtonGroup
      .querySelectorAll<HTMLButtonElement>(".sector-button")
      .forEach((button) => {
        const isActive = button.dataset.sector === sector;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-checked", String(isActive));
      });

    updateFilterInputs();
    refreshMeta();
    stocksPanel.resetViewState();
  }

  function renderSectorButtons(): void {
    sectorButtonGroup.innerHTML = SECTOR_ETFS.map((sector) => {
      const meta = SECTOR_ETF_META[sector];
      const isActive = sector === state.selectedSector;
      return `
        <button
          type="button"
          class="sector-button sector-symbol-tip${isActive ? " is-active" : ""}"
          role="radio"
          aria-checked="${isActive}"
          aria-label="${meta.name} (${sector})"
          data-sector="${sector}"
          data-sector-name="${meta.name}"
          style="--sector-color: ${meta.color}; --sector-text: ${meta.textColor};"
        >
          ${sector}
        </button>
      `;
    }).join("");

    sectorButtonGroup
      .querySelectorAll<HTMLButtonElement>(".sector-button")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const sector = button.dataset.sector as SectorEtfId | undefined;
          if (!sector || sector === state.selectedSector) {
            return;
          }

          selectSector(sector);
        });
      });
  }

  weightInput.addEventListener("input", () => {
    if (state.updating) {
      return;
    }

    const raw = weightInput.value.trim();
    if (!isCompleteNumberInput(raw)) {
      return;
    }

    setFilter(syncFromWeight(currentHoldings(), Number(raw)), {
      skipWeight: true,
    });
  });

  weightInput.addEventListener("blur", () => {
    const raw = weightInput.value.trim();
    if (!isCompleteNumberInput(raw)) {
      if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
        updateFilterInputs();
      }
      return;
    }

    setFilter(syncFromWeight(currentHoldings(), Number(raw)));
  });

  countInput.addEventListener("input", () => {
    if (state.updating) {
      return;
    }

    const raw = countInput.value.trim();
    if (!isCompleteNumberInput(raw)) {
      return;
    }

    setFilter(syncFromCount(currentHoldings(), Number(raw)), {
      skipCount: true,
    });
  });

  countInput.addEventListener("blur", () => {
    const raw = countInput.value.trim();
    if (!isCompleteNumberInput(raw)) {
      if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
        updateFilterInputs();
      }
      return;
    }

    setFilter(syncFromCount(currentHoldings(), Number(raw)));
  });

  resetButton.addEventListener("click", () => {
    state.filter = defaultSectorFilter(currentHoldings());
    state.sectorFilters[state.selectedSector] = state.filter;
    updateFilterInputs();
    refreshMeta();
    stocksPanel.resetViewState();
    notifyFilterChange();
    persistSectorFiltersToConfig();
  });

  renderSectorButtons();

  return {
    setData(sectorHoldings, combineRules) {
      state.rawSectorHoldings = sectorHoldings;
      state.combineRules = combineRules;
      refreshDerivedHoldings();
      state.sectorFilters = loadSectorFiltersFromConfig();
      state.filter = getFilterForSector(state.selectedSector);
      updateFilterInputs();
      refreshMeta();
      stocksPanel.render();
      notifyFilterChange();
    },
    setCombineRules(combineRules) {
      state.combineRules = combineRules;
      refreshDerivedHoldings();
      state.sectorFilters = loadSectorFiltersFromConfig();
      state.filter = getFilterForSector(state.selectedSector);
      updateFilterInputs();
      refreshMeta();
      stocksPanel.render();
      notifyFilterChange();
    },
    getFilteredTiles(sector) {
      const holdings = state.sectorHoldings[sector] ?? [];
      const filter = getFilterForSector(sector);
      return applySingleFilter(holdings, filter)
        .sort((left, right) => right.weight - left.weight)
        .map((row) => ({
          symbol: row.symbol,
          name: row.name,
          weight: row.weight,
        }));
    },
    onFilterChange(listener) {
      filterChangeListeners.add(listener);
    },
  };
}
