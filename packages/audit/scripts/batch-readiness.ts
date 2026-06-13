/**
 * Run live HTTP agent-readiness checks against a list of real storefronts and
 * write one readiness.json + store.json per store into a cohort folder. This is
 * the data behind the per-store cohort PDFs and the benchmark distribution.
 *
 * HTTP-only (checkout probe skipped) to stay gentle on production stores: only
 * throttled GET requests to robots.txt, products.json, sitemap, llms.txt and a
 * sample of product pages. No carts touched, nothing purchased.
 *
 * Usage: pnpm exec tsx scripts/batch-readiness.ts <stores.json> <outDir> [concurrency] [maxPages]
 *   stores.json: [{ "brand": "...", "domain": "allbirds.com", "category": "apparel" }, ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runReadiness } from "../src/commands/readiness.js";
import { storeSlug } from "../src/paths.js";

type Store = { brand: string; domain: string; category?: string };
type RunResult = {
  brand: string;
  domain: string;
  slug: string;
  category: string;
  ok: boolean;
  shopify: boolean;
  blockedAgents: string[];
  productPages: number;
  cleanPages: number;
  reachedCheckout: boolean;
  error: string | null;
};

async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return results;
}

async function main(): Promise<void> {
  const storesPath = process.argv[2];
  const outDir = path.resolve(process.argv[3] ?? "cohort");
  const concurrency = Number(process.argv[4] ?? 6);
  const maxPages = Number(process.argv[5] ?? 6);
  if (!storesPath) throw new Error("usage: batch-readiness.ts <stores.json> <outDir> [concurrency] [maxPages]");

  const stores = JSON.parse(readFileSync(storesPath, "utf8")) as Store[];
  await mkdir(outDir, { recursive: true });
  console.log(`running readiness for ${stores.length} stores -> ${outDir} (concurrency ${concurrency})`);

  const results = await pool<Store, RunResult>(stores, concurrency, async (store) => {
    const slug = storeSlug(store.domain);
    const storeDir = path.join(outDir, slug);
    const base: RunResult = {
      brand: store.brand,
      domain: store.domain,
      slug,
      category: store.category ?? "",
      ok: false,
      shopify: false,
      blockedAgents: [],
      productPages: 0,
      cleanPages: 0,
      reachedCheckout: false,
      error: null,
    };
    try {
      const { report } = await runReadiness(
        store.domain,
        { skipCheckout: true, maxPages, out: path.join(storeDir, "readiness.json") },
      );
      await mkdir(storeDir, { recursive: true });
      await writeFile(
        path.join(storeDir, "store.json"),
        JSON.stringify(
          { name: store.brand, domain: store.domain, gmvBand: "n/a (readiness-only)", contact: "—" },
          null,
          2,
        ),
      );
      base.ok = true;
      base.shopify = report.feeds.productsJson.pass;
      base.blockedAgents = report.robots.filter((r) => !r.allowed).map((r) => r.agent);
      base.productPages = report.productPages.length;
      base.cleanPages = report.productPages.filter((p) => p.problems.length === 0).length;
      base.reachedCheckout = report.checkout.reachedCheckout;
      console.log(`  ok  ${store.domain}  shopify=${base.shopify}  blocked=${base.blockedAgents.length}  pages=${base.productPages}`);
    } catch (err) {
      base.error = err instanceof Error ? err.message : String(err);
      console.log(`  ERR ${store.domain}: ${base.error}`);
    }
    return base;
  });

  await writeFile(path.join(outDir, "index.json"), JSON.stringify({ generatedAt: null, results }, null, 2));
  const ok = results.filter((r) => r.ok).length;
  const shopify = results.filter((r) => r.shopify).length;
  console.log(`done: ${ok}/${results.length} ran, ${shopify} detected as Shopify`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
