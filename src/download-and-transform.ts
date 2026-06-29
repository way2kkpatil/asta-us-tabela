import { mkdirSync } from "node:fs";
import { refreshAllSources } from "./server/data-pipeline.js";

async function main(): Promise<void> {
  mkdirSync("raw", { recursive: true });
  mkdirSync("csv", { recursive: true });

  console.log("Downloading all holdings sources...");
  const results = await refreshAllSources();
  for (const source of results) {
    console.log(
      `Wrote ${source.csvFile} (${source.rowCount ?? 0} rows, updated ${source.lastUpdated ?? "n/a"})`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
