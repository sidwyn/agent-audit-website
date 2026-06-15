import { describe, expect, it } from "vitest";
import { buildAgentMatrix } from "../src/agentMatrix.js";
import { benchmarkScore, percentile, type CohortStats } from "../src/benchmark.js";
import { sparkline } from "../src/charts.js";
import { buildFunnel, topFailingStage } from "../src/funnel.js";
import { buildRemediation } from "../src/remediation.js";
import { agentShareBand } from "../src/shareBands.js";
import { makeManualRuns, makeMeta, makeReadiness, makeClassify } from "./helpers.js";

describe("buildAgentMatrix", () => {
  const base = makeReadiness();
  const readiness = makeReadiness({
    robots: base.robots.map((r) => ({ ...r, allowed: r.agent !== "GPTBot" })),
  });
  const matrix = buildAgentMatrix(readiness, makeManualRuns());

  it("maps UAs to brands and marks live-tested vs inferred", () => {
    const chatgpt = matrix.find((m) => m.brand.startsWith("ChatGPT"))!;
    expect(chatgpt.liveTested).toBe(true);
    const gemini = matrix.find((m) => m.brand === "Gemini")!;
    expect(gemini.liveTested).toBe(false);
    expect(gemini.manualOutcome).toBe("not live-tested");
  });

  it("uses live manual outcomes for transaction columns", () => {
    const perplexity = matrix.find((m) => m.brand === "Perplexity")!;
    // makeManualRuns: perplexity abandoned at variant -> never reached cart/checkout
    expect(perplexity.reachCart).toBe("no");
    expect(perplexity.manualOutcome).toBe("abandoned at variant");
  });

  it("marks non-live brands' transaction cells as inference (partial/unknown), not yes", () => {
    const gemini = matrix.find((m) => m.brand === "Gemini")!;
    expect(["partial", "unknown", "no"]).toContain(gemini.reachCheckout);
  });
});

describe("buildFunnel", () => {
  it("aggregates blockers, manual abandons and product gaps into ordered stages", () => {
    const base = makeReadiness();
    const readiness = makeReadiness({
      robots: base.robots.map((r, i) => ({ ...r, allowed: i > 0 })), // 1 blocked
    });
    const funnel = buildFunnel(readiness, makeManualRuns());
    expect(funnel.map((f) => f.stage)).toEqual([
      "discovery",
      "product_page",
      "variant",
      "cart",
      "checkout",
      "payment",
    ]);
    expect(funnel.find((f) => f.stage === "discovery")!.failures).toBe(1);
    expect(funnel.find((f) => f.stage === "variant")!.failures).toBeGreaterThanOrEqual(1);
    expect(topFailingStage(funnel)).not.toBeNull();
  });

  it("returns null top stage when nothing fails", () => {
    const clean = makeReadiness({ checkout: { ...makeReadiness().checkout, blockers: [] } });
    const funnel = buildFunnel(clean, []);
    expect(topFailingStage(funnel)).toBeNull();
  });
});

describe("buildRemediation", () => {
  it("emits a robots stanza for blocked agents and a JSON-LD template for gaps", () => {
    const base = makeReadiness();
    const readiness = makeReadiness({
      robots: base.robots.map((r) => ({ ...r, allowed: r.agent !== "GPTBot" })),
      productPages: [
        {
          ...base.productPages[0]!,
          jsonLd: { found: true, price: true, priceCurrency: false, availability: false, skuOrGtin: false, image: true },
          problems: ["offer missing priceCurrency", "product missing sku/gtin"],
        },
      ],
      feeds: { ...base.feeds, llmsTxt: { pass: false, status: 404, notes: "" } },
    });
    const snippets = buildRemediation(readiness, makeMeta());
    const titles = snippets.map((s) => s.title);
    expect(titles.some((t) => t.includes("robots.txt"))).toBe(true);
    expect(titles.some((t) => t.includes("JSON-LD"))).toBe(true);
    expect(titles.some((t) => t.includes("llms.txt"))).toBe(true);
    expect(snippets.find((s) => s.title.includes("robots"))!.body).toContain("User-agent: GPTBot");
  });

  it("emits nothing when readiness is clean", () => {
    expect(buildRemediation(makeReadiness(), makeMeta())).toEqual([]);
  });
});

describe("agentShareBand", () => {
  it("floor excludes heuristic tier, ceiling includes it", () => {
    const band = agentShareBand(makeClassify());
    expect(band.ceilingOrderShare).toBeGreaterThanOrEqual(band.floorOrderShare);
    expect(band.ceilingOrders).toBeGreaterThanOrEqual(band.floorOrders);
  });
});

describe("benchmark", () => {
  it("computes percentile as fraction scoring at or below", () => {
    expect(percentile(70, [10, 50, 70, 90])).toBe(75);
    expect(percentile(5, [10, 50, 70])).toBe(0);
    expect(percentile(100, [])).toBe(0);
  });

  it("benchmarkScore reports median and stores-better", () => {
    const cohort: CohortStats = {
      generatedAt: "2026-06-12",
      n: 5,
      source: "top 50",
      scores: [40, 55, 60, 75, 90],
      checkPassRate: { robotsAllAllowed: 0.6, productsJson: 0.8, sitemap: 0.9, llmsTxt: 0.1, structuredDataClean: 0.5, reachedCheckout: 0.7 },
      blockedAgentRate: { GPTBot: 0.3 },
    };
    const b = benchmarkScore(62, cohort);
    expect(b.median).toBe(60);
    expect(b.storesBetter).toBe(2);
    expect(b.percentile).toBe(60);
  });
});

describe("sparkline", () => {
  it("draws a path with first/last markers", () => {
    const svg = sparkline([
      { label: "Mar", value: 0.06 },
      { label: "Apr", value: 0.07 },
      { label: "May", value: 0.09 },
    ]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
  });

  it("degrades gracefully with under two points", () => {
    expect(sparkline([{ label: "Mar", value: 0.06 }])).toContain("not enough data");
  });
});
