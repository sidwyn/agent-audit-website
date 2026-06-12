import type { OrderRecord } from "../../src/classify/types.js";

let seq = 0;

export function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  seq += 1;
  return {
    id: `order-${seq}`,
    sourceName: "web",
    appId: "580111",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    browserIp: "98.42.17.5",
    referringSite: "https://www.google.com/",
    landingSite: "/products/example",
    totalPrice: 64,
    createdAt: "2026-05-01T12:00:00Z",
    financialStatus: "paid",
    ...overrides,
  };
}
