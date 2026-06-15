import type { ClassifyOutput, OrderClass } from "@agentaudit/audit";
import { hBarChart } from "./charts.js";
import type { Economics } from "./economics.js";
import type { FixItem } from "./fixlist.js";
import { escapeHtml, money, pct, section, table } from "./html.js";
import { DEFAULT_WEIGHTS } from "./score.js";
import type { ShareBand } from "./shareBands.js";
import { vampHeadline, type MonthlyVamp } from "./vampMonthly.js";

const MIN_CLASS_ORDERS_FOR_RATE = 100;
const MIN_AGENT_DISPUTES = 5;

const CLASS_LABELS: Record<OrderClass, string> = {
  confirmed_channel: "Confirmed channel",
  high_confidence_agent: "High-confidence agent",
  heuristic_agent: "Heuristic agent",
  human: "Human",
};

export function classificationSection(classify: ClassifyOutput, band: ShareBand): string {
  const entries = Object.entries(classify.byClass) as [OrderClass, ClassifyOutput["byClass"][OrderClass]][];
  const orderBars = entries.map(([cls, s]) => ({
    label: CLASS_LABELS[cls],
    value: s.orders,
    display: `${s.orders.toLocaleString()} · ${pct(s.orderShare)}`,
  }));

  const rows = entries.map(([cls, s]) => [
    CLASS_LABELS[cls],
    s.orders.toLocaleString(),
    pct(s.orderShare),
    money(s.gmv),
    money(s.aov),
    s.orders >= MIN_CLASS_ORDERS_FOR_RATE ? pct(s.refundRate, 1) : `<span class="muted">${s.refunds} (n low)</span>`,
  ]);

  const sourceRows = classify.distinctSources
    .slice(0, 8)
    .map((s) => [
      `<code>${escapeHtml(s.sourceName)}</code>${s.flaggedAssistant ? ' <span class="badge">assistant</span>' : ""}`,
      s.appId === null ? "—" : `<code>${escapeHtml(s.appId)}</code>`,
      s.orders.toLocaleString(),
    ]);

  return section(
    "classification",
    "Order classification",
    [
      `<p>${classify.totals.orders.toLocaleString()} orders (${money(classify.totals.gmv)} GMV) over the last ${classify.windowDays} days.</p>`,
      `<p class="band-line">Agent-attributed order share: <strong>${pct(band.floorOrderShare)}</strong> (floor, strong signals) to <strong>${pct(band.ceilingOrderShare)}</strong> (ceiling, heuristic-inclusive). GMV share: ${pct(band.floorGmvShare)}–${pct(band.ceilingGmvShare)}.</p>`,
      hBarChart(orderBars),
      table(["Class", "Orders", "Share", "GMV", "AOV", "Refund rate"], rows),
      `<h3>Distinct order sources</h3>`,
      table(["source_name", "app_id", "Orders"], sourceRows),
      `<p class="muted small">Refund rate counts refunded/partially-refunded/voided orders (a leading indicator that surfaces faster than formal disputes). Rates are suppressed where a class has fewer than ${MIN_CLASS_ORDERS_FOR_RATE} orders.</p>`,
    ].join("\n"),
  );
}

