import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const destination = "public/seed";
mkdirSync(destination, { recursive: true });

function copyCsvFiles(sourceDir: string): number {
  const files = readdirSync(sourceDir).filter((file) => file.endsWith(".csv"));
  for (const file of files) {
    cpSync(join(sourceDir, file), join(destination, file));
  }
  return files.length;
}

const sources = ["csv", "seed"] as const;
let copied = 0;
let sourceUsed: string | null = null;

for (const source of sources) {
  if (!existsSync(source)) {
    continue;
  }

  const count = copyCsvFiles(source);
  if (count > 0) {
    copied = count;
    sourceUsed = source;
    break;
  }
}

if (copied > 0) {
  console.log(`Copied ${copied} seed file(s) from ${sourceUsed}/ to ${destination}/`);
} else {
  console.warn(
    `No seed CSV files found. Run \`npm run download\` or refresh data sources in the app.`,
  );
}
