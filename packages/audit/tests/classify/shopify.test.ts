import { describe, expect, it } from "vitest";
import { fetchDisputes, fetchOrders } from "../../src/classify/shopify.js";

const TOKEN = "shpat_secret_value";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

describe("fetchOrders", () => {
  it("paginates via the Link header and maps fields", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const page2Url = "https://s.myshopify.com/admin/api/2026-01/orders.json?page_info=abc&limit=250";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      if (calls.length === 1) {
        return jsonResponse(
          {
            orders: [
              {
                id: 1,
                source_name: "web",
                app_id: 580111,
                client_details: { user_agent: "Safari", browser_ip: "1.2.3.4" },
                referring_site: "https://google.com",
                landing_site: "/products/a",
                total_price: "42.50",
                created_at: "2026-05-01T00:00:00Z",
                financial_status: "paid",
              },
              { id: 2, source_name: "chatgpt", client_details: null, total_price: "10.00" },
            ],
          },
          { headers: { Link: `<${page2Url}>; rel="next"` } },
        );
      }
      return jsonResponse({ orders: [{ id: 3, total_price: "5.00" }] });
    };

    const orders = await fetchOrders(
      { shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 },
      "2026-03-01T00:00:00Z",
    );

    expect(orders).toHaveLength(3);
    expect(orders[0]).toMatchObject({
      id: "1",
      sourceName: "web",
      appId: "580111",
      userAgent: "Safari",
      browserIp: "1.2.3.4",
      totalPrice: 42.5,
    });
    expect(orders[1]!.userAgent).toBeNull();
    expect(orders[1]!.appId).toBeNull();
    expect(calls[1]!.url).toBe(page2Url);
    expect(calls[0]!.headers["X-Shopify-Access-Token"]).toBe(TOKEN);
    expect(calls[0]!.url).toContain("created_at_min=2026-03-01");
    expect(calls[0]!.url).toContain("status=any");
  });

  it("retries on 429 honoring Retry-After", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n += 1;
      if (n === 1) return jsonResponse({}, { status: 429, headers: { "Retry-After": "0" } });
      return jsonResponse({ orders: [{ id: 9, total_price: "1.00" }] });
    };
    const orders = await fetchOrders(
      { shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 },
      "2026-03-01T00:00:00Z",
    );
    expect(orders).toHaveLength(1);
    expect(n).toBe(2);
  });

  it("throws a status-only error that never contains the token", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("boom", { status: 500, statusText: "Internal Server Error" });
    await expect(
      fetchOrders({ shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 }, "2026-03-01"),
    ).rejects.toThrow(/orders fetch failed: 500/);
    try {
      await fetchOrders({ shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 }, "2026-03-01");
    } catch (err) {
      expect(String(err)).not.toContain(TOKEN);
    }
  });
});

describe("fetchDisputes", () => {
  it("returns available=false on 403 instead of throwing", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ errors: "no scope" }, { status: 403 });
    const out = await fetchDisputes({ shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 });
    expect(out).toEqual({ available: false, disputes: [] });
  });

  it("maps disputes when available", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        disputes: [
          { id: 7, order_id: 1003, status: "needs_response", type: "chargeback", amount: "89.00" },
        ],
      });
    const out = await fetchDisputes({ shop: "s.myshopify.com", token: TOKEN, fetchImpl, delayMs: 0 });
    expect(out.available).toBe(true);
    expect(out.disputes[0]).toMatchObject({ orderId: "1003", type: "chargeback", amount: 89 });
  });
});
