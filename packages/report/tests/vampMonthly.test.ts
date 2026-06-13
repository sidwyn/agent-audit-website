import type { MonthBucket } from "@agentaudit/audit";
import { describe, expect, it } from "vitest";
import { monthlyVamp, vampHeadline } from "../src/vampMonthly.js";
import { makeClassify } from "./helpers.js";

const VAMP = { aboveStandard: 0.005, excessive: 0.015 };

function bucket(month: string, orders: number, disputes: number): MonthBucket {
  return { month, orders, agentOrders: 0, agentOrderShare: 0, gmv: 0, agentGmv: 0, agentGmvShare: 0, disputes };
}

describe("monthlyVamp", () => {
  it("computes a band per qualifying month and picks the worst", () => {
    const mv = monthlyVamp(
      [bucket("2026-03", 800, 3), bucket("2026-04", 1562, 13), bucket("2026-05", 1905, 12)],
      VAMP,
      200,
    );
    expect(mv.qualifyingMonths).toBe(3);
    expect(mv.months[1]!.ratio).toBeCloseTo(13 / 1562, 6);
    expect(mv.months[1]!.band).toBe("above_standard");
    expect(mv.worstQualifying!.month).toBe("2026-04");
  });

  it("suppresses the ratio for low-volume months (never renders 50%)", () => {
    const mv = monthlyVamp([bucket("2026-03", 2, 1), bucket("2026-04", 900, 4)], VAMP, 200);
    expect(mv.months[0]!.suppressed).toBe(true);
    expect(mv.months[0]!.ratio).toBeNull();
    expect(mv.months[0]!.band).toBeNull();
    expect(mv.worstQualifying!.month).toBe("2026-04");
  });

  it("returns no worst month when nothing qualifies", () => {
    const mv = monthlyVamp([bucket("2026-03", 10, 1)], VAMP, 200);
    expect(mv.worstQualifying).toBeNull();
    expect(vampHeadline(makeClassify(), mv)).toMatch(/too low/);
  });

  it("headline names the worst qualifying month and band", () => {
    const mv = monthlyVamp([bucket("2026-04", 1562, 13)], VAMP, 200);
    expect(vampHeadline(makeClassify(), mv)).toContain("2026-04");
    expect(vampHeadline(makeClassify(), mv)).toContain("above Visa's standard threshold");
  });
});
