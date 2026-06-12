import { draftFindings } from "./findings.js";
import { buildFixList } from "./fixlist.js";
import { computeScore } from "./score.js";
import {
  classificationSection,
  disputeSection,
  fixListSection,
  methodologySection,
} from "./sections-analysis.js";
import { discoverySection, executiveSummary, scorecard, transactionSection } from "./sections.js";
import type { ReportData } from "./types.js";

const CSS = `
:root { --ink:#0e0f12; --paper:#ffffff; --muted:#71717a; --accent:#312e81; --pass:#15803d; --fail:#b91c1c; --rule:#e4e4e7; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; color: var(--ink); background: var(--paper); margin: 0 auto; max-width: 720px; font-size: 13px; line-height: 1.55; }
h1 { font-size: 24px; margin: 2px 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 15px; margin: 28px 0 10px; padding-top: 14px; border-top: 1px solid var(--rule); text-transform: uppercase; letter-spacing: 0.08em; }
h3 { font-size: 13px; margin: 14px 0 6px; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 4px 8px 4px 0; border-bottom: 1px solid var(--ink); }
td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
td, .score-num, .part-num, .vamp-math { font-variant-numeric: tabular-nums; }
.pass { color: var(--pass); font-weight: 600; } .fail { color: var(--fail); font-weight: 600; }
.muted { color: var(--muted); }
.badge { background: var(--accent); color: #fff; border-radius: 3px; padding: 0 5px; font-size: 10px; text-transform: uppercase; }
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
.part-label { color: #d4d4d8; }
.part-track { background: #3f3f46; border-radius: 3px; height: 7px; overflow: hidden; display: block; }
.part-fill { background: #a5b4fc; height: 100%; display: block; }
.part-num { text-align: right; color: #d4d4d8; }
.findings { padding-left: 18px; } .findings li { margin: 5px 0; }
.findings .sev-critical::marker { color: var(--fail); } .findings .sev-warning::marker { color: #b45309; }
.vamp-math { font-size: 14px; }
.method li { margin: 6px 0; }
footer { margin: 32px 0 24px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--rule); padding-top: 10px; }
@media print { body { max-width: none; } .scorecard { -webkit-print-color-adjust: exact; print-color-adjust: exact; } section { break-inside: avoid-page; } }
`;

export function composeReport(data: ReportData): string {
  const score = computeScore({ readiness: data.readiness, manualRuns: data.manualRuns });
  const findings = draftFindings(data);
  const fixes = buildFixList(data);

  const body = [
    scorecard(score, data.meta, data.generatedAt),
    executiveSummary(findings),
    discoverySection(data.readiness),
    transactionSection(data.readiness, data.manualRuns),
    classificationSection(data.classify),
    disputeSection(data.classify),
    fixListSection(fixes),
    methodologySection(data.classify),
    `<footer>AgentAudit · prepared for ${data.meta.contact} · ${data.generatedAt.slice(0, 10)} · agentaudit.site</footer>`,
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AgentAudit — ${data.meta.name}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
