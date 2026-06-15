import type { ClassifyOutput } from "@agentaudit/audit";
import type { AgentRow } from "./agentMatrix.js";
import type { Benchmark } from "./benchmark.js";
import { hBarChart, sparkline } from "./charts.js";
import type { Economics } from "./economics.js";
import type { FunnelStage } from "./funnel.js";
import { escapeHtml, money, pct, section, table } from "./html.js";
import type { Snippet } from "./remediation.js";

function moneyRange(low: number, high: number): string {
  return low === high ? money(low) : `${money(low)}–${money(high)}`;
}

function assumptionBox(lines: string[]): string {
  return `<div class="assume"><span class="assume-h">Assumptions</span><ul>${lines
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join("")}</ul></div>`;
}

export function moneySection(econ: Economics): string {
  const tiles = [
    `<div class="tile"><span class="tile-label">Agent-attributed revenue (annualized)</span><span class="tile-num">${moneyRange(econ.capturedAgentAnnualLow, econ.capturedAgentAnnualHigh)}</span><span class="tile-sub">measured: ${money(econ.capturedAgentWindowLow)}–${money(econ.capturedAgentWindowHigh)} over ${econ.windowDays}d</span></div>`,
    `<div class="tile"><span class="tile-label">Dispute handling cost (annualized)</span><span class="tile-num">${moneyRange(econ.disputeFeeAnnualLow, econ.disputeFeeAnnualHigh)}</span><span class="tile-sub">+ ${money(econ.disputedAnnual)} disputed order value</span></div>`,
  ];
  if (econ.hasForwardRisk) {
    tiles.push(
      `<div class="tile tile-risk"><span class="tile-label">Forward exposure (scenario)</span><span class="tile-num">${moneyRange(econ.forwardAtRiskAnnualLow, econ.forwardAtRiskAnnualHigh)}/yr</span><span class="tile-sub">if the checkout blockers below persist as agent traffic grows</span></div>`,
    );
  }
  return section(
    "money",
    "What agent commerce is worth to you",
    `<div class="tiles">${tiles.join("")}</div>\n${assumptionBox(econ.assumptions)}`,
  );
}

const CELL_LABEL: Record<string, string> = { yes: "yes", no: "NO", partial: "partial", unknown: "—" };

export function agentMatrixSection(rows: AgentRow[]): string {
  const cell = (v: string) => `<span class="cell cell-${v}">${CELL_LABEL[v] ?? v}</span>`;
  const body = rows.map((r) => [
    escapeHtml(r.brand),
    cell(r.discover),
    cell(r.readProduct),
    cell(r.reachCart),
    cell(r.reachCheckout),
    escapeHtml(r.manualOutcome),
  ]);
  return section(
    "agents",
    "Can each agent buy from you?",
    table(["Agent", "Discover", "Read product", "Reach cart", "Reach checkout", "Live outcome"], body, "matrix"),
  );
}

export function trajectorySection(classify: ClassifyOutput): string {
  const trend = classify.monthlyTrend;
  if (trend.length < 2) {
    return section(
      "trajectory",
      "Agent-share trajectory",
      `<p class="muted">Not enough monthly history in this window to plot a trend (${trend.length} month${trend.length === 1 ? "" : "s"}).</p>`,
    );
  }
  const first = trend[0]!;
  const last = trend[trend.length - 1]!;
  const spark = sparkline(trend.map((m) => ({ label: m.month, value: m.agentOrderShare })));
  const rows = trend.map((m) => [
    m.month,
    String(m.orders),
    `${m.agentOrders} · ${pct(m.agentOrderShare)}`,
    pct(m.agentGmvShare),
  ]);
  return section(
    "trajectory",
    "Agent-share trajectory",
    `<p>Agent order share moved from <strong>${pct(first.agentOrderShare)}</strong> (${first.month}) to <strong>${pct(last.agentOrderShare)}</strong> (${last.month}).</p>
${spark}
${table(["Month", "Orders", "Agent orders", "Agent GMV share"], rows)}
<p class="muted small">A 90-day window is a short baseline; treat the slope as directional. Months with low order counts are noisy.</p>`,
  );
}

export function funnelSection(funnel: FunnelStage[], top: FunnelStage | null): string {
  const active = funnel.filter((f) => f.failures > 0);
  if (active.length === 0) {
    return section("funnel", "Where agents drop off", "<p>No agent drop-off signals detected across discovery, cart, or checkout.</p>");
  }
  const bars = active.map((f) => ({ label: f.label, value: f.failures, display: String(f.failures) }));
  const detail = active
    .filter((f) => f.detail)
    .map((f) => `<li><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.detail)}</li>`)
    .join("");
  const lead = top
    ? `<p>The largest cluster of failures is at <strong>${escapeHtml(top.label)}</strong> — fix #1 below targets this stage.</p>`
    : "";
  return section("funnel", "Where agents drop off", `${lead}${hBarChart(bars)}<ul class="small">${detail}</ul>`);
}

export function remediationSection(snippets: Snippet[]): string {
  if (snippets.length === 0) return "";
  const blocks = snippets
    .map(
      (s) =>
        `<h3>${escapeHtml(s.title)}</h3><p class="muted small">${escapeHtml(s.note)}</p><pre class="snippet"><code>${escapeHtml(s.body)}</code></pre>`,
    )
    .join("\n");
  return section("remediation", "Copy-paste fixes", blocks);
}

export function benchmarkSection(b: Benchmark | null): string {
  if (!b) return "";
  const rank = b.percentile >= 50 ? "top" : "bottom";
  const pctFromTop = b.percentile >= 50 ? 100 - b.percentile : b.percentile;
  return section(
    "benchmark",
    "How you compare",
    `<p>Your <strong>discovery sub-score</strong> of <strong>${b.score}</strong>/100 — just the public-surface signals every store exposes (robots, structured data, feeds, llms.txt), the slice we can compare apples-to-apples across stores — places you in the <strong>${rank} ${Math.max(pctFromTop, 1)}%</strong> of a cohort of ${b.n} stores (median ${b.median}). ${b.storesBetter} score higher.</p>
<p class="muted small">This is a sub-score, not your overall Agent Readiness Score above (which also credits the live transaction layer). Cohort: ${escapeHtml(b.source)} — large, well-known stores, so a low rank here is a conservative read; the typical store scores lower. Discovery-only; transaction-layer and dispute benchmarks are not cohort-derived.</p>`,
  );
}
