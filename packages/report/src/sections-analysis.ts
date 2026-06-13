import type { ClassifyOutput, OrderClass } from "@agentaudit/audit";
import { hBarChart } from "./charts.js";
import type { Economics } from "./economics.js";
import type { FixItem } from "./fixlist.js";
import { escapeHtml, money, pct, section, table } from "./html.js";
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

export function methodologySection(hasClassify: boolean, windowDays: number): string {
  const classifyNotes = hasClassify
    ? `<li><strong>Confirmed channel</strong>: non-web <code>source_name</code>/<code>app_id</code>, recorded by Shopify, not inferred.</li>
<li><strong>High-confidence agent</strong>: published agent user-agent, assistant referrer, or assistant utm_source. Referrers can be stripped, so this undercounts.</li>
<li><strong>Heuristic agent</strong>: headless markers or datacenter IPs (AWS/GCP/Azure). Signals, not proof — VPN users can land here. We report it as the ceiling, never the headline.</li>
<li><strong>Human</strong> is the default; agents that perfectly mimic a consumer browser are invisible, so true agent share is likely higher.</li>
<li>Dispute ratio = disputes ÷ orders over ${windowDays} days, shown monthly with minimum-volume suppression. Visa assesses monthly on settled VisaNet transactions via your acquirer — treat this as a directional proxy, not the official figure. Dollar figures use the merchant-reported disputed amount plus an assumed, clearly-labeled fee band.</li>`
    : `<li>This is a <strong>readiness-only</strong> audit: it measures the public storefront (robots, feeds, structured data, checkout reachability). Order classification and dispute exposure require the merchant's order data and are not included here.</li>`;
  return section(
    "methodology",
    "Methodology & caveats",
    `<ul class="method">
${classifyNotes}
<li>Discovery checks read the <strong>initial HTML response</strong> and do not execute JavaScript. Structured data injected client-side will read as missing here — which is also how agents that don't run JS (most crawler-class agents) see the page.</li>
<li>Per-agent reachability is inferred from robots access and one shared automated probe except for ChatGPT/Perplexity/Claude, which are run as live purchases. Inferred rows are labeled.</li>
<li>Automated checks stop at the checkout information page; no purchase is ever completed and no payment fields are entered. CAPTCHA presence is recorded, never solved or bypassed.</li>
</ul>`,
  );
}
