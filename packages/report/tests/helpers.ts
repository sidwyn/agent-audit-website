import { readFileSync } from "node:fs";
import type {
  ClassifyOutput,
  ManualRun,
  ProductPageResult,
  ReadinessReport,
} from "@agentaudit/audit";
import { AGENT_UA_TOKENS } from "@agentaudit/audit";
import type { ReportData, StoreMeta } from "../src/types.js";

// Single source of truth: the real demo fixture, so unit tests and the shipped
// sample PDF can never drift apart.
const DEMO_CLASSIFY = JSON.parse(
  readFileSync(new URL("../fixtures/demo-store/classify.json", import.meta.url), "utf8"),
) as ClassifyOutput;

// The real demo readiness fixture (has blocked agents, missing llms.txt and
// product-page gaps) — used where a test needs the remediation/funnel sections
// to populate. makeReadiness() stays clean/perfect for the score tests.
export function demoReadiness(): ReadinessReport {
  return JSON.parse(
    readFileSync(new URL("../fixtures/demo-store/readiness.json", import.meta.url), "utf8"),
  ) as ReadinessReport;
}

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
  return { ...DEMO_CLASSIFY, ...overrides };
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
