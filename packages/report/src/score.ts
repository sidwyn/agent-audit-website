import type { ManualRun, ProductPageResult, ReadinessReport } from "@agentaudit/audit";

export type WeightsConfig = {
  discovery: { robots: number; structuredData: number; feeds: number; llmsTxt: number };
  transaction: { cartReachable: number; checkoutReachable: number; manualOutcomes: number };
};

export const DEFAULT_WEIGHTS: WeightsConfig = {
  discovery: { robots: 10, structuredData: 15, feeds: 10, llmsTxt: 5 },
  transaction: { cartReachable: 20, checkoutReachable: 20, manualOutcomes: 20 },
};

export type ScorePart = {
  key: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
};

function structuredDataFraction(page: ProductPageResult): number {
  if (!page.jsonLd.found) return 0;
  const fields = [
    page.jsonLd.price,
    page.jsonLd.priceCurrency,
    page.jsonLd.availability,
    page.jsonLd.skuOrGtin,
    page.jsonLd.image,
  ];
  return fields.filter(Boolean).length / fields.length;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeScore(
  data: { readiness: ReadinessReport; manualRuns: ManualRun[] },
  weights: WeightsConfig = DEFAULT_WEIGHTS,
): { total: number; parts: ScorePart[] } {
  const { readiness, manualRuns } = data;
  const parts: ScorePart[] = [];

  const allowed = readiness.robots.filter((r) => r.allowed).length;
  parts.push({
    key: "robots",
    label: "Agent access (robots.txt)",
    earned: round1((weights.discovery.robots * allowed) / Math.max(readiness.robots.length, 1)),
    max: weights.discovery.robots,
    detail: `${allowed}/${readiness.robots.length} agent user-agents allowed`,
  });

  const pages = readiness.productPages;
  const sdMean =
    pages.length === 0 ? 0 : pages.reduce((s, p) => s + structuredDataFraction(p), 0) / pages.length;
  parts.push({
    key: "structuredData",
    label: "Structured data (JSON-LD)",
    earned: round1(weights.discovery.structuredData * sdMean),
    max: weights.discovery.structuredData,
    detail:
      pages.length === 0
        ? "no product pages sampled"
        : `${Math.round(sdMean * 100)}% of required Product/Offer fields across ${pages.length} pages`,
  });

  const feedsEarned =
    (readiness.feeds.productsJson.pass ? weights.discovery.feeds / 2 : 0) +
    (readiness.feeds.sitemap.pass ? weights.discovery.feeds / 2 : 0);
  parts.push({
    key: "feeds",
    label: "Product feeds (products.json, sitemap)",
    earned: round1(feedsEarned),
    max: weights.discovery.feeds,
    detail: `products.json ${readiness.feeds.productsJson.pass ? "ok" : "missing"}, sitemap ${readiness.feeds.sitemap.pass ? "ok" : "missing"}`,
  });

  parts.push({
    key: "llmsTxt",
    label: "llms.txt",
    earned: readiness.feeds.llmsTxt.pass ? weights.discovery.llmsTxt : 0,
    max: weights.discovery.llmsTxt,
    detail: readiness.feeds.llmsTxt.pass ? "present" : "missing",
  });

  parts.push({
    key: "cartReachable",
    label: "Cart reachable",
    earned: readiness.checkout.reachedCart ? weights.transaction.cartReachable : 0,
    max: weights.transaction.cartReachable,
    detail: readiness.checkout.reachedCart ? "automated probe reached the cart" : "probe never reached the cart",
  });

  parts.push({
    key: "checkoutReachable",
    label: "Checkout reachable",
    earned: readiness.checkout.reachedCheckout ? weights.transaction.checkoutReachable : 0,
    max: weights.transaction.checkoutReachable,
    detail: readiness.checkout.reachedCheckout
      ? "automated probe reached the checkout information page"
      : "probe never reached checkout",
  });

  const successes = manualRuns.filter((r) => r.outcome === "success").length;
  parts.push({
    key: "manualOutcomes",
    label: "Live agent outcomes",
    earned:
      manualRuns.length === 0
        ? 0
        : round1((weights.transaction.manualOutcomes * successes) / manualRuns.length),
    max: weights.transaction.manualOutcomes,
    detail:
      manualRuns.length === 0
        ? "no manual agent runs recorded"
        : `${successes}/${manualRuns.length} agents completed the purchase task`,
  });

  const total = Math.round(parts.reduce((s, p) => s + p.earned, 0));
  return { total, parts };
}
