import type {
  FilterState,
  HoldingRow,
  IndexFilterState,
  IndexId,
  MergedStock,
  SectorEtfId,
} from "../shared/types.js";
import { INDICES } from "../shared/types.js";
import {
  addNormalizedWeights,
  applyOrExcludeFilter,
  applyOrFilter,
  defaultFilters,
  syncFromCount,
  syncFromWeight,
} from "../shared/filter-math.js";
import {
  applyCombineRules,
  applyCombineRulesToAllIndices,
  detectMultiClassCandidates,
  getActiveCombineRules,
  loadCombineRules,
  saveCombineRules,
  type SymbolCombineRule,
} from "../shared/combine-symbols.js";
import { createSettingsDialog } from "./settings-dialog.js";
import { createDataSourcesDialog } from "./data-sources-dialog.js";
import { createStocksPanel } from "./stocks-panel.js";
import { createSpSectorsTab } from "./sp-sectors-tab.js";
import { createTabelaTab } from "./tabela-tab.js";
import { formatWeight, isCompleteNumberInput, matchesStockSearch } from "./filter-inputs.js";
import { renderSymbolCell } from "./tradingview.js";
import { ConfigKeys, loadConfig, saveConfig } from "../shared/config-store.js";
import {
  initDataStore,
  loadAppData,
  type AppData,
} from "./data-store.js";

type IndexStockRow = MergedStock & { normalizedWeight: number };

const state = {
  rawStocks: [] as MergedStock[],
  rawIndexHoldings: {} as Record<IndexId, HoldingRow[]>,
  rawSectorHoldings: {} as Record<SectorEtfId, HoldingRow[]>,
  allStocks: [] as MergedStock[],
  indexHoldings: {} as Record<IndexId, HoldingRow[]>,
  combineRules: [] as SymbolCombineRule[],
  filters: {} as FilterState,
  updating: false,
};

const filterGrid = document.querySelector<HTMLElement>("#filter-grid")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-filters")!;
const dataSourcesButton = document.querySelector<HTMLButtonElement>(
  "#open-data-sources",
)!;
const settingsButton = document.querySelector<HTMLButtonElement>("#open-settings")!;
const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-button");
const tabPanels = document.querySelectorAll<HTMLElement>(".tab-panel");
const indexStocksMount = document.querySelector<HTMLElement>(
  "#index-heavyweights-stocks",
)!;
const spSectorsMount = document.querySelector<HTMLElement>("#sp-sectors-root")!;
const tabelaMount = document.querySelector<HTMLElement>("#tabela-root")!;

const indexStocksPanel = createStocksPanel<IndexStockRow>({
  mount: indexStocksMount,
  title: "Stocks",
  defaultSortKey: "normalized",
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
      key: "qqq",
      label: "QQQ (weight)",
      align: "right",
      getSortValue: (row) => row.weights.QQQ,
      renderCell: (row) => {
        const className =
          row.weights.QQQ > 0 ? "num weight-positive" : "num weight-zero";
        return `<td class="${className}">${formatWeight(row.weights.QQQ)}</td>`;
      },
    },
    {
      key: "spy",
      label: "SPY (weight)",
      align: "right",
      getSortValue: (row) => row.weights.SPY,
      renderCell: (row) => {
        const className =
          row.weights.SPY > 0 ? "num weight-positive" : "num weight-zero";
        return `<td class="${className}">${formatWeight(row.weights.SPY)}</td>`;
      },
    },
    {
      key: "dia",
      label: "DIA (weight)",
      align: "right",
      getSortValue: (row) => row.weights.DIA,
      renderCell: (row) => {
        const className =
          row.weights.DIA > 0 ? "num weight-positive" : "num weight-zero";
        return `<td class="${className}">${formatWeight(row.weights.DIA)}</td>`;
      },
    },
    {
      key: "normalized",
      label: "Normalized Weight",
      align: "right",
      getSortValue: (row) => row.normalizedWeight,
      renderCell: (row) =>
        `<td class="num weight-positive">${formatWeight(row.normalizedWeight)}</td>`,
    },
  ],
  getTotals: () => {
    const included = applyOrFilter(state.allStocks, state.filters);
    return { total: state.allStocks.length, included: included.length };
  },
  getRows: ({ showExcluded }) => {
    const included = applyOrFilter(state.allStocks, state.filters);
    const baseSet = showExcluded
      ? applyOrExcludeFilter(state.allStocks, state.filters)
      : included;
    return addNormalizedWeights(baseSet);
  },
  searchMatch: (row, query) =>
    matchesStockSearch(row.symbol, row.name, query),
  getCaption: (stats) => {
    const activeRules = getActiveCombineRules(state.combineRules);
    const combineNote =
      state.combineRules.length > 0
        ? ` ${activeRules.length} of ${state.combineRules.length} combine rule(s) enabled.`
        : "";

    const searchTerm = stats.searchQuery.trim();
    const searchNote = searchTerm
      ? ` Matching "${searchTerm}" (${stats.visibleCount} of ${stats.baseSetCount}).`
      : "";

    const modeLabel = stats.showExcluded
      ? `Showing ${stats.visibleCount} excluded symbol(s) (${stats.includedCount} included).`
      : `Showing ${stats.visibleCount} of ${stats.totalCount} symbols.`;

    return `${modeLabel}${searchNote}${combineNote} Normalized weight is recalculated on the visible set.`;
  },
  emptyMessage: ({ showExcluded, searchQuery }) => {
    const searchTerm = searchQuery.trim();
    if (searchTerm) {
      return `No ${showExcluded ? "excluded" : "included"} stocks match "${searchTerm}".`;
    }

    return showExcluded
      ? "No stocks are excluded by the current OR filters."
      : "No stocks match the current OR filters.";
  },
});

