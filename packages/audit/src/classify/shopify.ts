import type { DisputeRecord, OrderRecord } from "./types.js";

// REST Admin API: legacy since Oct 2024 but fully supported for custom apps
// created in the Shopify admin (our token model). Verified 2026-06: latest
// stable version 2026-01. If this ever moves to GraphQL, mapOrder/mapDispute
// are the only translation points.
const DEFAULT_API_VERSION = "2026-01";
const ORDER_FIELDS =
  "id,source_name,app_id,client_details,referring_site,landing_site,total_price,created_at,financial_status";

export type ShopifyClientOpts = {
  shop: string; // my-store.myshopify.com
  token: string; // resolved from env by the command layer; never logged
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  delayMs?: number; // pause between page fetches
};

type RestOrder = {
  id: number | string;
  source_name?: string | null;
  app_id?: number | string | null;
  client_details?: { user_agent?: string | null; browser_ip?: string | null } | null;
  referring_site?: string | null;
  landing_site?: string | null;
  total_price?: string | null;
  created_at?: string | null;
  financial_status?: string | null;
};

type RestDispute = {
  id: number | string;
  order_id?: number | string | null;
  status?: string | null;
  type?: string | null;
  amount?: string | null;
  initiated_at?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapOrder(o: RestOrder): OrderRecord {
  return {
    id: String(o.id),
    sourceName: o.source_name ?? null,
    appId: o.app_id === null || o.app_id === undefined ? null : String(o.app_id),
    userAgent: o.client_details?.user_agent ?? null,
    browserIp: o.client_details?.browser_ip ?? null,
    referringSite: o.referring_site ?? null,
    landingSite: o.landing_site ?? null,
    totalPrice: Number(o.total_price ?? 0) || 0,
    createdAt: o.created_at ?? "",
    financialStatus: o.financial_status ?? null,
  };
}

export function mapDispute(d: RestDispute): DisputeRecord {
  return {
    orderId: d.order_id === null || d.order_id === undefined ? "" : String(d.order_id),
    status: d.status ?? "unknown",
    type: d.type ?? null,
    amount: d.amount === null || d.amount === undefined ? null : Number(d.amount) || null,
    initiatedAt: d.initiated_at ?? null,
  };
}

function nextUrlFromLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function fetchPage(
  url: string,
  opts: ShopifyClientOpts,
  what: string,
): Promise<Response> {
  const f = opts.fetchImpl ?? fetch;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await f(url, {
      headers: { "X-Shopify-Access-Token": opts.token, Accept: "application/json" },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await sleep((Number.isNaN(retryAfter) ? 2 : retryAfter) * 1000);
      continue;
    }
    return res;
  }
  // status-only error: never echo the URL query or token
  throw new Error(`shopify ${what} fetch failed: rate-limited after 5 attempts`);
}

export async function fetchOrders(
  opts: ShopifyClientOpts,
  createdAtMin: string,
): Promise<OrderRecord[]> {
  const version = opts.apiVersion ?? DEFAULT_API_VERSION;
  const delayMs = opts.delayMs ?? 600;
  const params = new URLSearchParams({
    status: "any",
    limit: "250",
    created_at_min: createdAtMin,
    fields: ORDER_FIELDS,
  });
  let url: string | null = `https://${opts.shop}/admin/api/${version}/orders.json?${params}`;
  const orders: OrderRecord[] = [];

  while (url) {
    const res = await fetchPage(url, opts, "orders");
    if (!res.ok) {
      throw new Error(`shopify orders fetch failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { orders?: RestOrder[] };
    orders.push(...(body.orders ?? []).map(mapOrder));
    url = nextUrlFromLink(res.headers.get("Link"));
    if (url) await sleep(delayMs);
  }
  return orders;
}

export async function fetchDisputes(
  opts: ShopifyClientOpts,
): Promise<{ available: boolean; disputes: DisputeRecord[] }> {
  const version = opts.apiVersion ?? DEFAULT_API_VERSION;
  const delayMs = opts.delayMs ?? 600;
  let url: string | null =
    `https://${opts.shop}/admin/api/${version}/shopify_payments/disputes.json?limit=250`;
  const disputes: DisputeRecord[] = [];

  while (url) {
    const res = await fetchPage(url, opts, "disputes");
    if ([401, 402, 403, 404].includes(res.status)) {
      // token lacks read_shopify_payments_disputes or store isn't on Shopify Payments
      return { available: false, disputes: [] };
    }
    if (!res.ok) {
      throw new Error(`shopify disputes fetch failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { disputes?: RestDispute[] };
    disputes.push(...(body.disputes ?? []).map(mapDispute));
    url = nextUrlFromLink(res.headers.get("Link"));
    if (url) await sleep(delayMs);
  }
  return { available: true, disputes };
}
