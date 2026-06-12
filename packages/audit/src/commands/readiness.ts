import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { probeCheckout } from "../readiness/checkout.js";
import { checkLlmsTxt, checkProductsJson, checkSitemap } from "../readiness/feeds.js";
import { makeThrottledFetch, type Fetcher } from "../readiness/http.js";
import { validateProductPage } from "../readiness/product-page.js";
import { auditRobots } from "../readiness/robots.js";
import type { CheckoutProbeResult, ReadinessReport } from "../readiness/types.js";
import { artifactsDir, dataDir, storeSlug } from "../paths.js";

export type ReadinessCommandOpts = {
  maxPages?: number;
  skipCheckout?: boolean;
  out?: string;
};

export type ReadinessDeps = {
  fetcher?: Fetcher;
  probe?: (productUrl: string, artifactsDirPath: string) => Promise<CheckoutProbeResult>;
  now?: Date;
};

const EMPTY_PROBE: CheckoutProbeResult = {
  productUrl: null,
  reachedCart: false,
  reachedCheckout: false,
  blockers: [],
  jsErrors: [],
  timeToCheckoutMs: null,
  screenshots: [],
};

export async function runReadiness(
  storeUrl: string,
  opts: ReadinessCommandOpts = {},
  deps: ReadinessDeps = {},
): Promise<{ outPath: string; report: ReadinessReport }> {
  const slug = storeSlug(storeUrl);
  const base = `https://${slug}`;
  const fetcher = deps.fetcher ?? makeThrottledFetch(); // 1 req/sec per spec
  const maxPages = opts.maxPages ?? 10;

  const robots = await auditRobots(base, fetcher, "/");
  const productsJson = await checkProductsJson(base, fetcher);
  const llmsTxt = await checkLlmsTxt(base, fetcher);
  const { result: sitemap, productUrls } = await checkSitemap(base, fetcher);

  const productPages = [];
  for (const url of productUrls.slice(0, maxPages)) {
    try {
      const res = await fetcher(url);
      const html = await res.text();
      productPages.push(validateProductPage(html, url));
    } catch (err) {
      productPages.push(
        validateProductPage("", url), // counts every field as missing
      );
      console.error(`product page fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let checkout = EMPTY_PROBE;
  const firstProduct = productUrls[0];
  if (!opts.skipCheckout && firstProduct) {
    const probe = deps.probe ?? probeCheckout;
    checkout = await probe(firstProduct, artifactsDir(storeUrl));
  } else if (!opts.skipCheckout) {
    checkout = { ...EMPTY_PROBE, blockers: [{ stage: "product_page", kind: "not_found", detail: "no product url found in sitemap to probe" }] };
  }

  const report: ReadinessReport = {
    store: slug,
    generatedAt: (deps.now ?? new Date()).toISOString(),
    robots,
    feeds: { productsJson, sitemap, llmsTxt },
    productPages,
    checkout,
  };

  const outPath = opts.out ?? path.join(dataDir(storeUrl), "readiness.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2));
  return { outPath, report };
}

export function formatReadinessSummary(report: ReadinessReport): string {
  const blockedAgents = report.robots.filter((r) => !r.allowed).map((r) => r.agent);
  const mark = (pass: boolean) => (pass ? "PASS" : "FAIL");
  const pagesOk = report.productPages.filter((p) => p.problems.length === 0).length;
  return [
    `store: ${report.store}`,
    `robots: ${report.robots.length - blockedAgents.length}/${report.robots.length} agents allowed${blockedAgents.length > 0 ? ` (blocked: ${blockedAgents.join(", ")})` : ""}`,
    `products.json: ${mark(report.feeds.productsJson.pass)}  sitemap: ${mark(report.feeds.sitemap.pass)}  llms.txt: ${mark(report.feeds.llmsTxt.pass)}`,
    `product pages: ${pagesOk}/${report.productPages.length} fully valid`,
    `cart reached: ${report.checkout.reachedCart}  checkout reached: ${report.checkout.reachedCheckout}${report.checkout.timeToCheckoutMs !== null ? ` (${Math.round(report.checkout.timeToCheckoutMs / 1000)}s)` : ""}`,
    `blockers: ${report.checkout.blockers.length === 0 ? "none" : report.checkout.blockers.map((b) => `${b.stage}/${b.kind}`).join(", ")}`,
  ].join("\n");
}
