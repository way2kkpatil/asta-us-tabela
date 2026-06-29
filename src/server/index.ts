import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_SOURCES, getDataSource } from "../shared/data-sources.js";
import { fetchHoldingsForSource } from "./holdings-fetch.js";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const publicDir = path.join(workspace, "public");

const app = express();
const port = Number(process.env.PORT ?? 4222);

app.get("/api/sources", (_req, res) => {
  res.json(
    DATA_SOURCES.map((source) => ({
      id: source.id,
      name: source.name,
      provider: source.provider,
    })),
  );
});

app.get("/api/holdings/:sourceId", async (req, res) => {
  const sourceId = req.params.sourceId;
  if (!sourceId) {
    res.status(400).json({ error: "Missing source id" });
    return;
  }

  try {
    getDataSource(sourceId);
  } catch {
    res.status(404).json({ error: `Unknown source: ${sourceId}` });
    return;
  }

  try {
    const holdings = await fetchHoldingsForSource(sourceId);
    res.json(holdings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: `Failed to fetch holdings for ${sourceId.toUpperCase()}: ${message}`,
    });
  }
});

app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }
  },
}));

app.use((req, res, next) => {
  if (req.path.includes(".")) {
    res.status(404).send("Not found");
    return;
  }

  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`tabela-scanner web app running at http://localhost:${port}`);
});
