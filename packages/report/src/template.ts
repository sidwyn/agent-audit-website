import { buildAgentMatrix } from "./agentMatrix.js";
import { benchmarkScore, type CohortStats } from "./benchmark.js";
import { estimateEconomics } from "./economics.js";
import { draftFindings } from "./findings.js";
import { buildFixList } from "./fixlist.js";
import { buildFunnel, topFailingStage } from "./funnel.js";
import { buildRemediation } from "./remediation.js";
import { computeScore, discoverySubscore, type ScorePart } from "./score.js";
import {
  classificationSection,
  disputeSection,
  fixListSection,
  howWeScoreSection,
} from "./sections-analysis.js";
import {
  agentMatrixSection,
  benchmarkSection,
  funnelSection,
  moneySection,
  remediationSection,
  trajectorySection,
} from "./sections-money.js";
import { discoverySection, executiveSummary, scorecard, transactionSection } from "./sections.js";
import { escapeHtml } from "./html.js";
import { agentShareBand } from "./shareBands.js";
import type { ReportData } from "./types.js";
import { monthlyVamp } from "./vampMonthly.js";

const CSS = `
:root { --bg:#0e1117; --panel:#161d29; --ink:#e6e9ee; --muted:#8b96a8; --accent:#2dd4bf; --accent2:#5eead4; --warn:#f5c451; --critical:#fb7185; --pass:#34d399; --rule:#222b39; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; color: var(--ink); background: var(--bg); margin: 0 auto; max-width: 720px; padding: 40px 32px 44px; font-size: 13px; line-height: 1.55; }
h1 { font-size: 27px; margin: 2px 0 4px; letter-spacing: -0.02em; color: #fff; }
h2 { font-size: 13px; margin: 30px 0 12px; padding-top: 16px; border-top: 1px solid var(--rule); text-transform: uppercase; letter-spacing: 0.13em; color: var(--accent); }
h3 { font-size: 11px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); }
p { margin: 8px 0; }
a { color: var(--accent2); }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; background: #1b2330; color: #cbd5e1; padding: 1px 5px; border-radius: 3px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th { font-family: ui-monospace, "SF Mono", Menlo, monospace; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding: 5px 10px 7px 0; border-bottom: 1px solid var(--accent); }
td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
td, .score-num, .part-num, .vamp-math, .tile-num { font-variant-numeric: tabular-nums; }
.pass { color: var(--pass); font-weight: 600; } .fail { color: var(--critical); font-weight: 600; }
.muted { color: var(--muted); } .small { font-size: 11px; }
.badge { font-family: ui-monospace, Menlo, monospace; background: rgba(45,212,191,0.14); color: var(--accent2); border:1px solid rgba(45,212,191,0.4); border-radius: 4px; padding: 1px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
.tag { font-family: ui-monospace, Menlo, monospace; background: #1b2330; color: var(--muted); border:1px solid var(--rule); border-radius: 4px; padding: 0 5px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
.scorecard { background: linear-gradient(180deg,#141c28,#10161f); border:1px solid var(--rule); color: #fff; padding: 0; border-radius: 10px; margin-top: 20px; overflow: hidden; }
.scorecard-body { padding: 22px; }
.shot { display: block; width: 100%; height: 132px; object-fit: cover; object-position: top center; border-bottom: 1px solid var(--rule); }
.favicon { width: 24px; height: 24px; border-radius: 6px; vertical-align: -5px; margin-right: 10px; background: #fff; }
.scorecard-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.kicker { font-family: ui-monospace, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.16em; font-size: 10px; color: var(--accent); margin: 0; }
.scorecard .meta { color: var(--muted); margin: 0; font-size: 12px; }
.score { text-align: right; white-space: nowrap; }
.score-num { font-size: 54px; font-weight: 800; line-height: 1; color: #fff; }
.score-denom { font-size: 16px; color: var(--muted); margin-left: 4px; }
.score-name { font-family: ui-monospace, Menlo, monospace; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-top: 6px; }
.parts { margin-top: 18px; display: grid; gap: 7px; }
.part { display: grid; grid-template-columns: 230px 1fr 52px; gap: 10px; align-items: center; font-size: 10px; }
.part-label { font-family: ui-monospace, Menlo, monospace; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.part-track { background: #232c3a; border-radius: 4px; height: 7px; overflow: hidden; display: block; } .part-fill { background: var(--accent); height: 100%; display: block; } .part-num { font-family: ui-monospace, Menlo, monospace; text-align: right; color: #cbd5e1; }
.score-note { color: var(--muted); font-size: 10px; margin: 14px 0 0; }
.findings { list-style: none; padding: 0; margin: 10px 0; } .findings li { margin: 0 0 11px; padding: 1px 0 1px 14px; border-left: 3px solid var(--muted); }
.findings .sev-critical { border-color: var(--critical); } .findings .sev-warning { border-color: var(--warn); } .findings .sev-info { border-color: var(--accent); }
.sev-tag { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.08em; margin-right: 7px; font-weight: 700; }
.sev-critical .sev-tag { color: var(--critical); } .sev-warning .sev-tag { color: var(--warn); } .sev-info .sev-tag { color: var(--accent); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 10px 0; }
.tile { border: 1px solid var(--rule); border-radius: 8px; padding: 14px; background: var(--panel); } .tile-risk { border-color: var(--critical); }
.tile-label { font-family: ui-monospace, Menlo, monospace; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); }
.tile-num { display: block; font-size: 24px; font-weight: 700; margin: 5px 0; color: #fff; } .tile-sub { font-size: 11px; color: var(--muted); }
.assume { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 11px; }
.assume-h { font-family: ui-monospace, Menlo, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); font-weight: 700; }
.assume ul { margin: 6px 0 0; padding-left: 16px; } .assume li { margin: 3px 0; color: #aab4c2; }
.matrix .cell { font-weight: 700; } .cell-yes { color: var(--pass); } .cell-no { color: var(--critical); } .cell-partial { color: var(--warn); } .cell-unknown { color: var(--muted); }
.band-pill { font-family: ui-monospace, Menlo, monospace; font-size: 9px; padding: 1px 7px; border-radius: 10px; font-weight: 700; } .band-ok { background: rgba(52,211,153,0.16); color: var(--pass); } .band-above_standard { background: rgba(245,196,81,0.16); color: var(--warn); } .band-excessive { background: rgba(251,113,133,0.16); color: var(--critical); }
.vamp-math { font-size: 14px; } .band-line { background: var(--panel); border-left: 3px solid var(--accent); padding: 7px 12px; border-radius: 0 6px 6px 0; } .counterfactual { border-left: 3px solid var(--warn); padding: 7px 12px; background: rgba(245,196,81,0.07); border-radius: 0 6px 6px 0; }
.snippet { background: #0a0e14; color: #cbd5e1; border: 1px solid var(--rule); border-radius: 8px; padding: 12px; overflow-x: auto; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.snippet code { background: none; color: inherit; padding: 0; }
.method li { margin: 7px 0; }
.shots { display: grid; gap: 12px; margin: 10px 0; }
.shotlabel { font-family: ui-monospace, Menlo, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); display: block; margin-bottom: 5px; }
.shotimgs { display: flex; gap: 7px; flex-wrap: wrap; }
.thumb { height: 104px; width: auto; border: 1px solid var(--rule); border-radius: 6px; background: #fff; }
footer { font-family: ui-monospace, Menlo, monospace; margin: 34px 0 6px; color: var(--muted); font-size: 10px; border-top: 1px solid var(--rule); padding-top: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
.footnote { font-size: 10px; }
@media print { html, body { background: var(--bg) !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .tile, .scorecard, .assume, tr { break-inside: avoid; } h2, h3 { break-after: avoid; } .snippet { white-space: pre-wrap; } }
`;

