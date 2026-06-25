// Copies the demo-generated sample-report.pdf from the repo root into public/
// so the landing page can link it. Run automatically before `next build`;
// generate the pdf first with `pnpm demo` from the repo root.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../sample-report.pdf");
const destDir = path.resolve(here, "../public");
const dest = path.join(destDir, "sample-report.pdf");

if (!existsSync(src)) {
  console.warn("sample-report.pdf not found at repo root, skipping copy (the page no longer links it)");
  process.exit(0);
}
await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log(`copied ${src} -> ${dest}`);
