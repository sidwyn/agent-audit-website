/**
 * Builds the cohort benchmark + per-store PDFs from a batch-readiness run.
 *
 * Pass 1: load every store's readiness.json, compute the discovery sub-score,
 *         and write cohort-stats.json (the committed benchmark distribution).
 * Pass 2: render one readiness-only report.pdf per store WITH its cohort
 *         percentile, plus a cohort-summary.pdf across all stores.
 *
 * Usage: pnpm exec tsx scripts/build-cohort.mts <cohortDir> [generatedAt]
 */
import { readFileSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadinessReport } from "@agentaudit/audit";
import { AGENT_UA_TOKENS } from "@agentaudit/audit";
import type { CohortStats } from "../src/benchmark.js";
import { escapeHtml, table } from "../src/html.js";
import { htmlToPdf } from "../src/render.js";
import { computeScore, discoverySubscore } from "../src/score.js";
import { composeReport } from "../src/template.js";
import type { StoreMeta } from "../src/types.js";

const cohortDir = path.resolve(process.argv[2] ?? "cohort");
const generatedAt = process.argv[3] ?? "2026-06-12T00:00:00Z";
const FIXTURE_STATS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/cohort-stats.json");
const COHORT_SOURCE = "Top 50 Shopify-powered stores, June 2026";

type Loaded = { slug: string; meta: StoreMeta; readiness: ReadinessReport; discovery: number };

async function load(): Promise<Loaded[]> {
  const entries = await readdir(cohortDir, { withFileTypes: true });
  const out: Loaded[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(cohortDir, e.name);
    try {
      const readiness = JSON.parse(readFileSync(path.join(dir, "readiness.json"), "utf8")) as ReadinessReport;
      const meta = JSON.parse(readFileSync(path.join(dir, "store.json"), "utf8")) as StoreMeta;
      const score = computeScore({ readiness, manualRuns: [] });
      out.push({ slug: e.name, meta, readiness, discovery: discoverySubscore(score.parts) });
    } catch {
      // skip stores that failed to produce a readiness.json
    }
  }
  return out.sort((a, b) => b.discovery - a.discovery);
}

function buildStats(stores: Loaded[]): CohortStats {
  const n = stores.length || 1;
  const frac = (pred: (s: Loaded) => boolean) => stores.filter(pred).length / n;
  const blockedAgentRate: Record<string, number> = {};
  for (const ua of AGENT_UA_TOKENS) {
    blockedAgentRate[ua] = frac((s) => s.readiness.robots.some((r) => r.agent === ua && !r.allowed));
  }
  return {
    generatedAt,
    n: stores.length,
    source: COHORT_SOURCE,
    scores: stores.map((s) => s.discovery),
    checkPassRate: {
      robotsAllAllowed: frac((s) => s.readiness.robots.every((r) => r.allowed)),
      productsJson: frac((s) => s.readiness.feeds.productsJson.pass),
      sitemap: frac((s) => s.readiness.feeds.sitemap.pass),
      llmsTxt: frac((s) => s.readiness.feeds.llmsTxt.pass),
      structuredDataClean: frac((s) => s.readiness.productPages.length > 0 && s.readiness.productPages.every((p) => p.problems.length === 0)),
      reachedCheckout: 0, // transaction layer not probed in the batch
    },
    blockedAgentRate,
  };
}

function summaryHtml(stores: Loaded[], stats: CohortStats): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const sorted = [...stats.scores].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const mean = sorted.length ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
  const blockedSorted = Object.entries(stats.blockedAgentRate).sort(([, a], [, b]) => b - a);

  const checkRows = [
    ["All 13 agent UAs allowed in robots.txt", pct(stats.checkPassRate.robotsAllAllowed)],
    ["products.json catalog reachable", pct(stats.checkPassRate.productsJson)],
    ["sitemap.xml reachable", pct(stats.checkPassRate.sitemap)],
    ["llms.txt published", pct(stats.checkPassRate.llmsTxt)],
    ["All sampled product pages structured-data clean", pct(stats.checkPassRate.structuredDataClean)],
  ];
  const blockRows = blockedSorted.map(([ua, r]) => [`<code>${escapeHtml(ua)}</code>`, pct(r)]);
  const storeRows = stores.map((s, i) => [
    String(i + 1),
    escapeHtml(s.meta.name),
    `<code>${escapeHtml(s.meta.domain)}</code>`,
    String(s.discovery),
    String(s.readiness.robots.filter((r) => !r.allowed).length),
    s.readiness.feeds.llmsTxt.pass ? "yes" : "no",
  ]);

  const css = `body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;color:#0e0f12;font-size:13px;line-height:1.55}h1{font-size:24px;letter-spacing:-.02em}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#4f46e5;border-top:1px solid #e4e4e7;padding-top:14px;margin-top:26px}table{width:100%;border-collapse:collapse;margin:8px 0}th{text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;border-bottom:1px solid #0e0f12;padding:4px 8px 4px 0}td{padding:5px 8px 5px 0;border-bottom:1px solid #efefe9;font-variant-numeric:tabular-nums}.kicker{text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#71717a}.big{font-size:40px;font-weight:700}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>AgentAudit — Cohort Readiness</title><style>${css}</style></head><body>
<p class="kicker">AgentAudit · Cohort Benchmark</p>
<h1>Can AI agents buy from the top Shopify stores?</h1>
<p>Live agent-readiness checks (robots.txt, product feeds, JSON-LD structured data) run against <strong>${stats.n}</strong> well-known Shopify-powered storefronts on ${escapeHtml(generatedAt.slice(0, 10))}. Discovery-readiness sub-score: median <strong>${median}</strong>/100, mean ${mean}/100, range ${sorted[0] ?? 0}–${sorted[sorted.length - 1] ?? 0}.</p>
<h2>How many top stores pass each check</h2>
${table(["Check", "Stores passing"], checkRows)}
<h2>How often each AI agent is blocked by robots.txt</h2>
${table(["Agent user-agent", "Cohort blocking it"], blockRows)}
<h2>Every store, ranked by discovery readiness</h2>
${table(["#", "Store", "Domain", "Discovery /100", "Agents blocked", "llms.txt"], storeRows)}
<p style="color:#71717a;font-size:11px;margin-top:24px">Readiness-only (public-surface) audit: no order data, no checkout probe (to stay gentle on production stores). Methodology: agentaudit.site.</p>
</body></html>`;
}

async function main(): Promise<void> {
  const stores = await load();
  if (stores.length === 0) throw new Error(`no readiness.json found under ${cohortDir}`);
  const stats = buildStats(stores);

  // committed benchmark asset + a copy alongside the cohort
  await writeFile(FIXTURE_STATS, JSON.stringify(stats, null, 2));
  await writeFile(path.join(cohortDir, "cohort-stats.json"), JSON.stringify(stats, null, 2));
  console.log(`cohort-stats: n=${stats.n} median=${[...stats.scores].sort((a, b) => a - b)[Math.floor(stats.scores.length / 2)]}`);

  for (const s of stores) {
    const html = composeReport(
      { meta: s.meta, readiness: s.readiness, manualRuns: [], generatedAt },
      { cohort: stats },
    );
    await htmlToPdf(html, path.join(cohortDir, s.slug, "report.pdf"));
    console.log(`  report ${s.slug} (discovery ${s.discovery})`);
  }

  await htmlToPdf(summaryHtml(stores, stats), path.join(cohortDir, "cohort-summary.pdf"));
  console.log(`wrote cohort-summary.pdf and ${stores.length} per-store reports`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
