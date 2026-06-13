/**
 * Convert an enriched-leads CSV (columns: store, category, domain, ...) into the
 * stores.json format batch-readiness.ts expects.
 *
 * Usage: pnpm exec tsx scripts/leads-to-stores.ts <leads.csv> <out/stores.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const csvPath = process.argv[2];
const outPath = process.argv[3];
if (!csvPath || !outPath) throw new Error("usage: leads-to-stores.ts <leads.csv> <out/stores.json>");

const rows = parse(readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
}) as Record<string, string>[];

const seen = new Set<string>();
const stores: { brand: string; domain: string; category: string }[] = [];
for (const r of rows) {
  const domain = (r.domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!domain || seen.has(domain)) continue;
  seen.add(domain);
  stores.push({ brand: (r.store ?? domain).trim(), domain, category: (r.category ?? "").trim() });
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(stores, null, 2));
console.log(`wrote ${stores.length} stores -> ${outPath}`);
