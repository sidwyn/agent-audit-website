# AgentAudit — Build Status

_Last updated: 2026-06-12. Paste-able handoff for any coding agent (Codex etc.)._

## What this is

A $99 productized audit for Shopify merchants ("Agent Commerce Audit"), sold at
agentaudit.site. Two questions: (1) can AI shopping agents (ChatGPT, Perplexity,
Claude) buy from the store, (2) what share of the last 90 days of orders were
agent-placed and how do they perform on disputes (Visa VAMP exposure).
Deliverable per customer: scored PDF report + readout call. Full spec: PLAN.md.
Runbook + merchant token guide: README.md.

## State: COMPLETE + deployed; report v2 + 250 live reports generated

pnpm monorepo, TypeScript strict, Node 20, branch `feat/agentaudit-v1`.
132 unit tests (audit 75, report 47, site 10) + 7 Playwright E2E, all green.
`pnpm typecheck && pnpm test && pnpm lint` clean at root.

**Report v2 (money-led).** The report now leads with dollars and differentiation
(see `## Report v2` below): revenue-at-risk + dispute-cost economics with inline
assumption boxes, monthly Visa VAMP with minimum-volume suppression (no more
blended 7.5% headline), a per-agent buyability matrix (ChatGPT/Perplexity/Claude
live-tested, others marked inferred), confidence-banded agent share, an
agent-share trajectory sparkline, refund-rate-by-class, a failure-stage funnel,
copy-paste robots/JSON-LD/llms.txt remediation, and a cohort percentile
benchmark. A `readiness-only` mode renders the discovery half (Discovery
Readiness Score) for stores with no order data, without faking transaction
points. Demo data is a seeded, realistic ~5k-order generator so the sample PDF
shows a believable sub-1% dispute regime.

| Piece | Where | Status |
|---|---|---|
| `audit readiness <url>` | packages/audit | done — robots.txt per 13 agent UAs, products.json/sitemap/llms.txt, JSON-LD/OG/canonical on ≤10 product pages (1 req/s), Playwright add-to-cart→checkout probe (hard stop at checkout info page, CAPTCHA detect-only), screenshots → artifacts/, output → data/<store>/readiness.json |
| `audit classify` | packages/audit | done — Shopify Admin REST 2026-01 (custom-app token via env-var NAME, pagination + 429 retry) or CSV fallback; 4 tiers: confirmed_channel → high_confidence_agent (UA/referrer/utm) → heuristic_agent (headless UA, datacenter CIDR — vendored AWS 10.5k + GCP 976 + Azure seed) → human; dispute join, GMV share, agent-vs-human delta, VAMP bands (0.5%/1.5% defaults, flag-configurable) |
| `audit manual` | packages/audit | done — zod-validated YAML of hand-run agent sessions (agent/task/steps/outcome/failure_stage/screenshots) merged into report data |
| Report | packages/report | done — score 0–100 (weights: discovery 40 = robots 10 + structured data 15 + feeds 10 + llms.txt 5; transaction 60 = cart 20 + checkout 20 + manual 20), auto-drafted findings, impact÷effort fix list, inline SVG charts, VAMP math, honest methodology section; HTML → PDF via Playwright. `pnpm demo` → sample-report.pdf from fixtures, zero credentials |
| Landing page | apps/site | done — Next.js 15 static export; copy rendered VERBATIM from agent-audit-marketing.md (custom ~100-line md parser, unit-tested); CTA → STRIPE_PAYMENT_LINK env at build time, email capture → FORM_ENDPOINT when unset (currently unset → email form, action="#" until FORM_ENDPOINT set); /sample-report.pdf linked from hero (prebuild copies repo-root pdf); privacy counter stub (no-op unless NEXT_PUBLIC_COUNTER_ENDPOINT) |
| Deploy | Vercel | LIVE at https://agentaudit-two.vercel.app (project `sidwyn-proj/agentaudit`, static out/ deploy). Domain agentaudit.site attached to the project but **DNS pending**: add `A @ 76.76.21.21` at Hover (or move nameservers to Vercel) |

## Report v2 modules (packages/report/src)

- `economics.ts` — captured agent revenue (floor/ceiling, annualized), dispute-cost band, forward at-risk SCENARIO (only when a transaction path failed), all with `assumptions[]` rendered inline. Honesty: bands not point estimates, forward ≠ already-captured.
- `vampMonthly.ts` — per-month dispute ratio + band, suppressed under `minOrders` (default 200) so a low-volume month can't render 50%; picks worst *qualifying* month.
- `agentMatrix.ts` — 13 UAs → 8 brands; ChatGPT/Perplexity/Claude can be live-tested, others marked `inferred`.
- `shareBands.ts` (floor/ceiling), `funnel.ts` (where agents drop off), `remediation.ts` (copy-paste fixes), `benchmark.ts` (percentile vs cohort, discovery sub-score), `charts.ts` (hBarChart + sparkline).
- `score.ts` `discoverySubscore()` — 0-100 over the 4 discovery parts; used for the cross-store benchmark so readiness-only stores compare apples-to-apples.
- audit `summary.ts` now also emits: per-class `aov`/`refundRate`, `monthlyTrend` (with disputes), `disputeDollars` (agent vs human, coverage).

