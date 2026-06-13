import { describe, expect, it } from "vitest";
import { classifyOrder } from "../../src/classify/rules.js";
import { summarize } from "../../src/classify/summary.js";
import type { Classification, OrderRecord } from "../../src/classify/types.js";
import { makeOrder } from "../fixtures/orders.js";

const DC = ["3.5.140.0/22"];

function classifyAll(orders: OrderRecord[]): Map<string, Classification> {
  return new Map(orders.map((o) => [o.id, classifyOrder(o, DC)]));
}

function run(orders: OrderRecord[]) {
  return summarize({
    store: "s",
    generatedAt: "2026-06-12T00:00:00Z",
    windowDays: 90,
    orders,
    classifications: classifyAll(orders),
    disputes: [],
  });
}

describe("AOV and agent/human gmv", () => {
  const orders = [
    ...Array.from({ length: 6 }, () => makeOrder({ totalPrice: 100 })), // human
    makeOrder({ userAgent: "Mozilla/5.0 ChatGPT-User/1.0", totalPrice: 50 }),
    makeOrder({ referringSite: "https://perplexity.ai/", totalPrice: 50 }),
    makeOrder({ browserIp: "3.5.140.9", totalPrice: 100 }), // heuristic
    makeOrder({ sourceName: "chatgpt", totalPrice: 200 }), // confirmed assistant
  ];
  const out = run(orders);

  it("computes per-class AOV", () => {
    expect(out.byClass.human.aov).toBeCloseTo(100, 9);
    expect(out.byClass.high_confidence_agent.aov).toBeCloseTo(50, 9);
    expect(out.byClass.confirmed_channel.aov).toBeCloseTo(200, 9);
  });

  it("computes agent vs human gmv and aov", () => {
    expect(out.agentVsHuman.agentOrders).toBe(4);
    expect(out.agentVsHuman.agentGmv).toBe(400);
    expect(out.agentVsHuman.humanGmv).toBe(600);
    expect(out.agentVsHuman.agentAov).toBeCloseTo(100, 9);
    expect(out.agentVsHuman.humanAov).toBeCloseTo(100, 9);
  });

  it("guards aov against zero orders", () => {
    expect(run([]).byClass.human.aov).toBe(0);
    expect(run([]).agentVsHuman.agentAov).toBe(0);
  });
});

describe("monthlyTrend", () => {
  it("buckets by calendar month ascending with agent shares", () => {
    const orders = [
      makeOrder({ createdAt: "2026-03-05T10:00:00Z", totalPrice: 100 }),
      makeOrder({ createdAt: "2026-03-20T10:00:00Z", userAgent: "ChatGPT-User/1.0", totalPrice: 100 }),
      makeOrder({ createdAt: "2026-04-02T10:00:00Z", totalPrice: 100 }),
      makeOrder({ createdAt: "2026-05-09T10:00:00Z", referringSite: "https://chatgpt.com/", totalPrice: 100 }),
      makeOrder({ createdAt: "2026-05-19T10:00:00Z", referringSite: "https://perplexity.ai/", totalPrice: 100 }),
    ];
    const trend = run(orders).monthlyTrend;
    expect(trend.map((t) => t.month)).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(trend[0]!.agentOrderShare).toBeCloseTo(0.5, 9);
    expect(trend[1]!.agentOrderShare).toBe(0);
    expect(trend[2]!.agentOrders).toBe(2);
    expect(trend[2]!.agentGmvShare).toBeCloseTo(1, 9);
  });

  it("skips orders with unparseable created_at", () => {
    const trend = run([makeOrder({ createdAt: "" }), makeOrder({ createdAt: "2026-05-01T00:00:00Z" })]).monthlyTrend;
    expect(trend).toHaveLength(1);
    expect(trend[0]!.month).toBe("2026-05");
  });
});