const spSectorsTab = createSpSectorsTab(spSectorsMount);

const tabelaTab = createTabelaTab(tabelaMount, {
  getIndexHeavyweightTiles: () =>
    addNormalizedWeights(applyOrFilter(state.allStocks, state.filters))
      .sort((left, right) => right.normalizedWeight - left.normalizedWeight)
      .map((row) => ({
        symbol: row.symbol,
        name: row.name,
        weight: row.normalizedWeight,
      })),
  getSectorTiles: (sector) => spSectorsTab.getFilteredTiles(sector),
});

spSectorsTab.onFilterChange(() => {
  tabelaTab.render();
});

function renderTabela(): void {
  tabelaTab.render();
}

function initTabs(): void {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      if (!tabId) {
        return;
      }

      tabButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
      });

      tabPanels.forEach((panel) => {
        const isActive = panel.id === `tab-panel-${tabId}`;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      });
    });
  });
}

function loadSavedIndexFilters(): FilterState | null {
  return loadConfig<FilterState | null>(ConfigKeys.INDEX_FILTERS, null);
}

function persistIndexFilters(): void {
  saveConfig(ConfigKeys.INDEX_FILTERS, state.filters);
}

function applyAppData(data: AppData): void {
  state.rawStocks = data.stocks;
  state.rawIndexHoldings = data.indexHoldings;
  state.rawSectorHoldings = data.sectorHoldings;
  refreshDerivedData();
  state.filters =
    loadSavedIndexFilters() ?? defaultFilters(state.indexHoldings);
  renderFilters();
  indexStocksPanel.render();
  spSectorsTab.setData(state.rawSectorHoldings, state.combineRules);
  renderTabela();
}

const settingsDialog = createSettingsDialog({
  onSave: (rules) => {
    state.combineRules = rules;
    saveCombineRules(rules);
    refreshDerivedData();
    renderFilters();
    indexStocksPanel.render();
    spSectorsTab.setCombineRules(rules);
    renderTabela();
  },
  getSuggestions: () => detectMultiClassCandidates(state.rawStocks),
});

const dataSourcesDialog = createDataSourcesDialog({
  onDataReload: async () => applyAppData(await loadAppData()),
});

function refreshDerivedData(): void {
  state.allStocks = applyCombineRules(state.rawStocks, state.combineRules);
  state.indexHoldings = applyCombineRulesToAllIndices(
    state.rawIndexHoldings,
    state.combineRules,
  );
}