// Rescale a subset of score parts so their maxes sum to 100 and their earned
// values sum to `target` — used for the discovery-only scorecard so its bars
// visibly add up to the rescaled /100 headline. The last part absorbs rounding
// residual so the sums are exact.
function rescaleToHundred(parts: ScorePart[], target: number): ScorePart[] {
  const totalMax = parts.reduce((s, p) => s + p.max, 0) || 1;
  const scale = 100 / totalMax;
  let maxAcc = 0;
  let earnedAcc = 0;
  return parts.map((p, i) => {
    const last = i === parts.length - 1;
    const max = last ? 100 - maxAcc : Math.round(p.max * scale);
    const earned = last ? Math.max(0, target - earnedAcc) : Math.round(p.earned * scale);
    maxAcc += max;
    earnedAcc += earned;
    return { ...p, earned: Math.min(earned, max), max };
  });
}

function footer(contact: string, generatedAt: string): string {
  const who = contact && contact !== "—" ? `prepared for ${escapeHtml(contact)} · ` : "";
  return `<footer>AgentAudit · ${who}${escapeHtml(generatedAt.slice(0, 10))} · agentaudit.site</footer>`;
}

export function composeReport(data: ReportData, opts: { cohort?: CohortStats | null } = {}): string {
  const score = computeScore({ readiness: data.readiness, manualRuns: data.manualRuns });
  const findings = draftFindings(data);
  const fixes = buildFixList(data);
  const funnel = buildFunnel(data.readiness, data.manualRuns);
  const matrix = buildAgentMatrix(data.readiness, data.manualRuns);
  const remediation = buildRemediation(data.readiness, data.meta);
  const disc = discoverySubscore(score.parts);
  const benchmark = opts.cohort ? benchmarkScore(disc, opts.cohort) : null;
  const probeRan = data.readiness.checkout.productUrl !== null;
  const discoveryKeys = ["robots", "structuredData", "feeds", "llmsTxt"];
  // Show the full 7-part score (discovery + transaction, summing to 100) whenever
  // there's any transaction evidence — a probe run or a live agent run. Only a
  // pure prospect audit (no order data, no probe, no live runs) falls back to a
  // discovery-only score, rescaled to 100 so its bars still sum to the headline.
  const hasTransaction = probeRan || data.manualRuns.length > 0;
  const showFullScore = Boolean(data.classify) || hasTransaction;

  const blocks: string[] = [
    showFullScore
      ? scorecard({
          headline: score.total,
          scoreName: "Agent Readiness Score",
          kicker: data.classify ? "AgentAudit · Agent Commerce Audit" : "AgentAudit · Agent Readiness Audit",
          parts: score.parts,
          meta: data.meta,
          generatedAt: data.generatedAt,
          note: data.classify
            ? undefined
            : "Scored across discovery (public-surface) and the live transaction layer. Order classification and dispute exposure require merchant data and are not included.",
          screenshot: data.branding?.screenshot,
          logo: data.branding?.logo,
        })
      : scorecard({
          headline: disc,
          scoreName: "Agent Readiness Score",
          kicker: "AgentAudit · Readiness Audit",
          parts: rescaleToHundred(score.parts.filter((p) => discoveryKeys.includes(p.key)), disc),
          meta: data.meta,
          generatedAt: data.generatedAt,
          note: "Readiness-only audit: discovery (public-surface) signals, rescaled to 100. The transaction layer (cart, checkout, live agents) was not tested.",
          screenshot: data.branding?.screenshot,
          logo: data.branding?.logo,
        }),
    executiveSummary(findings),
    benchmarkSection(benchmark),
  ];

  if (data.classify) {
    const econ = estimateEconomics({ classify: data.classify, readiness: data.readiness, manualRuns: data.manualRuns });
    const mv = monthlyVamp(data.classify.monthlyTrend, data.classify.vamp.config);
    blocks.push(
      moneySection(econ),
      disputeSection(data.classify, mv, econ),
      agentMatrixSection(matrix),
      trajectorySection(data.classify),
      classificationSection(data.classify, agentShareBand(data.classify)),
    );
  } else {
    blocks.push(agentMatrixSection(matrix));
  }

  blocks.push(discoverySection(data.readiness));
  if (probeRan || data.manualRuns.length > 0) {
    blocks.push(transactionSection(data.readiness, data.manualRuns, data.runScreenshots ?? {}));
  }
  blocks.push(
    funnelSection(funnel, topFailingStage(funnel)),
    fixListSection(fixes),
    remediationSection(remediation),
    howWeScoreSection(Boolean(data.classify), data.classify?.windowDays ?? 90),
    footer(data.meta.contact, data.generatedAt),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AgentAudit — ${escapeHtml(data.meta.name)}</title>
<style>${CSS}</style>
</head>
<body>
${blocks.filter(Boolean).join("\n")}
</body>
</html>`;
}
