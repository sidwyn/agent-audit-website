import { buildAgentMatrix } from "./agentMatrix.js";
import { benchmarkScore, type CohortStats } from "./benchmark.js";
import { estimateEconomics } from "./economics.js";
import { draftFindings } from "./findings.js";
import { buildFixList } from "./fixlist.js";
import { buildFunnel, topFailingStage } from "./funnel.js";
import { buildRemediation } from "./remediation.js";
import { computeScore } from "./score.js";
import {
  classificationSection,
  disputeSection,
  fixListSection,
  methodologySection,
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
import { agentShareBand } from "./shareBands.js";
import type { ReportData } from "./types.js";
import { monthlyVamp } from "./vampMonthly.js";

const CSS = `
:root { --ink:#0e0f12; --paper:#ffffff; --muted:#71717a; --accent:#312e81; --accent2:#4f46e5; --pass:#15803d; --warn:#b45309; --fail:#b91c1c; --rule:#e4e4e7; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; color: var(--ink); background: var(--paper); margin: 0 auto; max-width: 720px; font-size: 13px; line-height: 1.55; }
h1 { font-size: 24px; margin: 2px 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 14px; margin: 26px 0 10px; padding-top: 14px; border-top: 1px solid var(--rule); text-transform: uppercase; letter-spacing: 0.08em; }
h3 { font-size: 13px; margin: 14px 0 6px; }
p { margin: 8px 0; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 4px 8px 4px 0; border-bottom: 1px solid var(--ink); }
td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
td, .score-num, .part-num, .vamp-math, .tile-num { font-variant-numeric: tabular-nums; }
.pass { color: var(--pass); font-weight: 600; } .fail { color: var(--fail); font-weight: 600; }
.muted { color: var(--muted); } .small { font-size: 11px; }
.badge { background: var(--accent); color: #fff; border-radius: 3px; padding: 0 5px; font-size: 10px; text-transform: uppercase; }
.tag { background: #f4f4f5; color: var(--muted); border:1px solid var(--rule); border-radius: 3px; padding: 0 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
.scorecard { background: var(--ink); color: #fff; padding: 24px; border-radius: 8px; margin-top: 24px; }
.scorecard-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.kicker { text-transform: uppercase; letter-spacing: 0.14em; font-size: 10px; color: #a1a1aa; margin: 0; }
.scorecard .meta { color: #a1a1aa; margin: 0; font-size: 12px; }
.score { text-align: right; white-space: nowrap; }
.score-num { font-size: 52px; font-weight: 700; line-height: 1; }
.score-denom { font-size: 16px; color: #a1a1aa; margin-left: 4px; }
.score-name { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; margin-top: 4px; }
.parts { margin-top: 18px; display: grid; gap: 5px; }
.part { display: grid; grid-template-columns: 220px 1fr 48px; gap: 10px; align-items: center; font-size: 11px; }
.part-label { color: #d4d4d8; } .part-track { background: #3f3f46; border-radius: 3px; height: 7px; overflow: hidden; display: block; } .part-fill { background: #a5b4fc; height: 100%; display: block; } .part-num { text-align: right; color: #d4d4d8; }
.findings { padding-left: 18px; } .findings li { margin: 5px 0; }
.findings .sev-critical::marker { color: var(--fail); } .findings .sev-warning::marker { color: var(--warn); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 8px 0; }
.tile { border: 1px solid var(--rule); border-radius: 8px; padding: 14px; } .tile-risk { border-color: var(--fail); }
.tile-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.tile-num { display: block; font-size: 24px; font-weight: 700; margin: 4px 0; } .tile-sub { font-size: 11px; color: var(--muted); }
.assume { background: #faf9f5; border: 1px solid var(--rule); border-radius: 6px; padding: 10px 14px; margin: 10px 0; font-size: 11px; }
.assume-h { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; }
.assume ul { margin: 6px 0 0; padding-left: 16px; } .assume li { margin: 3px 0; color: #3f3f46; }
.matrix .cell { font-weight: 600; } .cell-yes { color: var(--pass); } .cell-no { color: var(--fail); } .cell-partial { color: var(--warn); } .cell-unknown { color: var(--muted); }
.band-pill { font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 600; } .band-ok { background: #dcfce7; color: #15803d; } .band-above_standard { background: #fef3c7; color: #b45309; } .band-excessive { background: #fee2e2; color: #b91c1c; }
.vamp-math { font-size: 14px; } .band-line { background: #faf9f5; border-left: 3px solid var(--accent2); padding: 6px 10px; } .counterfactual { border-left: 3px solid var(--warn); padding: 6px 10px; background: #fffbeb; }
.snippet { background: #0e0f12; color: #e4e4e7; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.snippet code { background: none; color: inherit; padding: 0; }
.method li { margin: 6px 0; }
footer { margin: 32px 0 24px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--rule); padding-top: 10px; }
@media print { body { max-width: none; } .scorecard, .band-pill, .cell-yes, .cell-no, .cell-partial { -webkit-print-color-adjust: exact; print-color-adjust: exact; } section { break-inside: avoid-page; } .snippet { white-space: pre-wrap; } }
`;

export function composeReport(data: ReportData, opts: { cohort?: CohortStats | null } = {}): string {
  const score = computeScore({ readiness: data.readiness, manualRuns: data.manualRuns });
  const findings = draftFindings(data);
  const fixes = buildFixList(data);
  const funnel = buildFunnel(data.readiness, data.manualRuns);
  const matrix = buildAgentMatrix(data.readiness, data.manualRuns);
  const remediation = buildRemediation(data.readiness, data.meta);
  const benchmark = opts.cohort ? benchmarkScore(score.total, opts.cohort) : null;

  const blocks: string[] = [
    scorecard(score, data.meta, data.generatedAt, data.classify ? "full" : "readiness-only"),
    executiveSummary(findings),
    benchmarkSection(benchmark, data.readiness, score.total),
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

  blocks.push(
    discoverySection(data.readiness),
    transactionSection(data.readiness, data.manualRuns),
    funnelSection(funnel, topFailingStage(funnel)),
    fixListSection(fixes),
    remediationSection(remediation),
    methodologySection(Boolean(data.classify), data.classify?.windowDays ?? 90),
    `<footer>AgentAudit · prepared for ${data.meta.contact} · ${data.generatedAt.slice(0, 10)} · agentaudit.site</footer>`,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AgentAudit — ${data.meta.name}</title>
<style>${CSS}</style>
</head>
<body>
${blocks.filter(Boolean).join("\n")}
</body>
</html>`;
}
