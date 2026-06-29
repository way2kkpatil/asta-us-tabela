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

On first visit, the browser downloads all holdings from SSGA and Invesco into IndexedDB. Later visits reuse cached data until you refresh from **Data Sources**.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npm run build
npm start
```

Open http://localhost:4222. The first load downloads all ETF holdings in the browser (network required).

## Development

```bash
# Build client bundle and server
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

Optional CLI download to local `csv/` for offline inspection (not used by the web app):

```bash
npm run download
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
  download-and-transform.ts  # CLI batch download (optional dev tool)
public/
  index.html
  styles.css
test/               # Node test runner (filter math, combine symbols)
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Bundle client and compile server |
| `npm run build:client` | esbuild → `public/app.js` |
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
├── data-pipeline.ts         fetch SSGA XLSX / Invesco JSON on first load
└── UI tabs                  Index Heavyweights | S&P Sectors | Tabela

Server (Express)
├── static public/           HTML, CSS, app.js
└── GET /api/proxy           CORS proxy for allowed provider hosts only
```

## License

Private project.
