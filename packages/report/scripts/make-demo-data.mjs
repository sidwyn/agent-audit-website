// Deterministic synthetic order/dispute generator for the demo store
// "Meridian Supply Co." Produces a realistic ~$2M/yr store so the sample report
// shows believable volume and a sub-1% dispute ratio (the real-world regime),
// instead of the toy 40-order fixture that made VAMP render as 7.5%.
//
// Seeded (no Math.random) so output is reproducible and the committed fixtures
// are stable. Run: node packages/report/scripts/make-demo-data.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/demo-store/source");

// --- seeded PRNG (mulberry32) ---
let state = 0x9e3779b9;
function rnd() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n) => String(n).padStart(2, "0");

const CATALOG = [
  { sku: "FJ-001", price: 189, w: 10 },
  { sku: "CT-014", price: 89, w: 22 },
  { sku: "TB-220", price: 36, w: 20 },
  { sku: "WB-009", price: 28, w: 16 },
  { sku: "CM-101", price: 24, w: 12 },
  { sku: "DB-330", price: 54, w: 9 },
  { sku: "TS-540", price: 18, w: 7 },
  { sku: "GC-050", price: 50, w: 4 },
];
const WEIGHTED = CATALOG.flatMap((p) => Array(p.w).fill(p));

const HUMAN_UAS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36",
];
const HUMAN_REFERRERS = ["https://www.google.com/", "https://www.instagram.com/", "", "", "https://www.tiktok.com/", "https://www.bing.com/"];
const HUMAN_IPS = ["73.92.", "98.42.", "24.61.", "67.183.", "71.198.", "100.34.", "174.56.", "96.230."];
const AGENT_UAS = ["Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "Mozilla/5.0 (compatible; Claude-User/1.0; +https://anthropic.com)"];
const ASSISTANT_REFERRERS = ["https://chatgpt.com/", "https://www.perplexity.ai/", "https://claude.ai/"];

function residentialIp() {
  return `${pick(HUMAN_IPS)}${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}`;
}
function datacenterIp() {
  // within AWS 3.5.140.0/22 (matches the vendored CIDR list -> heuristic tier)
  return `3.5.${140 + Math.floor(rnd() * 4)}.${Math.floor(rnd() * 256)}`;
}
function financialStatus(isAgent) {
  const r = rnd();
  if (isAgent) {
    if (r < 0.05) return "refunded";
    if (r < 0.075) return "partially_refunded";
    if (r < 0.085) return "voided";
    return "paid";
  }
  if (r < 0.03) return "refunded";
  if (r < 0.045) return "partially_refunded";
  if (r < 0.05) return "voided";
  return "paid";
}

const START = Date.UTC(2026, 2, 14); // Mar 14 2026
const DAYS = 91;
const orders = [];
let id = 100000;

for (let d = 0; d < DAYS; d++) {
  const t = d / (DAYS - 1);
  const dayCount = Math.round(lerp(42, 70, t) + (rnd() - 0.5) * 10);
  const agentProb = lerp(0.045, 0.11, t);
  const date = new Date(START + d * 86400000);
  const ymd = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  for (let i = 0; i < dayCount; i++) {
    id += 1;
    const product = pick(WEIGHTED);
    const ts = `${ymd}T${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}:00Z`;
    const isAgent = rnd() < agentProb;
    const base = {
      id: String(id),
      source_name: "web",
      app_id: "580111",
      user_agent: "",
      browser_ip: "",
      referring_site: "",
      landing_site: "/products/x",
      total_price: product.price.toFixed(2),
      created_at: ts,
      financial_status: financialStatus(isAgent),
    };
    if (!isAgent) {
      base.user_agent = pick(HUMAN_UAS);
      base.browser_ip = residentialIp();
      base.referring_site = pick(HUMAN_REFERRERS);
      orders.push({ ...base, _agent: false });
      continue;
    }
    const tier = rnd();
    if (tier < 0.07) {
      base.source_name = "chatgpt"; // confirmed channel
      base.user_agent = pick(HUMAN_UAS);
      base.browser_ip = residentialIp();
    } else if (tier < 0.66) {
      // high-confidence: UA / referrer / utm
      const flavor = rnd();
      base.user_agent = flavor < 0.5 ? pick(AGENT_UAS) : pick(HUMAN_UAS);
      base.referring_site = flavor < 0.5 ? "" : pick(ASSISTANT_REFERRERS);
      if (flavor >= 0.8) base.landing_site = "/products/x?utm_source=perplexity";
      base.browser_ip = residentialIp();
    } else {
      // heuristic: headless UA or datacenter IP
      if (rnd() < 0.5) base.user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/125.0 Safari/537.36";
      else base.user_agent = pick(HUMAN_UAS);
      base.browser_ip = datacenterIp();
    }
    orders.push({ ...base, _agent: true });
  }
}

// disputes: bias toward agent-side orders, keep overall ratio ~0.6%
const disputes = [];
for (const o of orders) {
  const p = o._agent ? 0.02 : 0.005;
  if (rnd() < p) {
    const amount = rnd() < 0.9 ? o.total_price : "";
    disputes.push({
      order_id: o.id,
      status: pick(["needs_response", "under_review", "won", "lost"]),
      type: pick(["chargeback", "chargeback", "inquiry"]),
      amount,
      initiated_at: o.created_at,
    });
  }
}

const ordersCsv = [
  "id,source_name,app_id,user_agent,browser_ip,referring_site,landing_site,total_price,created_at,financial_status",
  ...orders.map((o) =>
    [o.id, o.source_name, o.app_id, `"${o.user_agent}"`, o.browser_ip, o.referring_site, o.landing_site, o.total_price, o.created_at, o.financial_status].join(","),
  ),
].join("\n");
const disputesCsv = [
  "order_id,status,type,amount,initiated_at",
  ...disputes.map((d) => [d.order_id, d.status, d.type, d.amount, d.initiated_at].join(",")),
].join("\n");

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "orders.csv"), `${ordersCsv}\n`);
await writeFile(path.join(OUT, "disputes.csv"), `${disputesCsv}\n`);
const gmv = orders.reduce((s, o) => s + Number(o.total_price), 0);
console.log(
  `orders=${orders.length} gmv=$${Math.round(gmv).toLocaleString()} (annualized ~$${Math.round((gmv / 91) * 365).toLocaleString()}) agentOrders=${orders.filter((o) => o._agent).length} disputes=${disputes.length} ratio=${((disputes.length / orders.length) * 100).toFixed(2)}%`,
);
