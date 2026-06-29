# US Tabela

A browser-based scanner for US index and sector ETF holdings. Explore heavyweight index constituents, drill into S&P sector ETFs, and view a periodic-table-style **Tabela** layout across all twelve columns.

Holdings data is stored in the browser (IndexedDB). Filters and symbol-combine settings persist in `localStorage`. The server only serves static assets and a CORS proxy for live downloads.

## Features

### Index Heavyweights
- Merges **QQQ**, **SPY**, and **DIA** holdings
- OR filters across indices with synced weight ↔ count cutoffs
- Sortable stocks table with search and included/excluded flip
- Normalized weight recalculated on the visible set

### S&P Sectors
- Eleven sector ETFs: **XLI**, **XLV**, **XLF**, **XLRE**, **XLE**, **XLU**, **XLK**, **XLB**, **XLP**, **XLY**, **XLC**
- Per-sector weight/count filters (default: top 75% of stocks by count)
- Independent filter state per sector, persisted across sessions

### Tabela
- Twelve side-by-side columns (Index Heavyweights + 11 sectors)
- Symbols ordered by weight (normalized for indices, raw for sectors)
- Heavier symbols rise to the top, like a periodic table
- Global search filters all columns at once

### Page-level settings
- **Data sources** — refresh holdings from SSGA / Invesco into browser storage; export CSV
- **Symbol combine** — merge share classes (e.g. GOOG/GOOGL) with enable/disable per rule

## Data sources

| Provider | ETFs |
|----------|------|
| SSGA | SPY, DIA, XLI–XLC (11 sector ETFs) |
| Invesco | QQQ |

## Storage model

Nothing is written to server disk at runtime.

| Namespace | Location | Contents |
|-----------|----------|----------|
| `data` | IndexedDB database `data` | Object stores: `sources`, `holdings` |
| `config` | `localStorage` keys `config:*` | Combine rules, index filters, sector filters |

On first visit, holdings are seeded from bundled `/seed/*.csv` files (copied from `csv/` at build time). Use **Data Sources → Refresh** to pull live data.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

### Seed data for build

`build:seed` copies holdings CSVs into `public/seed/` for first-load bootstrap. It uses `csv/` when present (from `npm run download`), otherwise the committed `seed/` files in the repo.

To refresh seed data from provider APIs (optional, writes to local disk only):

```bash
npm run download
npm run build
```

If no seed files are available, the build still succeeds and the app starts empty until you refresh data sources in the UI.

## Development

```bash
# Build client bundle, seed files, and server
npm run build

# Start server at http://localhost:4222
npm start
```

Watch mode (rebuilds client once, then watches server):

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Project structure

```
src/
  client/           # Browser UI (vanilla TypeScript, esbuild bundle)
    app.ts          # Main app shell and Index Heavyweights tab
    db.ts           # IndexedDB schema and persistence
    data-store.ts   # Load holdings into app state
    data-pipeline.ts# Download + refresh from SSGA / Invesco
    stocks-panel.ts # Reusable sortable/searchable table
    sp-sectors-tab.ts
    tabela-tab.ts
  server/
    index.ts        # Static file server + /api/proxy for CORS
  shared/           # Types, filter math, holdings parsing, config store
  download-and-transform.ts  # CLI batch download (dev seeding)
seed/               # Committed bootstrap CSVs (copied to public/seed/ at build)
public/
  index.html
  styles.css
  seed/             # Generated at build — initial holdings bootstrap
test/               # Node test runner (filter math, combine symbols)
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Seed `public/seed/`, bundle client, compile server |
| `npm run build:client` | esbuild → `public/app.js` |
| `npm run build:seed` | Copy `csv/` or `seed/*.csv` → `public/seed/` |
| `npm run build:server` | TypeScript compile → `dist/server/` |
| `npm start` | Run production server |
| `npm run dev` | Build client + watch server with tsx |
| `npm run download` | CLI: download all holdings to `csv/` and `raw/` |
| `npm test` | Run unit tests |

## Architecture

```
Browser
├── IndexedDB (`data`)       holdings + source metadata
├── localStorage (config:*)  filters + combine rules
├── data-pipeline.ts         fetch SSGA XLSX / Invesco JSON
└── UI tabs                  Index Heavyweights | S&P Sectors | Tabela

Server (Express)
├── static public/           HTML, CSS, app.js, seed CSVs
└── GET /api/proxy           CORS proxy for allowed provider hosts only
```

## License

Private project.
