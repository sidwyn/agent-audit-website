import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadDatacenterCidrs } from "../classify/cidr.js";
import { parseDisputesCsv, parseOrdersCsv } from "../classify/csv.js";
import { classifyOrder } from "../classify/rules.js";
import { fetchDisputes, fetchOrders } from "../classify/shopify.js";
import { summarize } from "../classify/summary.js";
import type { Classification, ClassifyOutput, DisputeRecord, OrderRecord } from "../classify/types.js";
import { dataDir, storeSlug } from "../paths.js";

export type ClassifyCommandOpts = {
  shop?: string;
  token?: string; // name of the env var holding the access token
  orders?: string; // csv path (fallback mode)
  disputes?: string; // csv path (fallback mode)
  store?: string; // label override; required in csv mode without --shop
  days?: number;
  vampStandard?: number; // percent, e.g. 0.5
  vampExcessive?: number; // percent, e.g. 1.5
  out?: string;
  now?: Date; // injectable for tests
};

export async function runClassify(
  opts: ClassifyCommandOpts,
): Promise<{ outPath: string; output: ClassifyOutput; disputesAvailable: boolean }> {
  const days = opts.days ?? 90;
  const now = opts.now ?? new Date();
  const storeLabel = opts.store ?? opts.shop;
  if (!storeLabel) throw new Error("provide --store <label> (or --shop <domain>)");

  let orders: OrderRecord[];
  let disputes: DisputeRecord[] = [];
  let disputesAvailable = true;

  if (opts.orders) {
    orders = parseOrdersCsv(await readFile(opts.orders, "utf8"));
    if (opts.disputes) {
      disputes = parseDisputesCsv(await readFile(opts.disputes, "utf8"));
    } else {
      disputesAvailable = false;
    }
  } else if (opts.shop) {
    if (!opts.token) throw new Error("provide --token <ENV_NAME> for api mode");
    const token = process.env[opts.token];
    if (!token) throw new Error(`token env var ${opts.token} is not set`);
    const createdAtMin = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    orders = await fetchOrders({ shop: opts.shop, token }, createdAtMin);
    const d = await fetchDisputes({ shop: opts.shop, token });
    disputes = d.disputes;
    disputesAvailable = d.available;
  } else {
    throw new Error("provide either --shop/--token or --orders <csv>");
  }

  const cidrs = loadDatacenterCidrs();
  const classifications = new Map<string, Classification>(
    orders.map((o) => [o.id, classifyOrder(o, cidrs)]),
  );

  const output = summarize({
    store: storeSlug(storeLabel),
    generatedAt: now.toISOString(),
    windowDays: days,
    orders,
    classifications,
    disputes,
    vamp: {
      aboveStandard: (opts.vampStandard ?? 0.5) / 100,
      excessive: (opts.vampExcessive ?? 1.5) / 100,
    },
  });

  const outPath = opts.out ?? path.join(dataDir(storeLabel), "classify.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2));
  return { outPath, output, disputesAvailable };
}

export function formatClassifySummary(
  output: ClassifyOutput,
  disputesAvailable: boolean,
): string {
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const lines = [
    `store: ${output.store}  orders: ${output.totals.orders}  gmv: $${output.totals.gmv.toFixed(2)}  window: ${output.windowDays}d`,
    ...Object.entries(output.byClass).map(
      ([cls, s]) =>
        `${cls.padEnd(22)} orders=${String(s.orders).padStart(5)}  share=${pct(s.orderShare).padStart(7)}  gmv_share=${pct(s.gmvShare).padStart(7)}  disputes=${s.disputes}`,
    ),
    `agent vs human dispute rate: ${pct(output.agentVsHuman.agentDisputeRate)} vs ${pct(output.agentVsHuman.humanDisputeRate)} (delta ${pct(output.agentVsHuman.delta)})`,
    `vamp: ratio=${pct(output.vamp.combinedRatio)} band=${output.vamp.band}`,
  ];
  if (!disputesAvailable) {
    lines.push("note: disputes unavailable (no scope or csv) — dispute rates reflect zero disputes");
  }
  return lines.join("\n");
}
