#!/usr/bin/env node
import { Command } from "commander";
import { formatClassifySummary, runClassify } from "./commands/classify.js";

export const program = new Command();

program
  .name("audit")
  .description("AgentAudit: agent-readiness checks and order classification for Shopify stores")
  .version("0.1.0");

program
  .command("classify")
  .description("classify last N days of orders into agent/human tiers and compute dispute exposure")
  .option("--shop <domain>", "Shopify domain, e.g. my-store.myshopify.com (api mode)")
  .option("--token <env>", "NAME of the env var holding the Admin API token (api mode)")
  .option("--orders <csv>", "orders csv path (fallback mode)")
  .option("--disputes <csv>", "disputes csv path (fallback mode)")
  .option("--store <label>", "store label used for the data directory")
  .option("--days <n>", "lookback window in days", (v) => Number(v), 90)
  .option("--vamp-standard <pct>", "VAMP above-standard threshold in percent", (v) => Number(v), 0.5)
  .option("--vamp-excessive <pct>", "VAMP excessive threshold in percent", (v) => Number(v), 1.5)
  .option("--out <path>", "output path (default data/<store>/classify.json)")
  .action(
    async (opts: {
      shop?: string;
      token?: string;
      orders?: string;
      disputes?: string;
      store?: string;
      days: number;
      vampStandard: number;
      vampExcessive: number;
      out?: string;
    }) => {
      const { outPath, output, disputesAvailable } = await runClassify(opts);
      console.log(formatClassifySummary(output, disputesAvailable));
      console.log(`\nwrote ${outPath}`);
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
