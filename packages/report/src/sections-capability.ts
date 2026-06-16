import type { ManualRun } from "@agentaudit/audit";
import { CAPABILITY_CHECKS, OBSTACLE_CHECKS, SECTION_LABELS } from "@agentaudit/audit";
import { escapeHtml, section, table } from "./html.js";

const AGENT_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  gemini: "Gemini",
};

const STATUS: Record<string, { glyph: string; cls: string }> = {
  pass: { glyph: "✓ pass", cls: "st-pass" },
  fail: { glyph: "✕ fail", cls: "st-fail" },
  partial: { glyph: "◐ partial", cls: "st-partial" },
  blocked: { glyph: "⛔ blocked", cls: "st-blocked" },
  na: { glyph: "— n/a", cls: "st-na" },
};

function statusCell(status?: string): string {
  if (!status) return `<span class="st-none">·</span>`;
  const s = STATUS[status] ?? STATUS.na!;
  return `<span class="${s.cls}">${s.glyph}</span>`;
}

function runMeta(r: ManualRun): string {
  return [
    r.model,
    r.outcome === "success"
      ? "completed (stopped pre-payment)"
      : `abandoned at ${r.failure_stage?.replace(/_/g, " ") ?? "unknown"}`,
    r.secondsToCart != null ? `${r.secondsToCart}s to cart` : "",
    r.blockerCode && r.blockerCode !== "none" ? `blocker: ${r.blockerCode.replace(/_/g, " ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// One detailed capability table per agent: every funnel action checked off, plus
// the obstacles it hit. Only renders for runs that carry checklist/obstacle data.
export function agentCapabilitySection(manualRuns: ManualRun[]): string {
  const withDetail = manualRuns.filter((r) => (r.checks?.length ?? 0) > 0 || (r.obstacles?.length ?? 0) > 0);
  if (withDetail.length === 0) return "";

  const blocks = withDetail.map((r) => {
    const byKey = new Map((r.checks ?? []).map((c) => [`${c.section}.${c.key}`, c]));
    let lastSection = "";
    const rows = CAPABILITY_CHECKS.map((c) => {
      const res = byKey.get(`${c.section}.${c.key}`);
      const sectionCell = c.section !== lastSection ? `<strong>${escapeHtml(SECTION_LABELS[c.section])}</strong>` : "";
      lastSection = c.section;
      return [sectionCell, escapeHtml(c.label), statusCell(res?.status), escapeHtml(res?.note ?? "")];
    });
    const checkTable = table(["Section", "Action checked", "Result", "Note"], rows, "capability");

    const hits = new Map((r.obstacles ?? []).map((o) => [o.key, o]));
    const obsRows = OBSTACLE_CHECKS.map((o) => {
      const hit = hits.get(o.key);
      return [
        escapeHtml(o.label),
        hit ? `<span class="st-fail">hit</span>` : `<span class="st-pass">none</span>`,
        escapeHtml(hit?.note ?? ""),
      ];
    });
    const obsTable = table(["Obstacle", "Hit?", "Note"], obsRows, "capability");

    const label = AGENT_LABEL[r.agent] ?? r.agent;
    const meta = runMeta(r);
    return `<h3>${escapeHtml(label)}${meta ? ` <span class="muted">— ${escapeHtml(meta)}</span>` : ""}</h3>
${checkTable}
<p class="obs-h">Obstacles encountered</p>
${obsTable}`;
  });

  return section(
    "capability",
    "Per-agent capability detail",
    `<p class="muted small">Every funnel action, checked off per agent. ✓ pass · ◐ partial (worked but clunky/uncertain) · ✕ fail · ⛔ blocked · — n/a · · not reported.</p>\n${blocks.join("\n")}`,
  );
}