## Reports & cohorts (deliverables in repo)

Three folders, each: `<domain>/report.pdf` + `readiness.json` + `store.json`, plus `cohort-summary.pdf`, `cohort-stats.json`, `README.md`, `index.json`, `stores.json`.

- `cohort-2026-06/` — **50 top Shopify stores** audited live (readiness-only). The benchmark cohort: `cohort-stats.json` is copied to `packages/report/fixtures/cohort-stats.json` so every report cites it. Finding: 0/50 block agents, 86% serve real llms.txt, but only 34% have clean Product structured data.
- `cohort-leads-2026-06/` — **100 enriched-leads** (`docs/marketing/agent-audit-enriched-leads.csv`), each benchmarked vs the top-50. 76/100 Shopify; 25% structured-data clean.
- `cohort-next100-2026-06/` — **100 next-100 leads** (`docs/marketing/agent-audit-next-100-high-quality-leads.csv`), same pipeline.

Pipeline to (re)generate any cohort:
```bash
# 1. CSV -> stores list (columns: store, category, domain)
pnpm --filter @agentaudit/audit exec tsx scripts/leads-to-stores.ts <leads.csv> <dir>/stores.json
# 2. live HTTP readiness scour (concurrency 8, 8 product pages each)
pnpm --filter @agentaudit/audit exec tsx scripts/batch-readiness.ts <dir>/stores.json <dir> 8 8
# 3. per-store PDFs + summary, benchmarked vs the top-50 fixture (omit last arg for the canonical top-50 run)
pnpm --filter @agentaudit/report exec tsx scripts/build-cohort.mts <dir> 2026-06-12T00:00:00Z packages/report/fixtures/cohort-stats.json
```
Readiness-only (no order data, no checkout probe — gentle on prospect stores). The probe and order/dispute classification are the full paid audit.

## Key conventions (do not break)

- Never complete purchases / never fill payment fields; probe stops at checkout info page. CAPTCHA: record only.
- Secrets via env only; `--token` takes the env var NAME. Never log tokens.
- Merchant data only under ./data/ and ./artifacts/ (gitignored); `make scrub STORE=<domain>` deletes a store.
- Classifier rules are pure functions with fixture tests; methodology states confidence tiers honestly.
- Landing copy must come from agent-audit-marketing.md verbatim — no marketing strings hardcoded in components.
- Deps allowed: playwright, zod, commander, yaml, csv-parse (+ next/react for site) — ask Sidwyn before adding others.
- Conventional commits on `feat/agentaudit-v1`; typecheck → test → lint before every commit.

## How to redeploy the site

```bash
pnpm demo                                  # refresh sample-report.pdf (or keep your own at repo root)
pnpm --filter agentaudit-site build        # writes apps/site/out (prebuild copies the pdf)
cd apps/site/out && vercel deploy --prod --yes --token $VERCEL_TOKEN
```

To enable payments: set STRIPE_PAYMENT_LINK before `next build` (build-time env, static export). FORM_ENDPOINT likewise for the email form.

## Open items

1. **DNS**: A record `@ → 76.76.21.21` at Hover, then agentaudit.site goes live (Vercel verifies + issues TLS automatically).
2. FORM_ENDPOINT (Formspree or similar) not set yet — email form posts to "#".
3. STRIPE_PAYMENT_LINK not set yet — page shows email capture instead of pay button.
4. Datacenter CIDRs now vendor real AWS (10.5k) + GCP (976) + Azure AzureCloud union (15.3k). Refresh: download Azure Service Tags JSON (`https://download.microsoft.com/download/7/1/D/71D86715-5596-4529-9B13-DA13A5DE5B63/ServiceTags_Public_<YYYYMMDD>.json`, a recent Monday) then `pnpm --filter @agentaudit/audit exec tsx scripts/update-cidrs.ts --azure <file>`.
5. Smoke-test `audit readiness` against a real store before the first paid audit (`SMOKE_STORE_URL=... pnpm --filter @agentaudit/audit test` runs the gated probe test).

## Transaction-layer reliability (important)

The automated Playwright checkout probe is **not reliable on heavily-custom storefronts** (verified: Ridge — a flagship Shopify Plus store — reads `cart/not_found` because its React app defeats generic add-to-cart selectors, even after broadening selectors + a hydration wait). A "not_found"/"timeout" blocker is INCONCLUSIVE and must never be published as a definitive "an agent can't check out" verdict in outreach — that risks a false-negative that burns the lead. CAPTCHA/popup/password/login blockers are higher-confidence. **For the transaction layer in sellable reports, use `audit manual`** (human runs ChatGPT/Perplexity/Claude and records the YAML) — this is the product's intended design. The probe is a useful manual-assisted signal, not an automated outreach claim.
6. Untracked working file: docs/marketing/agent-audit-target-pitches.csv (Sidwyn's outreach list — not part of the build).
