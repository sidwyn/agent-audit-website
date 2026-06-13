import { describe, expect, it } from "vitest";
import { computeScore, DEFAULT_WEIGHTS } from "../src/score.js";
import { makeManualRuns, makeReadiness, perfectPage } from "./helpers.js";

describe("DEFAULT_WEIGHTS", () => {
  it("sums to exactly 100", () => {
    const sum =
      Object.values(DEFAULT_WEIGHTS.discovery).reduce((a, b) => a + b, 0) +
      Object.values(DEFAULT_WEIGHTS.transaction).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});

describe("computeScore", () => {
  it("perfect inputs score 100", () => {
    const runs = makeManualRuns().map((r) => ({ ...r, outcome: "success" as const }));
    const { total } = computeScore({ readiness: makeReadiness(), manualRuns: runs });
    expect(total).toBe(100);
  });

  it("all-fail inputs score 0", () => {
    const readiness = makeReadiness({
      robots: makeReadiness().robots.map((r) => ({ ...r, allowed: false })),
      feeds: {
        productsJson: { pass: false, status: 404, notes: "" },
        sitemap: { pass: false, status: 404, notes: "", productUrlCount: 0 },
        llmsTxt: { pass: false, status: 404, notes: "" },
      },
      productPages: [],
      checkout: { ...makeReadiness().checkout, reachedCart: false, reachedCheckout: false },
    });
    const { total } = computeScore({ readiness, manualRuns: [] });
    expect(total).toBe(0);
  });

  it("computes partial component math", () => {
    const base = makeReadiness();
    const readiness = makeReadiness({
      robots: base.robots.map((r, i) => ({ ...r, allowed: i >= 4 })), // 8/12 allowed
      productPages: [
        perfectPage(),
        {
          ...perfectPage(),
          jsonLd: { found: true, price: true, priceCurrency: false, availability: true, skuOrGtin: false, image: true },
        },
      ],
    });
    const { parts, total } = computeScore({ readiness, manualRuns: makeManualRuns() });
    const byKey = Object.fromEntries(parts.map((p) => [p.key, p]));

    expect(byKey.robots!.earned).toBeCloseTo((10 * 8) / 12, 1);
    expect(byKey.structuredData!.earned).toBeCloseTo(15 * ((1 + 0.6) / 2), 1);
    expect(byKey.feeds!.earned).toBe(10);
    expect(byKey.llmsTxt!.earned).toBe(5);
    expect(byKey.cartReachable!.earned).toBe(20);
    expect(byKey.checkoutReachable!.earned).toBe(20);
    expect(byKey.manualOutcomes!.earned).toBeCloseTo(20 / 3, 1);
    expect(total).toBe(Math.round(parts.reduce((s, p) => s + p.earned, 0)));
  });

  it("no manual runs earns 0 with an honest detail note", () => {
    const { parts } = computeScore({ readiness: makeReadiness(), manualRuns: [] });
    const manual = parts.find((p) => p.key === "manualOutcomes")!;
    expect(manual.earned).toBe(0);
    expect(manual.detail).toMatch(/no manual agent runs/);
  });
});
