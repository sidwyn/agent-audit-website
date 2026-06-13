import type {
  ClassifyOutput,
  ManualRun,
  ProductPageResult,
  ReadinessReport,
} from "@agentaudit/audit";
import { AGENT_UA_TOKENS } from "@agentaudit/audit";
import type { ReportData, StoreMeta } from "../src/types.js";

export function perfectPage(url = "https://shop.test/products/x"): ProductPageResult {
  return {
    url,
    jsonLd: { found: true, price: true, priceCurrency: true, availability: true, skuOrGtin: true, image: true },
    og: { title: true, image: true },
    canonical: url,
    problems: [],
  };
}

export function makeReadiness(overrides: Partial<ReadinessReport> = {}): ReadinessReport {
  return {
    store: "demo-store.example",
    generatedAt: "2026-06-12T00:00:00Z",
    robots: AGENT_UA_TOKENS.map((agent) => ({ agent, allowed: true, matchedGroup: "*", matchedRule: null })),
    feeds: {
      productsJson: { pass: true, status: 200, notes: "ok" },
      sitemap: { pass: true, status: 200, notes: "ok", productUrlCount: 8 },
      llmsTxt: { pass: true, status: 200, notes: "ok" },
    },
    productPages: [perfectPage()],
    checkout: {
      productUrl: "https://shop.test/products/x",
      reachedCart: true,
      reachedCheckout: true,
      blockers: [],
      jsErrors: [],
      timeToCheckoutMs: 41000,
      screenshots: [],
    },
    ...overrides,
  };
}

export function makeManualRuns(): ManualRun[] {
  return [
    { agent: "chatgpt", task: "buy", steps: ["s"], outcome: "success", screenshots: [] },
    { agent: "perplexity", task: "buy", steps: ["s"], outcome: "abandoned", failure_stage: "variant", screenshots: [] },
    { agent: "claude", task: "buy", steps: ["s"], outcome: "abandoned", failure_stage: "checkout", screenshots: [] },
  ];
}

export function makeClassify(overrides: Partial<ClassifyOutput> = {}): ClassifyOutput {
  const emptyClass = { orders: 0, orderShare: 0, gmv: 0, gmvShare: 0, aov: 0, disputes: 0, disputeRate: 0 };
  return {
    store: "demo-store.example",
    generatedAt: "2026-06-12T00:00:00Z",
    windowDays: 90,
    totals: { orders: 412, gmv: 38240, disputes: 3, disputeRate: 3 / 412 },
    byClass: {
      confirmed_channel: { ...emptyClass, orders: 9, orderShare: 9 / 412, gmv: 1180, gmvShare: 1180 / 38240, aov: 1180 / 9, disputes: 0 },
      high_confidence_agent: { ...emptyClass, orders: 13, orderShare: 13 / 412, gmv: 1610, gmvShare: 1610 / 38240, aov: 1610 / 13, disputes: 1, disputeRate: 1 / 13 },
      heuristic_agent: { ...emptyClass, orders: 6, orderShare: 6 / 412, gmv: 410, gmvShare: 410 / 38240, aov: 410 / 6, disputes: 1, disputeRate: 1 / 6 },
      human: { ...emptyClass, orders: 384, orderShare: 384 / 412, gmv: 35040, gmvShare: 35040 / 38240, aov: 35040 / 384, disputes: 1, disputeRate: 1 / 384 },
    },
    distinctSources: [
      { sourceName: "web", appId: "580111", orders: 401, flaggedAssistant: false },
      { sourceName: "chatgpt", appId: null, orders: 9, flaggedAssistant: true },
      { sourceName: "pos", appId: "129785", orders: 2, flaggedAssistant: false },
    ],
    agentVsHuman: {
      agentOrders: 28,
      agentGmv: 3200,
      humanGmv: 35040,
      agentAov: 3200 / 28,
      humanAov: 35040 / 384,
      agentDisputeRate: 2 / 28,
      humanDisputeRate: 1 / 384,
      delta: 2 / 28 - 1 / 384,
    },
    monthlyTrend: [
      { month: "2026-03", orders: 120, agentOrders: 5, agentOrderShare: 5 / 120, gmv: 11200, agentGmv: 560, agentGmvShare: 560 / 11200 },
      { month: "2026-04", orders: 138, agentOrders: 9, agentOrderShare: 9 / 138, gmv: 12800, agentGmv: 1040, agentGmvShare: 1040 / 12800 },
      { month: "2026-05", orders: 154, agentOrders: 14, agentOrderShare: 14 / 154, gmv: 14240, agentGmv: 1600, agentGmvShare: 1600 / 14240 },
    ],
    vamp: {
      config: { aboveStandard: 0.005, excessive: 0.015 },
      combinedRatio: 3 / 412,
      band: "above_standard",
      headroomToNextBand: 0.015 - 3 / 412,
    },
    ...overrides,
  };
}

export function makeMeta(): StoreMeta {
  return {
    name: "Meridian Supply Co.",
    domain: "demo-store.example",
    gmvBand: "$1M–$5M",
    contact: "owner@demo-store.example",
  };
}

export function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    meta: makeMeta(),
    readiness: makeReadiness(),
    classify: makeClassify(),
    manualRuns: makeManualRuns(),
    generatedAt: "2026-06-12T00:00:00Z",
    ...overrides,
  };
}
