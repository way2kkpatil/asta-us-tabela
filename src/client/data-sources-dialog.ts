import { formatHoldingsCsv } from "../shared/csv-format.js";
import {
  listSourceStatuses,
  refreshAllSources,
  refreshSource,
  exportSourceHoldings,
  type DataSourceStatus,
} from "./data-pipeline.js";

export function createDataSourcesDialog(options: {
  onDataReload: () => void | Promise<void>;
}): { open: () => Promise<void> } {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop hidden";
  backdrop.innerHTML = `
    <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="sources-dialog-title">
      <div class="modal-header">
        <h2 id="sources-dialog-title">Data Sources</h2>
        <button type="button" class="icon-button modal-close" aria-label="Close data sources">×</button>
      </div>
      <p class="modal-copy">
        Download holdings into browser storage from SSGA and Invesco, or refresh local copies.
      </p>
      <div class="modal-toolbar">
        <button type="button" id="refresh-all-sources">Refresh all</button>
      </div>
      <div class="table-wrap sources-table-wrap">
        <table class="sources-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Provider</th>
              <th>Rows</th>
              <th>Last updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="sources-table-body"></tbody>
        </table>
      </div>
      <p class="modal-status" id="sources-status"></p>
    </div>
  `;

  document.body.appendChild(backdrop);

  const tableBody = backdrop.querySelector<HTMLElement>("#sources-table-body")!;
  const status = backdrop.querySelector<HTMLElement>("#sources-status")!;
  const refreshAllButton = backdrop.querySelector<HTMLButtonElement>(
    "#refresh-all-sources",
  )!;
  const closeButton = backdrop.querySelector<HTMLButtonElement>(".modal-close")!;

  function formatTimestamp(value: string | null): string {
    if (!value) {
      return "Not downloaded";
    }

    return new Date(value).toLocaleString();
  }

  function setStatus(message: string, isError = false): void {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  async function downloadCsv(id: string): Promise<void> {
    const holdings = await exportSourceHoldings(id);
    const content = formatHoldingsCsv(holdings);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderRows(sources: DataSourceStatus[]): void {
    tableBody.innerHTML = sources
      .map(
        (source) => `
          <tr data-source-id="${source.id}">
            <td>
              <strong>${source.id}</strong>
              <div class="source-subtitle">${source.name}</div>
            </td>
            <td>${source.provider}</td>
            <td class="num">${source.rowCount ?? "—"}</td>
            <td class="source-updated">${formatTimestamp(source.lastUpdated)}</td>
            <td class="source-actions">
              <button type="button" class="secondary-button refresh-source" data-id="${source.id}">Refresh</button>
              <button type="button" class="secondary-button download-source ${source.exists ? "" : "is-disabled"}" data-id="${source.id}" ${source.exists ? "" : "disabled"}>Download</button>
            </td>
          </tr>
        `,
      )
      .join("");

    tableBody.querySelectorAll<HTMLButtonElement>(".refresh-source").forEach(
      (button) => {
        button.addEventListener("click", () => {
          void refreshOne(button.dataset.id!);
        });
      },
    );

    tableBody.querySelectorAll<HTMLButtonElement>(".download-source").forEach(
      (button) => {
        button.addEventListener("click", () => {
          if (!button.disabled) {
            void downloadCsv(button.dataset.id!);
          }
        });
      },
    );
  }

  async function loadSources(): Promise<DataSourceStatus[]> {
    const sources = await listSourceStatuses();
    renderRows(sources);
    return sources;
  }

  async function refreshOne(id: string): Promise<void> {
    const row = tableBody.querySelector<HTMLElement>(`tr[data-source-id="${id}"]`);
    const button = row?.querySelector<HTMLButtonElement>(".refresh-source");
    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }

    setStatus(`Refreshing ${id}...`);

    try {
      await refreshSource(id);
      await options.onDataReload();
      await loadSources();
      setStatus(`${id} refreshed successfully.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, true);
      await loadSources();
    } finally {
      const refreshedRow = tableBody.querySelector<HTMLElement>(
        `tr[data-source-id="${id}"]`,
      );
      const refreshedButton =
        refreshedRow?.querySelector<HTMLButtonElement>(".refresh-source");
      if (refreshedButton) {
        refreshedButton.disabled = false;
        refreshedButton.textContent = "Refresh";
      }
    }
  }

  async function refreshAll(): Promise<void> {
    refreshAllButton.disabled = true;
    refreshAllButton.textContent = "Refreshing all...";
    setStatus("Refreshing all sources...");

    try {
      await refreshAllSources();
      await options.onDataReload();
      await loadSources();
      setStatus("All sources refreshed successfully.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, true);
      await loadSources();
    } finally {
      refreshAllButton.disabled = false;
      refreshAllButton.textContent = "Refresh all";
    }
  }

  refreshAllButton.addEventListener("click", () => {
    void refreshAll();
  });

  function close(): void {
    backdrop.classList.add("hidden");
    setStatus("");
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  return {
    async open() {
      backdrop.classList.remove("hidden");
      setStatus("Loading sources...");
      try {
        await loadSources();
        setStatus("");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message, true);
      }
    },
  };
}
