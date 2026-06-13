#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { loadCohort } from "./benchmark.js";
import { loadReportData } from "./load.js";
import { htmlToPdf } from "./render.js";
import { composeReport } from "./template.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, "../fixtures/demo-store");
const DEFAULT_COHORT = path.resolve(here, "../fixtures/cohort-stats.json");
const REPO_ROOT = path.resolve(here, "../../..");

export const program = new Command();

program
  .name("report")
  .description("AgentAudit report generator: html template printed to pdf")
  .version("0.1.0");

async function generate(dataDir: string, metaPath: string, out: string, cohortPath: string): Promise<void> {
  const data = await loadReportData({ dataDir, metaPath });
  const cohort = loadCohort(cohortPath);
  const html = composeReport(data, { cohort });
  await htmlToPdf(html, out);
  console.log(`wrote ${out}${cohort ? ` (benchmarked vs ${cohort.n}-store cohort)` : ""}`);
}

program
  .command("generate")
  .description("render a report pdf from a store's data directory")
  .requiredOption("--data-dir <dir>", "directory holding readiness.json, classify.json, manual-runs.yaml")
  .requiredOption("--meta <store.json>", "store metadata json (name, domain, gmvBand, contact)")
  .requiredOption("--out <pdf>", "output pdf path")
  .option("--cohort <path>", "cohort-stats.json for benchmarking", DEFAULT_COHORT)
  .action(async (opts: { dataDir: string; meta: string; out: string; cohort: string }) => {
    await generate(opts.dataDir, opts.meta, opts.out, opts.cohort);
  });

program
  .command("demo")
  .description("render sample-report.pdf from bundled demo fixtures (no credentials needed)")
  .action(async () => {
    await generate(FIXTURES, path.join(FIXTURES, "store.json"), path.join(REPO_ROOT, "sample-report.pdf"), DEFAULT_COHORT);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
