import path from "node:path";
import { fileURLToPath } from "node:url";
import { CSV_HEADERS, INVESCO_QQQ_URL, SSGA_BASE, SSGA_TICKERS } from "./shared/urls.js";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const RAW_DIR = path.join(workspace, "raw");
export const CSV_DIR = path.join(workspace, "csv");

export { CSV_HEADERS, INVESCO_QQQ_URL, SSGA_BASE, SSGA_TICKERS };