export function disputeSection(classify: ClassifyOutput, mv: MonthlyVamp, econ: Economics): string {
  const v = classify.vamp;
  const monthRows = mv.months.map((m) => [
    m.month,
    m.orders.toLocaleString(),
    String(m.disputes),
    m.ratio === null ? `<span class="muted">n&lt;${mv.minOrders}</span>` : pct(m.ratio, 2),
    m.band === null ? "—" : bandPill(m.band),
  ]);

  const agentDisputes =
    classify.byClass.high_confidence_agent.disputes + classify.byClass.heuristic_agent.disputes;
  const segRows = (Object.entries(classify.byClass) as [OrderClass, ClassifyOutput["byClass"][OrderClass]][]).map(
    ([cls, s]) => [
      CLASS_LABELS[cls],
      s.orders.toLocaleString(),
      String(s.disputes),
      s.orders >= MIN_CLASS_ORDERS_FOR_RATE ? pct(s.disputeRate, 2) : `<span class="muted">n low</span>`,
    ],
  );

  const dollars = classify.disputeDollars;
  const dollarLine = `<p>Disputed order value over the window: <strong>${money(dollars.total)}</strong> (covering ${pct(dollars.coverage, 0)} of disputes that carried an amount). Of that, ${money(dollars.agentSide)} is agent-attributed. Annualized dispute handling cost at an assumed fee band: <strong>${money(econ.disputeFeeAnnualLow)}–${money(econ.disputeFeeAnnualHigh)}/yr</strong>.</p>`;

  // Delta only when there is enough agent-side dispute volume to be meaningful.
  const delta = classify.agentVsHuman;
  const deltaLine =
    agentDisputes >= MIN_AGENT_DISPUTES
      ? `<p>Agent-attributed orders dispute at <strong>${pct(delta.agentDisputeRate, 2)}</strong> vs <strong>${pct(delta.humanDisputeRate, 2)}</strong> for human orders (${agentDisputes} agent-side disputes across ${delta.agentOrders.toLocaleString()} agent orders).</p>`
      : `<p>Only ${agentDisputes} agent-attributed disputes in the window — too few to quote a reliable agent-vs-human rate. Agent orders: ${delta.agentOrders.toLocaleString()}, human disputes: ${classify.byClass.human.disputes}.</p>`;

  // Arithmetic counterfactual, gated on min-n, explicitly not a causal claim.
  let counterfactual = "";
  if (agentDisputes >= MIN_AGENT_DISPUTES && classify.totals.orders > 0) {
    const withoutRatio = (classify.totals.disputes - agentDisputes) / classify.totals.orders;
    const bandOf = (r: number) =>
      r >= v.config.excessive ? "excessive" : r >= v.config.aboveStandard ? "above standard" : "ok";
    counterfactual = `<p class="counterfactual">Setting aside the ${agentDisputes} agent-attributed disputes, the blended ${classify.windowDays}-day ratio falls from <strong>${pct(v.combinedRatio, 2)}</strong> (${bandOf(v.combinedRatio)}) to <strong>${pct(withoutRatio, 2)}</strong> (${bandOf(withoutRatio)}) — an arithmetic illustration of the agent channel's weight, not a causal claim.</p>`;
  }

  return section(
    "disputes",
    "Dispute exposure (Visa VAMP)",
    [
      `<p class="vamp-math">${vampHeadline(classify, mv)}</p>`,
      `<p class="muted small">VAMP is assessed monthly. We show every month but suppress the ratio for any month under ${mv.minOrders} orders so a low-volume month can't manufacture an alarming number. Denominator is total orders (a proxy that overstates the true ratio: it includes non-Visa tender and inquiries).</p>`,
      table(["Month", "Orders", "Disputes", "Ratio", "Band"], monthRows),
      dollarLine,
      deltaLine,
      counterfactual,
      `<h3>By segment</h3>`,
      table(["Class", "Orders", "Disputes", "Dispute rate"], segRows),
    ].join("\n"),
  );
}

function bandPill(band: "ok" | "above_standard" | "excessive"): string {
  const label = band === "ok" ? "ok" : band === "above_standard" ? "above std" : "excessive";
  return `<span class="band-pill band-${band}">${label}</span>`;
}

export function fixListSection(items: FixItem[]): string {
  if (items.length === 0) {
    return section("fixes", "Fix list", "<p>No blocking issues found — keep feeds and structured data current.</p>");
  }
  const rows = items.map((i) => [
    String(i.rank),
    `<strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.rationale)}</span>`,
    `${i.impact}/5`,
    `${i.effort}/5`,
  ]);
  return section(
    "fixes",
    "Fix list",
    table(["#", "Fix (ranked by impact ÷ effort)", "Impact", "Effort"], rows, "fixlist"),
  );
}

