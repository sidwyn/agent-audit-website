#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { formatClassifySummary, runClassify } from "./commands/classify.js";
import { formatManualSummary, runManual, runManualFromReplies } from "./commands/manual.js";
import { formatReadinessSummary, runReadiness } from "./commands/readiness.js";
import { buildAgentPrompts } from "./manual/prompts.js";

// Derive the store slug (bare host, no www/scheme) from a product URL so the
// operator only has to pass the product link — everything else is automated.
function storeFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    throw new Error(`could not parse a store domain from --product "${url}" (expected a full URL like https://store.com/products/x)`);
  }
}

export const program = new Command();

program
  .name("audit")
  .description("AgentAudit: agent-readiness checks and order classification for Shopify stores")
  .version("0.1.0");

program
  .command("readiness")
  .description("run automated agent-readiness checks against a storefront")
  .argument("<store-url>", "storefront url or domain, e.g. https://store.com")
  .option("--max-pages <n>", "max product pages to validate from the sitemap", (v) => Number(v), 10)
  .option("--skip-checkout", "skip the playwright checkout probe", false)
  .option("--out <path>", "output path (default data/<store>/readiness.json)")
  .action(async (storeUrl: string, opts: { maxPages: number; skipCheckout: boolean; out?: string }) => {
    const { outPath, report } = await runReadiness(storeUrl, opts);
    console.log(formatReadinessSummary(report));
    console.log(`\nwrote ${outPath}`);
  });

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

program
  .command("agent-prompts")
  .description("print copy-paste prompts (one per assistant) for a directed human-in-the-loop run")
  .option("--product <url>", "product URL to test (the store/inbox folder is derived from it)")
  .option("--store <domain>", "store domain (optional; defaults to the --product host)")
  .option("--task <text>", "custom task description")
  .action((opts: { store?: string; product?: string; task?: string }) => {
    if (!opts.product && !opts.store) throw new Error("provide --product <url> (recommended) or --store <domain>");
    const store = opts.store ?? storeFromUrl(opts.product!);
    // Auto-create the drop folder so the operator never has to name it.
    const inbox = path.resolve("inbox", store);
    mkdirSync(inbox, { recursive: true });

    const prompts = buildAgentPrompts(store, { product: opts.product, task: opts.task });
    for (const p of prompts) {
      console.log(`\n${"=".repeat(70)}\n# ${p.label} — paste this into the agent\n${"=".repeat(70)}\n${p.prompt}`);
    }
    console.log(
      `\n${"-".repeat(70)}\nStore: ${store}\nDrop replies + screenshots into: ${inbox}/  (created)\nThen either run the inbox watcher, or run:\n  audit manual --store ${store} --from-replies <file> [--out <dir>]\n`,
    );
  });

program
  .command("manual")
  .description("merge hand-recorded agent runs into the store's report data (yaml file or pasted replies)")
  .requiredOption("--store <domain>", "store the runs belong to")
  .option("--file <yaml>", "path to a manual-runs yaml")
  .option("--from-replies <file>", "path to a file of pasted agent replies containing RESULT lines")
  .option("--task <text>", "task description recorded with the runs (replies mode)")
  .option("--out <dir>", "output directory (default data/<store>)")
  .action(async (opts: { store: string; file?: string; fromReplies?: string; task?: string; out?: string }) => {
    if (opts.fromReplies) {
      const { yamlPath, parsed } = await runManualFromReplies({
        store: opts.store,
        file: opts.fromReplies,
        task: opts.task,
        out: opts.out,
      });
      console.log(formatManualSummary(parsed));
      console.log(`\nwrote ${yamlPath}`);
    } else if (opts.file) {
      const { outPath, parsed } = await runManual({ store: opts.store, file: opts.file });
      console.log(formatManualSummary(parsed));
      console.log(`\nwrote ${outPath}`);
    } else {
      throw new Error("provide --file <yaml> or --from-replies <file>");
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
