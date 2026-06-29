import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const publicDir = path.join(workspace, "public");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const ALLOWED_HOSTS = new Set([
  "www.ssga.com",
  "dng-api.invesco.com",
]);

const app = express();
const port = Number(process.env.PORT ?? 4222);

app.get("/api/proxy", async (req, res) => {
  const url = req.query.url;
  if (typeof url !== "string") {
    res.status(400).json({ error: "Missing url query parameter" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
    };

    if (parsed.hostname.includes("invesco")) {
      headers.Referer = "https://www.invesco.com/qqq-etf/en/about.html";
      headers.Origin = "https://www.invesco.com";
    }

    const response = await fetch(url, { headers });
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.set("Content-Type", contentType);
    }
    res.status(response.status).send(buffer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: message });
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
