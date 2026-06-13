import type { ManualRun, ReadinessReport } from "@agentaudit/audit";
import type { Finding } from "./findings.js";
import type { ScorePart } from "./score.js";
import type { StoreMeta } from "./types.js";
import { escapeHtml, section, table } from "./html.js";

export function scorecard(
  score: { total: number; parts: ScorePart[] },
  meta: StoreMeta,
  generatedAt: string,
  mode: "full" | "readiness-only" = "full",
): string {
  const bars = score.parts
    .map((p) => {
      const widthPct = p.max === 0 ? 0 : Math.round((p.earned / p.max) * 100);
      return `<div class="part"><span class="part-label">${escapeHtml(p.label)}</span><span class="part-track"><span class="part-fill" style="width:${widthPct}%"></span></span><span class="part-num">${p.earned}/${p.max}</span></div>`;
    })
    .join("\n");
  const kicker = mode === "full" ? "AgentAudit · Agent Commerce Audit" : "AgentAudit · Readiness Audit";
  return `<header class="scorecard">
  <div class="scorecard-head">
    <div>
      <p class="kicker">${kicker}</p>
      <h1>${escapeHtml(meta.name)}</h1>
      <p class="meta">${escapeHtml(meta.domain)} · GMV band ${escapeHtml(meta.gmvBand)} · ${escapeHtml(generatedAt.slice(0, 10))}</p>
    </div>
    <div class="score"><span class="score-num">${score.total}</span><span class="score-denom">/ 100</span><span class="score-name">Agent Readiness Score</span></div>
  </div>
  <div class="parts">${bars}</div>
</header>`;
}

export function executiveSummary(findings: Finding[]): string {
  const items = findings
    .map((f) => `<li class="sev-${f.severity}">${escapeHtml(f.sentence)}</li>`)
    .join("\n");
  return section("summary", "Executive summary", `<ul class="findings">${items}</ul>`);
}

export function discoverySection(readiness: ReadinessReport): string {
  const allowed = readiness.robots.filter((r) => r.allowed);
  const blocked = readiness.robots.filter((r) => !r.allowed);
  const robotsHtml = `<p><strong>${allowed.length}/${readiness.robots.length}</strong> agent user-agents allowed by robots.txt.${
    blocked.length > 0
      ? ` Blocked: ${blocked.map((b) => `<code>${escapeHtml(b.agent)}</code> (${escapeHtml(b.matchedRule ?? "no rule")})`).join(", ")}.`
      : ""
  }</p>`;

  const feedRows = [
    ["products.json", readiness.feeds.productsJson],
    ["sitemap.xml", readiness.feeds.sitemap],
    ["llms.txt", readiness.feeds.llmsTxt],
  ].map(([name, check]) => {
    const c = check as ReadinessReport["feeds"]["productsJson"];
    return [
      `<code>${name as string}</code>`,
      c.pass ? `<span class="pass">pass</span>` : `<span class="fail">fail</span>`,
      escapeHtml(c.notes),
    ];
  });

  const pages = readiness.productPages;
  const pageRows = pages.map((p) => [
    `<code>${escapeHtml(new URL(p.url).pathname)}</code>`,
    p.jsonLd.found
      ? ["price", "priceCurrency", "availability", "skuOrGtin", "image"]
          .filter((k) => p.jsonLd[k as keyof typeof p.jsonLd])
          .length.toString() + "/5"
      : "no Product",
    p.problems.length === 0 ? `<span class="pass">clean</span>` : escapeHtml(p.problems.join("; ")),
  ]);

  return section(
    "discovery",
    "Discovery layer",
    [
      robotsHtml,
      table(["Feed", "Status", "Notes"], feedRows),
      pages.length > 0
        ? table(["Product page", "JSON-LD fields", "Problems"], pageRows)
        : "<p>No product pages were sampled.</p>",
    ].join("\n"),
  );
}

export function transactionSection(
  readiness: ReadinessReport,
  manualRuns: ManualRun[],
): string {
  const probe = readiness.checkout;
  const probeStage = probe.reachedCheckout ? "checkout (info page)" : probe.reachedCart ? "cart" : "product page";
  const probeBlockers =
    probe.blockers.length === 0
      ? "—"
      : probe.blockers.map((b) => `${escapeHtml(b.kind.replace(/_/g, " "))} (${escapeHtml(b.stage)})`).join(", ");

  const agentLabel: Record<string, string> = { chatgpt: "ChatGPT", perplexity: "Perplexity", claude: "Claude" };
  const rows = [
    [
      "Automated probe",
      escapeHtml(probeStage) +
        (probe.timeToCheckoutMs !== null ? ` <span class="muted">(${Math.round(probe.timeToCheckoutMs / 1000)}s)</span>` : ""),
      probeBlockers,
    ],
    ...manualRuns.map((r) => [
      escapeHtml(agentLabel[r.agent] ?? r.agent),
      r.outcome === "success"
        ? `<span class="pass">completed</span> <span class="muted">(stopped pre-payment)</span>`
        : escapeHtml(`abandoned at ${r.failure_stage?.replace(/_/g, " ") ?? "unknown"}`),
      escapeHtml(r.notes ?? "—"),
    ]),
  ];

  const jsErrors =
    probe.jsErrors.length > 0
      ? `<p class="muted">JS errors observed: ${escapeHtml(probe.jsErrors.slice(0, 3).join(" · "))}</p>`
      : "";

  return section(
    "transaction",
    "Transaction layer",
    table(["Agent", "Stage reached", "Blocker / notes"], rows) + jsErrors,
  );
}
