import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadinessReport } from "@agentaudit/audit";
import { describe, expect, it } from "vitest";
import { composeReport } from "../src/template.js";
import { makeReadiness, makeReportData } from "./helpers.js";

function assertClean(html: string) {
  expect(html).not.toMatch(/undefined|NaN/);
  expect(html).not.toContain("<script>alert"); // raw injection must be escaped
}

describe("composeReport robustness (adversarial inputs)", () => {
  it("handles a hostile store name and malformed product URLs", () => {
    const base = makeReadiness();
    const data = makeReportData({
      meta: { name: '<script>alert("xss")</script> & "Co"', domain: "evil\".com", gmvBand: "", contact: "" },
      classify: undefined,
      manualRuns: [],
      readiness: makeReadiness({
        productPages: [
          { ...base.productPages[0]!, url: "not a url", problems: ["no schema.org Product in ld+json"], jsonLd: { found: false, price: false, priceCurrency: false, availability: false, skuOrGtin: false, image: false } },
          { ...base.productPages[0]!, url: "/relative/path", problems: [] },
        ],
        checkout: { ...base.checkout, productUrl: null, reachedCart: false, reachedCheckout: false },
      }),
    });
    const html = composeReport({ ...data, classify: undefined });
    assertClean(html);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("not server-rendered");
  });

  it("handles empty product pages and all-blocked robots", () => {
    const base = makeReadiness();
    const readiness: ReadinessReport = {
      ...base,
      robots: base.robots.map((r) => ({ ...r, allowed: false })),
      productPages: [],
      feeds: {
        productsJson: { pass: false, status: 403, notes: "" },
        sitemap: { pass: false, status: 404, notes: "", productUrlCount: 0 },
        llmsTxt: { pass: false, status: 404, notes: "" },
      },
    };
    const html = composeReport({ meta: makeReportData().meta, readiness, manualRuns: [], generatedAt: "2026-06-12T00:00:00Z" });
    assertClean(html);
  });

  it("handles a zero-order classify without NaN", () => {
    const z = makeReportData().classify!;
    const empty = {
      ...z,
      totals: { orders: 0, gmv: 0, disputes: 0, disputeRate: 0 },
      monthlyTrend: [],
      disputeDollars: { total: 0, counted: 0, coverage: 0, agentSide: 0, humanSide: 0 },
    };
    const html = composeReport(makeReportData({ classify: empty }));
    assertClean(html);
  });
});

// Smoke over the real generated corpus — proves the report survives the full
// diversity of live stores. Skipped if the cohort folders aren't present.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cohortDirs = ["cohort-2026-06", "cohort-leads-2026-06", "cohort-next100-2026-06"]
  .map((d) => path.join(repoRoot, d))
  .filter((d) => existsSync(d));

describe.skipIf(cohortDirs.length === 0)("composeReport over the real cohort corpus", () => {
  it("renders every committed readiness.json with no undefined/NaN/throw", () => {
    let checked = 0;
    for (const dir of cohortDirs) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const rPath = path.join(dir, entry.name, "readiness.json");
        const sPath = path.join(dir, entry.name, "store.json");
        if (!existsSync(rPath) || !existsSync(sPath)) continue;
        const readiness = JSON.parse(readFileSync(rPath, "utf8")) as ReadinessReport;
        const meta = JSON.parse(readFileSync(sPath, "utf8"));
        const html = composeReport({ meta, readiness, manualRuns: [], generatedAt: "2026-06-12T00:00:00Z" });
        expect(html, entry.name).not.toMatch(/undefined|NaN/);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
