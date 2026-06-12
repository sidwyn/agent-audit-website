import { parse } from "csv-parse/sync";
import type { DisputeRecord, OrderRecord } from "./types.js";

// Expected orders headers: id, source_name, app_id, user_agent, browser_ip,
//   referring_site, landing_site, total_price, created_at, financial_status
// Expected disputes headers: order_id, status, type, amount, initiated_at

function rows(content: string): Record<string, string>[] {
  return parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];
}

function toNull(v: string | undefined): string | null {
  return v === undefined || v === "" ? null : v;
}

function toNumber(v: string | undefined, field: string, row: number): number {
  if (v === undefined || v === "") return 0;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`row ${row}: ${field} is not a number: ${v}`);
  return n;
}

export function parseOrdersCsv(content: string): OrderRecord[] {
  const parsed = rows(content);
  return parsed.map((r, i) => {
    const id = r.id;
    if (id === undefined) throw new Error("orders csv missing required column: id");
    if (id === "") throw new Error(`orders csv row ${i + 1}: empty id`);
    return {
      id,
      sourceName: toNull(r.source_name),
      appId: toNull(r.app_id),
      userAgent: toNull(r.user_agent),
      browserIp: toNull(r.browser_ip),
      referringSite: toNull(r.referring_site),
      landingSite: toNull(r.landing_site),
      totalPrice: toNumber(r.total_price, "total_price", i + 1),
      createdAt: r.created_at ?? "",
      financialStatus: toNull(r.financial_status),
    };
  });
}

export function parseDisputesCsv(content: string): DisputeRecord[] {
  const parsed = rows(content);
  return parsed.map((r, i) => {
    const orderId = r.order_id;
    if (orderId === undefined) throw new Error("disputes csv missing required column: order_id");
    if (orderId === "") throw new Error(`disputes csv row ${i + 1}: empty order_id`);
    const amount = r.amount === undefined || r.amount === "" ? null : toNumber(r.amount, "amount", i + 1);
    return {
      orderId,
      status: r.status ?? "unknown",
      type: toNull(r.type),
      amount,
      initiatedAt: toNull(r.initiated_at),
    };
  });
}