export function howWeScoreSection(hasClassify: boolean, windowDays: number): string {
  const w = DEFAULT_WEIGHTS;
  const scoreRows: string[][] = [
    ["Discovery · Agent access (robots.txt)", String(w.discovery.robots), "allowed agent user-agents ÷ 13, times the weight"],
    ["Discovery · Structured data (JSON-LD)", String(w.discovery.structuredData), "mean across sampled product pages of (required Product/Offer fields present ÷ 5), times the weight"],
    ["Discovery · Product feeds", String(w.discovery.feeds), "half for a reachable /products.json, half for a valid sitemap.xml"],
    ["Discovery · llms.txt", String(w.discovery.llmsTxt), "full if /llms.txt is published"],
    ["Transaction · Cart reachable", String(w.transaction.cartReachable), "full if the automated probe reached the cart"],
    ["Transaction · Checkout reachable", String(w.transaction.checkoutReachable), "full if it reached the checkout information page"],
    ["Transaction · Live agent outcomes", String(w.transaction.manualOutcomes), "successful live agent runs ÷ total live runs, times the weight"],
  ];
  const discoveryMax = w.discovery.robots + w.discovery.structuredData + w.discovery.feeds + w.discovery.llmsTxt;
  const transactionMax = w.transaction.cartReachable + w.transaction.checkoutReachable + w.transaction.manualOutcomes;

  const classifyBlocks = hasClassify
    ? `<h3>How we classify orders</h3>
<ul class="method">
<li><strong>Confirmed channel</strong> — a non-web <code>source_name</code>/<code>app_id</code> recorded by Shopify. Not inferred; zero ambiguity.</li>
<li><strong>High-confidence agent</strong> — a published agent user-agent, an assistant referrer (chatgpt.com, perplexity.ai, claude.ai, …), or an assistant <code>utm_source</code>. Strong signals, but referrers get stripped, so this undercounts.</li>
<li><strong>Heuristic agent</strong> — headless-browser markers or datacenter IP ranges (AWS/GCP/Azure). Signals, not proof: VPN users can land here, so we treat this tier as the ceiling and never the headline.</li>
<li><strong>Human</strong> — the default. Agents that perfectly mimic a consumer browser are invisible in order data, so true agent share is a floor, likely higher than reported.</li>
</ul>
<h3>Dispute &amp; VAMP math</h3>
<p>Dispute ratio = disputes ÷ orders over the ${windowDays}-day window, shown per month with minimum-volume suppression so a low-count month can't manufacture an alarming rate. Visa assesses VAMP monthly on settled VisaNet transactions via your acquirer, so treat our figure as a directional proxy, not the official number. Dollar figures use the merchant-reported disputed amount plus an explicitly-labeled, assumed per-dispute fee band — shown as a range, never a point estimate.</p>`
    : `<h3>Order classification &amp; disputes</h3>
<p>This is a <strong>readiness-only</strong> audit of the public storefront. Order classification and dispute exposure require the merchant's order data (a read-only Shopify token) and are not included here; the full audit adds them.</p>`;

  return section(
    "how-we-score",
    "Appendix — how we score",
    `<p>The <strong>Agent Readiness Score</strong> runs 0–100, split into a <strong>Discovery half (${discoveryMax} pts)</strong> — can agents find and read your catalog — and a <strong>Transaction half (${transactionMax} pts)</strong> — can they actually buy. Each component is earned proportionally (not pass/fail), then summed.</p>
${table(["Component", "Max pts", "How points are earned"], scoreRows)}
<p class="muted small">"Required Product/Offer fields" = price, priceCurrency, availability, SKU or GTIN, and image (5 fields), read from server-rendered JSON-LD.</p>
<h3>Discovery Readiness Score</h3>
<p>The four Discovery rows rescaled to 0–100 (discovery points ÷ ${discoveryMax} × 100). It needs no order data, so it is the headline for readiness-only audits and the basis for the cross-store percentile — an apples-to-apples comparison whether or not a store shared its order data.</p>
${classifyBlocks}
<h3>Caveats</h3>
<ul class="method">
<li>Discovery checks read the <strong>initial HTML response</strong> and do not execute JavaScript. Structured data injected client-side reads as missing here — which is also how agents that don't run JS (most crawler-class agents) see the page.</li>
<li>Per-agent reachability is inferred from robots access and one shared automated probe, except for live runs (ChatGPT/Perplexity/Claude and any assistant we run by hand), which are real purchase attempts. Inferred rows are labeled.</li>
<li>Automated and live checks stop at the checkout information / payment step; no purchase is ever completed and no payment details are entered. CAPTCHA presence is recorded, never solved or bypassed.</li>
</ul>`,
  );
}
