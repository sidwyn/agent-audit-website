import { describe, expect, it } from "vitest";
import type { CohortStats } from "../src/benchmark.js";
import { composeReport } from "../src/template.js";
import { demoReadiness, makeReportData } from "./helpers.js";

const COHORT: CohortStats = {
  generatedAt: "2026-06-12",
  n: 50,
  source: "top 50 Shopify stores, June 2026",
  scores: [30, 40, 45, 50, 55, 60, 62, 70, 80, 88],
  checkPassRate: { robotsAllAllowed: 0.4, productsJson: 0.9, sitemap: 0.95, llmsTxt: 0.08, structuredDataClean: 0.5, reachedCheckout: 0.7 },
  blockedAgentRate: { GPTBot: 0.4 },
};

describe("composeReport (full)", () => {
  const html = composeReport(makeReportData({ readiness: demoReadiness() }), { cohort: COHORT });

  it("renders the scorecard with store name and score out of 100", () => {
    expect(html).toContain("Meridian Supply Co.");
    expect(html).toMatch(/<span class="score-num">\d+<\/span><span class="score-denom">\/ 100/);
  });

  it("leads with money and the new sections", () => {
    for (const heading of [
      "What agent commerce is worth to you",
      "Executive summary",
      "How you compare",
      "Dispute exposure",
      "Can each agent buy from you?",
      "Agent-share trajectory",
      "Order classification",
      "Discovery layer",
      "Transaction layer",
      "Where agents drop off",
      "Fix list",
      "Copy-paste fixes",
      "how we score",
    ]) {
      expect(html, heading).toContain(heading);
    }
  });

  it("shows a monthly worst-month VAMP headline, not a blended single ratio", () => {
    expect(html).toContain("Worst qualifying month");
    expect(html).not.toMatch(/\d+ disputes ÷ [\d,]+ orders =/); // the old broken blended headline
  });

  it("dollarizes agent revenue and dispute cost", () => {
    expect(html).toContain("Agent-attributed revenue (annualized)");
    expect(html).toContain("Dispute handling cost (annualized)");
    expect(html).toContain("Assumptions");
  });

  it("lists the four household-name shopping agents in the matrix", () => {
    expect(html).toContain("ChatGPT");
    expect(html).toContain("Perplexity");
    expect(html).toContain("Claude");
    expect(html).toContain("Gemini");
  });

  it("benchmarks against the cohort", () => {
    expect(html).toContain("cohort of 50 stores");
  });

  it("renders multiple inline svg charts", () => {
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("never leaks undefined or NaN", () => {
    expect(html).not.toMatch(/undefined|NaN/);
  });
});

describe("composeReport (readiness-only)", () => {
  const data = makeReportData({ readiness: demoReadiness() });
  const html = composeReport({ ...data, classify: undefined });

  it("omits the order/economics half but keeps readiness and the matrix", () => {
    expect(html).toContain("Discovery layer");
    expect(html).toContain("Can each agent buy from you?");
    expect(html).toContain("Readiness Audit");
    expect(html).not.toContain('id="money"');
    expect(html).not.toContain('id="classification"');
    expect(html).not.toContain('id="disputes"');
  });

  it("methodology states it is readiness-only", () => {
    expect(html).toContain("readiness-only");
  });

  it("never leaks undefined or NaN", () => {
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
