import { describe, expect, it } from "vitest";
import { estimateEconomics } from "../src/economics.js";
import { makeReadiness, makeReportData } from "./helpers.js";

describe("estimateEconomics", () => {
  it("reports measured captured agent revenue with a floor and ceiling", () => {
    const e = estimateEconomics(makeReportData());
    expect(e.capturedAgentWindowHigh).toBeGreaterThanOrEqual(e.capturedAgentWindowLow);
    expect(e.capturedAgentAnnualLow).toBeCloseTo(e.capturedAgentWindowLow * (365 / 90), 4);
    expect(e.annualizeFactor).toBeCloseTo(365 / 90, 6);
  });

  it("annualizes dispute fees with the assumed fee band", () => {
    const e = estimateEconomics(makeReportData());
    expect(e.disputeFeeAnnualHigh).toBeGreaterThan(e.disputeFeeAnnualLow);
    expect(e.disputedCoverage).toBeGreaterThan(0);
    expect(e.agentSideDisputedShare).toBeGreaterThanOrEqual(0);
  });

  it("flags forward risk only when a transaction path fails, with a labeled scenario assumption", () => {
    const failing = makeReportData({
      readiness: makeReadiness({
        checkout: { ...makeReadiness().checkout, reachedCheckout: false },
      }),
    });
    const e = estimateEconomics(failing);
    expect(e.transactionFailureRate).toBeGreaterThan(0);
    expect(e.hasForwardRisk).toBe(true);
    expect(e.forwardAtRiskAnnualHigh).toBeGreaterThan(0);
    expect(e.assumptions.some((a) => a.includes("SCENARIO"))).toBe(true);
  });

  it("has no forward risk when probe and all manual agents succeed", () => {
    const clean = makeReportData({
      readiness: makeReadiness(),
      manualRuns: makeReportData().manualRuns.map((r) => ({ ...r, outcome: "success" as const, failure_stage: undefined })),
    });
    const e = estimateEconomics(clean);
    expect(e.transactionFailureRate).toBe(0);
    expect(e.hasForwardRisk).toBe(false);
    expect(e.forwardAtRiskAnnualHigh).toBe(0);
  });

  it("always surfaces its assumptions for the report to print", () => {
    expect(estimateEconomics(makeReportData()).assumptions.length).toBeGreaterThanOrEqual(3);
  });
});