function updateFilterInputs(
  index: IndexId,
  options: { skipWeight?: boolean; skipCount?: boolean } = {},
): void {
  const filter = state.filters[index];
  const weightInput = document.querySelector<HTMLInputElement>(
    `#weight-${index}`,
  );
  const countInput = document.querySelector<HTMLInputElement>(
    `#count-${index}`,
  );

  if (!weightInput || !countInput) {
    return;
  }

  state.updating = true;
  if (!options.skipWeight) {
    weightInput.value = Number.isFinite(filter.weightMin)
      ? String(filter.weightMin)
      : "";
  }
  if (!options.skipCount) {
    countInput.value = String(filter.countPercent);
  }
  state.updating = false;
}

function setFilter(
  index: IndexId,
  next: IndexFilterState,
  options: { skipWeight?: boolean; skipCount?: boolean } = {},
): void {
  state.filters[index] = next;
  updateFilterInputs(index, options);
  persistIndexFilters();
  indexStocksPanel.render();
  renderTabela();
}

function renderFilters(): void {
  filterGrid.innerHTML = "";

  for (const index of INDICES) {
    const card = document.createElement("article");
    card.className = "filter-card";
    card.innerHTML = `
      <h3>${index}</h3>
      <div class="field">
        <label for="weight-${index}">Weight filter (min %)</label>
        <input id="weight-${index}" type="text" inputmode="decimal" autocomplete="off" />
      </div>
      <div class="field">
        <label for="count-${index}">Count filter (top cumulative %)</label>
        <input id="count-${index}" type="text" inputmode="decimal" autocomplete="off" />
      </div>
      <p class="filter-meta" id="meta-${index}"></p>
    `;

    const weightInput = card.querySelector<HTMLInputElement>(`#weight-${index}`)!;
    const countInput = card.querySelector<HTMLInputElement>(`#count-${index}`)!;
    const meta = card.querySelector<HTMLElement>(`#meta-${index}`)!;

    const refreshMeta = () => {
      const holdings = state.indexHoldings[index];
      const included = holdings.filter(
        (row) => row.weight >= state.filters[index].weightMin,
      ).length;
      meta.textContent = `${included} of ${holdings.length} ${index} holdings included at this cutoff.`;
    };

    weightInput.addEventListener("input", () => {
      if (state.updating) {
        return;
      }

      const raw = weightInput.value.trim();
      if (!isCompleteNumberInput(raw)) {
        return;
      }

      setFilter(
        index,
        syncFromWeight(state.indexHoldings[index], Number(raw)),
        { skipWeight: true },
      );
      refreshMeta();
    });

    weightInput.addEventListener("blur", () => {
      const raw = weightInput.value.trim();
      if (!isCompleteNumberInput(raw)) {
        if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
          updateFilterInputs(index);
        }
        return;
      }

      setFilter(
        index,
        syncFromWeight(state.indexHoldings[index], Number(raw)),
      );
      refreshMeta();
    });

    countInput.addEventListener("input", () => {
      if (state.updating) {
        return;
      }

      const raw = countInput.value.trim();
      if (!isCompleteNumberInput(raw)) {
        return;
      }

      setFilter(
        index,
        syncFromCount(state.indexHoldings[index], Number(raw)),
        { skipCount: true },
      );
      refreshMeta();
    });

    countInput.addEventListener("blur", () => {
      const raw = countInput.value.trim();
      if (!isCompleteNumberInput(raw)) {
        if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
          updateFilterInputs(index);
        }
        return;
      }

      setFilter(
        index,
        syncFromCount(state.indexHoldings[index], Number(raw)),
      );
      refreshMeta();
    });

    filterGrid.appendChild(card);
    updateFilterInputs(index);
    refreshMeta();
  }
}

async function init(): Promise<void> {
  initTabs();

  await initDataStore();
  state.combineRules = loadCombineRules();
  applyAppData(await loadAppData());

  dataSourcesButton.addEventListener("click", () => {
    void dataSourcesDialog.open();
  });

  settingsButton.addEventListener("click", () => {
    settingsDialog.open(state.combineRules);
  });

  resetButton.addEventListener("click", () => {
    state.filters = defaultFilters(state.indexHoldings);
    persistIndexFilters();
    renderFilters();
    indexStocksPanel.resetViewState();
    renderTabela();
  });
}

init().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  indexStocksMount.innerHTML = `
    <div class="empty-state">Failed to load data: ${message}</div>
  `;
});
