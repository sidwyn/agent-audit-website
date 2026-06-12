import type { ClassifyOutput } from "@agentaudit/audit";
import { hBarChart } from "./charts.js";
import type { FixItem } from "./fixlist.js";
import { escapeHtml, money, pct, section, table } from "./html.js";

const CLASS_LABELS: Record<string, string> = {
  confirmed_channel: "Confirmed channel",
  high_confidence_agent: "High-confidence agent",
  heuristic_agent: "Heuristic agent",
  human: "Human",
};

export function classificationSection(classify: ClassifyOutput): string {
  const entries = Object.entries(classify.byClass);
  const orderBars = entries.map(([cls, s]) => ({
    label: CLASS_LABELS[cls] ?? cls,
    value: s.orders,
    display: `${s.orders} · ${pct(s.orderShare)}`,
  }));
  const gmvBars = entries.map(([cls, s]) => ({
    label: CLASS_LABELS[cls] ?? cls,
    value: s.gmv,
    display: `${money(s.gmv)} · ${pct(s.gmvShare)}`,
  }));

  const sourceRows = classify.distinctSources.map((s) => [
    `<code>${escapeHtml(s.sourceName)}</code>${s.flaggedAssistant ? ' <span class="badge">assistant</span>' : ""}`,
    s.appId === null ? "—" : `<code>${escapeHtml(s.appId)}</code>`,
    String(s.orders),
  ]);

  return section(
    "classification",
    "Order classification",
    [
      `<p>${classify.totals.orders} orders (${money(classify.totals.gmv)} GMV) over the last ${classify.windowDays} days.</p>`,
      `<h3>Orders by class</h3>`,
      hBarChart(orderBars),
      `<h3>GMV by class</h3>`,
      hBarChart(gmvBars),
      `<h3>Distinct order sources</h3>`,
      table(["source_name", "app_id", "Orders"], sourceRows),
    ].join("\n"),
  );
}

export function disputeSection(classify: ClassifyOutput): string {
  const v = classify.vamp;
  const bandLabel =
    v.band === "ok" ? "below monitoring thresholds" : v.band === "above_standard" ? "ABOVE STANDARD" : "EXCESSIVE";

  const math = `<p class="vamp-math">${classify.totals.disputes} disputes ÷ ${classify.totals.orders} orders = <strong>${pct(v.combinedRatio, 2)}</strong> — ${escapeHtml(bandLabel)} under Visa VAMP (April 2026 rules: ${pct(v.config.aboveStandard, 1)} above-standard, ${pct(v.config.excessive, 1)} excessive).</p>`;

  const headroom =
    v.headroomToNextBand !== null
      ? `<p>Headroom to the next band: <strong>${pct(v.headroomToNextBand, 2)}</strong> (${Math.max(Math.floor(v.headroomToNextBand * classify.totals.orders), 0)} additional disputes at current volume).</p>`
      : `<p>The store is already in the excessive band; reducing disputes is the only direction.</p>`;

  const segRows = Object.entries(classify.byClass).map(([cls, s]) => [
    CLASS_LABELS[cls] ?? cls,
    String(s.orders),
    String(s.disputes),
    pct(s.disputeRate, 2),
  ]);

  const delta = classify.agentVsHuman;
  const deltaLine = `<p>Agent-side orders dispute at <strong>${pct(delta.agentDisputeRate, 2)}</strong> vs <strong>${pct(delta.humanDisputeRate, 2)}</strong> for human orders (delta ${pct(delta.delta, 2)}, agent n=${delta.agentOrders}).</p>`;

  return section(
    "disputes",
    "Dispute exposure",
    [math, headroom, table(["Segment", "Orders", "Disputes", "Dispute rate"], segRows), deltaLine].join("\n"),
  );
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

export function methodologySection(classify: ClassifyOutput): string {
  return section(
    "methodology",
    "Methodology & caveats",
    `<ul class="method">
<li><strong>Confirmed channel</strong> orders carry a non-web <code>source_name</code>/<code>app_id</code> — this is recorded by Shopify, not inferred.</li>
<li><strong>High-confidence agent</strong> orders match a published agent user-agent, an assistant referrer (chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com), or an assistant utm_source. Strong signals, but referrers can be stripped, so this undercounts.</li>
<li><strong>Heuristic agent</strong> orders show headless-browser markers or originate from datacenter IP ranges (AWS/GCP/Azure). These are signals, not proof — VPN users can appear here. Treat this tier as an upper-bound hint.</li>
<li><strong>Human</strong> is the default for everything else; agents that mimic consumer browsers perfectly are not detectable from order metadata, so the true agent share is likely higher than reported.</li>
<li>The dispute ratio shown is disputes ÷ orders over ${classify.windowDays} days. Visa VAMP is computed monthly on settled VisaNet transactions by your acquirer — use this as a directional proxy, not the official figure.</li>
<li>Automated checks stop at the checkout information page; no purchase is ever completed and no payment fields are ever filled. CAPTCHA presence is recorded, never solved or bypassed.</li>
</ul>`,
  );
}
