import { describe, expect, it } from "vitest";
import { draftFindings } from "../src/findings.js";
import { makeReadiness, makeReportData } from "./helpers.js";

describe("draftFindings", () => {
  it("leads with dollars and flags blocked robots, checkout failure and abandons", () => {
    const base = makeReadiness();
    const data = makeReportData({
      readiness: makeReadiness({
        robots: base.robots.map((r, i) => ({ ...r, allowed: i >= 4 })), // 4 blocked
        checkout: {
          ...base.checkout,
          reachedCheckout: false,
          blockers: [{ stage: "checkout", kind: "captcha", detail: "x" }],
        },
      }),
    });
    const findings = draftFindings(data);
    const s = findings.map((f) => f.sentence);
    expect(findings[0]!.sentence).toContain("annualized revenue"); // money leads
    expect(s.some((x) => x.includes("Worst qualifying month"))).toBe(true);
    expect(s.some((x) => x.includes("4 of 12 agent user-agents are blocked"))).toBe(true);
    expect(s.some((x) => x.includes("could not reach checkout"))).toBe(true);
    expect(s.some((x) => x.includes("abandoned the purchase at the variant step"))).toBe(true);
  });

  it("frames missing structured data as 'not server-rendered', not 'absent'", () => {
    const base = makeReadiness();
    const data = makeReportData({
      classify: undefined,
      manualRuns: [],
      readiness: makeReadiness({
        productPages: [
          {
            ...base.productPages[0]!,
            jsonLd: { found: false, price: false, priceCurrency: false, availability: false, skuOrGtin: false, image: false },
            problems: ["no schema.org Product in ld+json"],
          },
        ],
      }),
    });
    const sentences = draftFindings(data).map((f) => f.sentence);
    expect(sentences.some((s) => s.includes("no server-rendered Product structured data"))).toBe(true);
    expect(sentences.some((s) => s.includes("don't execute JavaScript"))).toBe(true);
  });

  it("readiness-only clean data yields positive sentences and no criticals", () => {
    const clean = makeReportData({ classify: undefined, manualRuns: [] });
    const findings = draftFindings(clean);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.severity === "critical")).toBe(false);
    expect(findings.some((f) => f.sentence.includes("All 12 agent user-agents are allowed"))).toBe(true);
  });
});
