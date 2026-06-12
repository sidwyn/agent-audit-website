#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { loadReportData } from "./load.js";
import { htmlToPdf } from "./render.js";
import { composeReport } from "./template.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, "../fixtures/demo-store");
const REPO_ROOT = path.resolve(here, "../../..");

export const program = new Command();

program
  .name("report")
  .description("AgentAudit report generator: html template printed to pdf")
  .version("0.1.0");

async function generate(dataDir: string, metaPath: string, out: string): Promise<void> {
  const data = await loadReportData({ dataDir, metaPath });
  const html = composeReport(data);
  await htmlToPdf(html, out);
  console.log(`wrote ${out}`);
}

program
  .command("generate")
  .description("render a report pdf from a store's data directory")
  .requiredOption("--data-dir <dir>", "directory holding readiness.json, classify.json, manual-runs.yaml")
  .requiredOption("--meta <store.json>", "store metadata json (name, domain, gmvBand, contact)")
  .requiredOption("--out <pdf>", "output pdf path")
  .action(async (opts: { dataDir: string; meta: string; out: string }) => {
    await generate(opts.dataDir, opts.meta, opts.out);
  });

program
  .command("demo")
  .description("render sample-report.pdf from bundled demo fixtures (no credentials needed)")
  .action(async () => {
    await generate(FIXTURES, path.join(FIXTURES, "store.json"), path.join(REPO_ROOT, "sample-report.pdf"));
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
