import type { ReportData } from "./types.js";

export type FixItem = {
  id: string;
  title: string;
  impact: number; // 1-5, revenue impact
  effort: number; // 1-5, implementation effort
  rationale: string;
  rank: number;
};

type Candidate = Omit<FixItem, "rank">;

export function buildFixList(data: ReportData): FixItem[] {
  const { readiness, manualRuns } = data;
  const items: Candidate[] = [];

  const blocked = readiness.robots.filter((r) => !r.allowed);
  if (blocked.length > 0) {
    items.push({
      id: "robots",
      title: `Allow agent user-agents in robots.txt (${blocked.length} currently blocked)`,
      impact: 5,
      effort: 1,
      rationale: "Blocked agents never see the catalog; one file edit restores discovery for every assistant.",
    });
  }

  const blockerKinds = new Set(readiness.checkout.blockers.map((b) => b.kind));
  if (blockerKinds.has("password_page")) {
    items.push({ id: "password", title: "Remove the storefront password gate", impact: 5, effort: 1, rationale: "A password page stops every agent (and shopper) at the front door." });
  }
  if (!readiness.checkout.reachedCheckout && !blockerKinds.has("password_page")) {
    items.push({ id: "checkout-path", title: "Unblock the add-to-cart → checkout path", impact: 5, effort: 3, rationale: "The automated probe could not reach checkout; every agent purchase fails at this wall." });
  }
  if (blockerKinds.has("captcha")) {
    items.push({ id: "captcha", title: "Relax CAPTCHA on the checkout entry", impact: 5, effort: 4, rationale: "Agents stop at CAPTCHAs. Scope the challenge to risky signals instead of all traffic." });
  }
  if (blockerKinds.has("popup")) {
    items.push({ id: "popup", title: "Defer popups off product and cart pages", impact: 4, effort: 2, rationale: "Interstitials cover the buy controls; agents rarely recover after a popup mis-close." });
  }
  if (blockerKinds.has("login_wall")) {
    items.push({ id: "login-wall", title: "Enable guest checkout", impact: 4, effort: 3, rationale: "A login requirement before checkout ends most agent sessions." });
  }

  const variantFailures = manualRuns.filter((r) => r.failure_stage === "variant").length +
    (blockerKinds.has("not_found") ? 1 : 0);
  if (variantFailures > 0) {
    items.push({ id: "variant", title: "Make the variant picker machine-readable (labels + native inputs)", impact: 4, effort: 3, rationale: "Agents abandoned at variant selection; accessible labels fix agents and screen readers alike." });
  }

  const pages = readiness.productPages;
  const jsonLdGaps = pages.some((p) => p.problems.some((x) => x.includes("offer") || x.includes("sku") || x.includes("Product") || x.includes("image")));
  if (jsonLdGaps) {
    items.push({ id: "jsonld", title: "Complete JSON-LD Product/Offer fields on product pages", impact: 4, effort: 2, rationale: "Price, currency, availability and identifiers are what agents quote and compare before visiting." });
  }
  const metaGaps = pages.some((p) => p.problems.some((x) => x.includes("og:") || x.includes("canonical")));
  if (metaGaps) {
    items.push({ id: "meta", title: "Add canonical and OpenGraph tags to product pages", impact: 2, effort: 1, rationale: "Cheap wins for deduplication and previews in assistant answers." });
  }

  if (!readiness.feeds.productsJson.pass) {
    items.push({ id: "products-json", title: "Re-enable the /products.json feed", impact: 3, effort: 1, rationale: "The simplest structured catalog surface agents can read." });
  }
  if (!readiness.feeds.sitemap.pass) {
    items.push({ id: "sitemap", title: "Publish a product sitemap", impact: 4, effort: 2, rationale: "Without a sitemap, agents sample whatever navigation exposes — usually a fraction of the catalog." });
  }
  if (!readiness.feeds.llmsTxt.pass) {
    items.push({ id: "llms-txt", title: "Publish an llms.txt index", impact: 2, effort: 1, rationale: "Emerging convention; cheap to add and increasingly read by assistants." });
  }

  return items
    .sort((a, b) => b.impact / b.effort - a.impact / a.effort || b.impact - a.impact)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
