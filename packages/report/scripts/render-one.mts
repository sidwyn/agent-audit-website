/**
 * Render a single store's report.pdf, including a manual-runs.yaml if present
 * (so a live assisted agent session shows up in the transaction layer).
 *
 * Usage: pnpm exec tsx scripts/render-one.mts <cohortDir> <slug> [benchmarkStats.json]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ManualRun, ReadinessReport } from "@agentaudit/audit";
import { manualRunsFileSchema } from "@agentaudit/audit";
import { parse as parseYaml } from "yaml";
import { loadCohort } from "../src/benchmark.js";
import { htmlToPdf } from "../src/render.js";
import { composeReport } from "../src/template.js";
import type { StoreMeta } from "../src/types.js";

const cohortDir = path.resolve(process.argv[2] ?? "cohort");
const slug = process.argv[3];
const benchmarkPath = process.argv[4];
if (!slug) throw new Error("usage: render-one.mts <cohortDir> <slug> [benchmarkStats.json]");

const dir = path.join(cohortDir, slug);
const readiness = JSON.parse(readFileSync(path.join(dir, "readiness.json"), "utf8")) as ReadinessReport;
const meta = JSON.parse(readFileSync(path.join(dir, "store.json"), "utf8")) as StoreMeta;

let manualRuns: ManualRun[] = [];
const yamlPath = path.join(dir, "manual-runs.yaml");
if (existsSync(yamlPath)) {
  manualRuns = manualRunsFileSchema.parse(parseYaml(readFileSync(yamlPath, "utf8"))).runs;
}

function dataUri(p: string): string | undefined {
  if (!existsSync(p)) return undefined;
  const ext = p.toLowerCase().endsWith(".jpg") || p.toLowerCase().endsWith(".jpeg") ? "jpeg" : "png";
  return `data:image/${ext};base64,${readFileSync(p).toString("base64")}`;
}
const branding = {
  screenshot: dataUri(path.join(dir, "branding/screenshot.png")),
  logo: dataUri(path.join(dir, "branding/favicon.png")),
};

const cohort = benchmarkPath ? loadCohort(benchmarkPath) : null;
const html = composeReport(
  { meta, branding, readiness, manualRuns, generatedAt: "2026-06-13T00:00:00Z" },
  { cohort },
);
await htmlToPdf(html, path.join(dir, "report.pdf"));
console.log(`wrote ${path.join(dir, "report.pdf")} (manualRuns: ${manualRuns.length}${cohort ? `, benchmarked vs ${cohort.n}` : ""})`);
