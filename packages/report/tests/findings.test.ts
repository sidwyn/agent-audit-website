import { describe, expect, it } from "vitest";
import { draftFindings } from "../src/findings.js";
import { makeReadiness, makeReportData } from "./helpers.js";

describe("draftFindings", () => {
  it("describes blocked robots, checkout failure and vamp position as plain sentences", () => {
    const base = makeReadiness();
    const data = makeReportData({
      readiness: makeReadiness({
        robots: base.robots.map((r, i) => ({ ...r, allowed: i >= 4 })),
        checkout: {
          ...base.checkout,
          reachedCheckout: false,
          timeToCheckoutMs: null,
          blockers: [{ stage: "checkout", kind: "captcha", detail: "x" }],
        },
      }),
    });
    const sentences = draftFindings(data).map((f) => f.sentence);
    expect(sentences.some((s) => s.includes("4 of 13 agent user-agents are blocked"))).toBe(true);
    expect(sentences.some((s) => s.startsWith("No automated path reached checkout"))).toBe(true);
    expect(sentences.some((s) => s.includes("captcha at checkout"))).toBe(true);
    expect(sentences.some((s) => s.includes("of GMV over the last 90 days"))).toBe(true);
    expect(sentences.some((s) => s.includes("above Visa's 0.5% monitoring threshold"))).toBe(true);
    expect(sentences.some((s) => s.includes("Perplexity abandoned the purchase at the variant step"))).toBe(true);
  });

  it("produces positive sentences for clean data and is never empty", () => {
    const clean = makeReportData({
      manualRuns: makeReportData().manualRuns.map((r) => ({ ...r, outcome: "success" as const })),
      classify: {
        ...makeReportData().classify,
        agentVsHuman: { agentOrders: 28, agentDisputeRate: 0, humanDisputeRate: 0.002, delta: -0.002 },
        vamp: { config: { aboveStandard: 0.005, excessive: 0.015 }, combinedRatio: 0.002, band: "ok", headroomToNextBand: 0.003 },
      },
    });
    const findings = draftFindings(clean);
    expect(findings.length).toBeGreaterThan(3);
    expect(findings.every((f) => f.sentence.length > 10)).toBe(true);
    expect(findings.some((f) => f.sentence.includes("All 13 agent user-agents are allowed"))).toBe(true);
    expect(findings.some((f) => f.sentence.includes("below Visa's 0.5% monitoring threshold"))).toBe(true);
    expect(findings.some((f) => f.severity === "critical")).toBe(false);
  });
});
