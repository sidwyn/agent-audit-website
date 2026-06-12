// Tiny static server for the exported site (out/). Used by playwright e2e and
// local preview: node scripts/serve-static.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    let body;
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(`${file}.html`);
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});

server.listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
