export type SortDirection = "asc" | "desc";

export interface StocksPanelColumn<TRow> {
  key: string;
  label: string;
  align?: "left" | "right";
  getSortValue: (row: TRow) => string | number;
  renderCell: (row: TRow) => string;
}

export interface StocksPanelStats {
  visibleCount: number;
  includedCount: number;
  baseSetCount: number;
  totalCount: number;
  showExcluded: boolean;
  searchQuery: string;
}

export interface StocksPanelOptions<TRow> {
  mount: HTMLElement;
  title?: string;
  columns: StocksPanelColumn<TRow>[];
  defaultSortKey: string;
  defaultSortDirection?: SortDirection;
  getCaption: (stats: StocksPanelStats) => string;
  getRows: (state: {
    showExcluded: boolean;
    searchQuery: string;
  }) => TRow[];
  getTotals: () => { total: number; included: number };
  searchMatch: (row: TRow, query: string) => boolean;
  emptyMessage: (state: {
    showExcluded: boolean;
    searchQuery: string;
  }) => string;
}

export interface StocksPanel<TRow> {
  render: () => void;
  setShowExcluded: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  resetViewState: () => void;
}

function compareValues(
  left: string | number,
  right: string | number,
  direction: SortDirection,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return direction === "asc" ? left - right : right - left;
  }

  const result = String(left).localeCompare(String(right));
  return direction === "asc" ? result : -result;
}

export function createStocksPanel<TRow>(
  options: StocksPanelOptions<TRow>,
): StocksPanel<TRow> {
  const title = options.title ?? "Stocks";
  const mountId = `stocks-panel-${crypto.randomUUID()}`;
  const searchId = `${mountId}-search`;
  const flipId = `${mountId}-flip`;
  const captionId = `${mountId}-caption`;
  const bodyId = `${mountId}-body`;

  options.mount.classList.add("sub-panel", "table-panel");
  options.mount.innerHTML = `
    <div class="panel-header panel-header-row">
      <div>
        <h2>${title}</h2>
        <p id="${captionId}"></p>
      </div>
      <div class="panel-actions table-panel-actions">
        <label class="table-search">
          <span class="sr-only">Search by symbol or name</span>
          <input
            id="${searchId}"
            type="text"
            placeholder="Search symbol or name"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <button
          type="button"
          id="${flipId}"
          class="icon-button"
          aria-pressed="false"
          aria-label="Show excluded stocks"
          title="Show excluded stocks"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7.5 4.5a.75.75 0 0 1 .75-.75h9.75a2.25 2.25 0 0 1 2.25 2.25v11.25a.75.75 0 0 1-1.28.53l-2.47-2.47-2.47 2.47a.75.75 0 0 1-1.06 0l-2.47-2.47-2.47 2.47a.75.75 0 0 1-1.28-.53V6a1.5 1.5 0 0 1 1.5-1.5Zm.75.75v9.69l1.72-1.72a.75.75 0 0 1 1.06 0l1.72 1.72 1.72-1.72a.75.75 0 0 1 1.06 0l1.72 1.72V6H8.25Z"
            />
          </svg>
        </button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${options.columns
              .map(
                (column) =>
                  `<th data-sort="${column.key}" class="${column.align === "right" ? "num" : ""}">${column.label}</th>`,
              )
              .join("")}
          </tr>
        </thead>
        <tbody id="${bodyId}"></tbody>
      </table>
    </div>
  `;

  const caption = options.mount.querySelector<HTMLElement>(`#${captionId}`)!;
  const tableBody = options.mount.querySelector<HTMLElement>(`#${bodyId}`)!;
  const searchInput = options.mount.querySelector<HTMLInputElement>(`#${searchId}`)!;
  const flipButton = options.mount.querySelector<HTMLButtonElement>(`#${flipId}`)!;
  const sortHeaders = options.mount.querySelectorAll<HTMLElement>("th[data-sort]");

  let sortKey = options.defaultSortKey;
  let sortDirection: SortDirection = options.defaultSortDirection ?? "desc";
  let showExcluded = false;
  let searchQuery = "";

  function updateSortHeaders(): void {
    sortHeaders.forEach((header) => {
      header.classList.remove("sorted-asc", "sorted-desc");
      if (header.dataset.sort === sortKey) {
        header.classList.add(
          sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
        );
      }
    });
  }

  function updateFlipButton(): void {
    flipButton.classList.toggle("is-pressed", showExcluded);
    flipButton.setAttribute("aria-pressed", showExcluded ? "true" : "false");
    flipButton.title = showExcluded
      ? "Show included stocks"
      : "Show excluded stocks";
  }

  function compareRows(left: TRow, right: TRow): number {
    const column = options.columns.find((item) => item.key === sortKey);
    if (!column) {
      return 0;
    }

    return compareValues(
      column.getSortValue(left),
      column.getSortValue(right),
      sortDirection,
    );
  }

  function render(): void {
    const totals = options.getTotals();
    const baseRows = options.getRows({ showExcluded, searchQuery });
    const visibleRows = baseRows
      .filter((row) => options.searchMatch(row, searchQuery))
      .sort(compareRows);

    const stats: StocksPanelStats = {
      visibleCount: visibleRows.length,
      includedCount: totals.included,
      baseSetCount: baseRows.length,
      totalCount: totals.total,
      showExcluded,
      searchQuery,
    };

    caption.textContent = options.getCaption(stats);
    updateFlipButton();
    updateSortHeaders();

    if (visibleRows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${options.columns.length}" class="empty-state">
            ${options.emptyMessage({ showExcluded, searchQuery })}
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = visibleRows
      .map(
        (row) =>
          `<tr>${options.columns.map((column) => column.renderCell(row)).join("")}</tr>`,
      )
      .join("");
  }

  flipButton.addEventListener("click", () => {
    showExcluded = !showExcluded;
    render();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    render();
  });

  sortHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (!key) {
        return;
      }

      if (sortKey === key) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDirection = key === "symbol" || key === "name" ? "asc" : "desc";
      }

      render();
    });
  });

  updateSortHeaders();

  return {
    render,
    setShowExcluded(value) {
      showExcluded = value;
      render();
    },
    setSearchQuery(value) {
      searchQuery = value;
      searchInput.value = value;
      render();
    },
    resetViewState() {
      showExcluded = false;
      searchQuery = "";
      searchInput.value = "";
      sortKey = options.defaultSortKey;
      sortDirection = options.defaultSortDirection ?? "desc";
      render();
    },
  };
}
