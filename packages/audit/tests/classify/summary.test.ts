import { describe, expect, it } from "vitest";
import { classifyOrder } from "../../src/classify/rules.js";
import { DEFAULT_VAMP, summarize } from "../../src/classify/summary.js";
import type { Classification, DisputeRecord, OrderRecord } from "../../src/classify/types.js";
import { makeOrder } from "../fixtures/orders.js";

const DC = ["3.5.140.0/22"];

function classifyAll(orders: OrderRecord[]): Map<string, Classification> {
  return new Map(orders.map((o) => [o.id, classifyOrder(o, DC)]));
}

function fixtureOrders(): OrderRecord[] {
  return [
    // 6 human, $100 each
    ...Array.from({ length: 6 }, () => makeOrder({ totalPrice: 100 })),
    // 2 high-confidence agent, $50 each
    makeOrder({ userAgent: "Mozilla/5.0 ChatGPT-User/1.0", totalPrice: 50 }),
    makeOrder({ referringSite: "https://perplexity.ai/", totalPrice: 50 }),
    // 1 heuristic, $100
    makeOrder({ browserIp: "3.5.140.9", totalPrice: 100 }),
    // 1 confirmed assistant channel, $200
    makeOrder({ sourceName: "chatgpt", totalPrice: 200 }),
  ];
}

describe("summarize", () => {
  it("computes shares, dispute join, delta and vamp band", () => {
    const orders = fixtureOrders();
    const agentOrderId = orders[6]!.id;
    const humanOrderId = orders[0]!.id;
    const disputes: DisputeRecord[] = [
      { orderId: agentOrderId, status: "needs_response", type: "chargeback", amount: 50, initiatedAt: "2026-05-20" },
      { orderId: humanOrderId, status: "won", type: "chargeback", amount: 100, initiatedAt: "2026-05-21" },
    ];

    const out = summarize({
      store: "demo-store.example",
      generatedAt: "2026-06-12T00:00:00Z",
      windowDays: 90,
      orders,
      classifications: classifyAll(orders),
      disputes,
    });

    expect(out.totals.orders).toBe(10);
    expect(out.totals.gmv).toBe(1000);
    expect(out.byClass.human.orders).toBe(6);
    expect(out.byClass.high_confidence_agent.orders).toBe(2);
    expect(out.byClass.heuristic_agent.orders).toBe(1);
    expect(out.byClass.confirmed_channel.orders).toBe(1);

    const shareSum = Object.values(out.byClass).reduce((s, c) => s + c.orderShare, 0);
    expect(shareSum).toBeCloseTo(1, 9);
    expect(out.byClass.confirmed_channel.gmvShare).toBeCloseTo(0.2, 9);

    // agent side = tiers 2+3 + assistant-flagged tier 1 → 4 orders, 1 dispute
    expect(out.agentVsHuman.agentOrders).toBe(4);
    expect(out.agentVsHuman.agentDisputeRate).toBeCloseTo(0.25, 9);
    expect(out.agentVsHuman.humanDisputeRate).toBeCloseTo(1 / 6, 9);
    expect(out.agentVsHuman.delta).toBeCloseTo(0.25 - 1 / 6, 9);

    expect(out.vamp.combinedRatio).toBeCloseTo(0.2, 9);
    expect(out.vamp.band).toBe("excessive");
    expect(out.vamp.headroomToNextBand).toBeNull();

    expect(out.distinctSources.some((s) => s.sourceName === "chatgpt" && s.flaggedAssistant)).toBe(true);
  });

  it("band boundaries follow the configured thresholds", () => {
    const mk = (orders: number, disputes: number) => {
      const os = Array.from({ length: orders }, () => makeOrder({ totalPrice: 10 }));
      const ds: DisputeRecord[] = os.slice(0, disputes).map((o) => ({
        orderId: o.id, status: "open", type: null, amount: null, initiatedAt: null,
      }));
      return summarize({
        store: "s", generatedAt: "2026-06-12T00:00:00Z", windowDays: 90,
        orders: os, classifications: classifyAll(os), disputes: ds,
      });
    };
    expect(mk(1000, 4).vamp.band).toBe("ok"); // 0.4%
    expect(mk(1000, 5).vamp.band).toBe("above_standard"); // exactly 0.5%
    expect(mk(1000, 15).vamp.band).toBe("excessive"); // exactly 1.5%
    expect(mk(1000, 4).vamp.headroomToNextBand).toBeCloseTo(0.001, 9);
  });

  it("guards zero orders without NaN", () => {
    const out = summarize({
      store: "s", generatedAt: "2026-06-12T00:00:00Z", windowDays: 90,
      orders: [], classifications: new Map(), disputes: [],
    });
    expect(out.totals.disputeRate).toBe(0);
    expect(out.vamp.combinedRatio).toBe(0);
    expect(out.byClass.human.orderShare).toBe(0);
    expect(out.agentVsHuman.delta).toBe(0);
  });

  it("uses default vamp thresholds of 0.5% and 1.5%", () => {
    expect(DEFAULT_VAMP).toEqual({ aboveStandard: 0.005, excessive: 0.015 });
  });
});
