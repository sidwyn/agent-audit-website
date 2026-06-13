import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchDisputes, fetchOrders } from "../../src/classify/shopify.js";
import { classifyOrder } from "../../src/classify/rules.js";
import { summarize } from "../../src/classify/summary.js";
import { loadDatacenterCidrs } from "../../src/classify/cidr.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/shopify/${name}`, import.meta.url), "utf8");

// Drives the Admin API client end-to-end against recorded Shopify payloads:
// realistic nested order JSON, Link-header pagination, and a joined dispute.
// Guards the paid-path API contract (field mapping + pagination) against drift.
describe("Shopify Admin client (recorded fixtures)", () => {
  const TOKEN = "shpat_recorded_secret";
  const page2 = "https://s.myshopify.com/admin/api/2026-01/orders.json?limit=250&page_info=eyJ4IjoyfQ";

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/orders.json") && !url.includes("page_info")) {
      return new Response(fixture("orders-page1.json"), {
        status: 200,
        headers: { "Content-Type": "application/json", Link: `<${page2}>; rel="next"` },
      });
    }
    if (url.includes("page_info")) {
      return new Response(fixture("orders-page2.json"), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/shopify_payments/disputes.json")) {
      return new Response(fixture("disputes.json"), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };

  it("maps the full nested order payload across paginated pages", async () => {
    const orders = await fetchOrders({ shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 }, "2026-02-01T00:00:00Z");
    expect(orders).toHaveLength(3);

    const web = orders[0]!;
    expect(web.id).toBe("5678901234567");
    expect(web.sourceName).toBe("web");
    expect(web.appId).toBe("580111"); // numeric app_id -> string
    expect(web.userAgent).toContain("Safari");
    expect(web.browserIp).toBe("98.42.17.5"); // pulled from nested client_details
    expect(web.totalPrice).toBe(189);
    expect(web.financialStatus).toBe("paid");

    const agent = orders[1]!;
    expect(agent.sourceName).toBe("chatgpt");
    expect(agent.appId).toBeNull(); // null app_id stays null
    expect(orders[2]!.financialStatus).toBe("refunded");
  });

  it("maps disputes and joins them through the full classify pipeline", async () => {
    const opts = { shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 };
    const orders = await fetchOrders(opts, "2026-02-01T00:00:00Z");
    const { available, disputes } = await fetchDisputes(opts);
    expect(available).toBe(true);
    expect(disputes[0]).toMatchObject({ orderId: "5678901234568", type: "chargeback", amount: 89.5 });

    const cidrs = loadDatacenterCidrs();
    const classifications = new Map(orders.map((o) => [o.id, classifyOrder(o, cidrs)]));
    const out = summarize({
      store: "s.myshopify.com",
      generatedAt: "2026-06-13T00:00:00Z",
      windowDays: 90,
      orders,
      classifications,
      disputes,
    });

    // chatgpt source -> confirmed assistant channel; HeadlessChrome + AWS IP -> heuristic
    expect(out.byClass.confirmed_channel.orders).toBe(1);
    expect(out.byClass.heuristic_agent.orders).toBe(1);
    expect(out.byClass.human.orders).toBe(1);
    // the dispute lands on the chatgpt (agent-side) order
    expect(out.disputeDollars.agentSide).toBe(89.5);
    expect(out.disputeDollars.total).toBe(89.5);
    // the refunded order is the HeadlessChrome + AWS-IP one -> heuristic tier, not human
    expect(out.byClass.heuristic_agent.refunds).toBe(1);
    expect(out.byClass.human.refunds).toBe(0);
  });
});
