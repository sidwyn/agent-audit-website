# AgentAudit — Build Status

_Last updated: 2026-06-12. Paste-able handoff for any coding agent (Codex etc.)._

## What this is

A $99 productized audit for Shopify merchants ("Agent Commerce Audit"), sold at
agentaudit.site. Two questions: (1) can AI shopping agents (ChatGPT, Perplexity,
Claude) buy from the store, (2) what share of the last 90 days of orders were
agent-placed and how do they perform on disputes (Visa VAMP exposure).
Deliverable per customer: scored PDF report + readout call. Full spec: PLAN.md.
Runbook + merchant token guide: README.md.

## State: COMPLETE and deployed (v1)

pnpm monorepo, TypeScript strict, Node 20, branch `feat/agentaudit-v1`.
94 unit tests + 7 Playwright E2E, all green. `pnpm typecheck && pnpm test &&
pnpm lint` clean at root.

| Piece | Where | Status |
|---|---|---|
| `audit readiness <url>` | packages/audit | done — robots.txt per 13 agent UAs, products.json/sitemap/llms.txt, JSON-LD/OG/canonical on ≤10 product pages (1 req/s), Playwright add-to-cart→checkout probe (hard stop at checkout info page, CAPTCHA detect-only), screenshots → artifacts/, output → data/<store>/readiness.json |
| `audit classify` | packages/audit | done — Shopify Admin REST 2026-01 (custom-app token via env-var NAME, pagination + 429 retry) or CSV fallback; 4 tiers: confirmed_channel → high_confidence_agent (UA/referrer/utm) → heuristic_agent (headless UA, datacenter CIDR — vendored AWS 10.5k + GCP 976 + Azure seed) → human; dispute join, GMV share, agent-vs-human delta, VAMP bands (0.5%/1.5% defaults, flag-configurable) |
| `audit manual` | packages/audit | done — zod-validated YAML of hand-run agent sessions (agent/task/steps/outcome/failure_stage/screenshots) merged into report data |
| Report | packages/report | done — score 0–100 (weights: discovery 40 = robots 10 + structured data 15 + feeds 10 + llms.txt 5; transaction 60 = cart 20 + checkout 20 + manual 20), auto-drafted findings, impact÷effort fix list, inline SVG charts, VAMP math, honest methodology section; HTML → PDF via Playwright. `pnpm demo` → sample-report.pdf from fixtures, zero credentials |
| Landing page | apps/site | done — Next.js 15 static export; copy rendered VERBATIM from agent-audit-marketing.md (custom ~100-line md parser, unit-tested); CTA → STRIPE_PAYMENT_LINK env at build time, email capture → FORM_ENDPOINT when unset (currently unset → email form, action="#" until FORM_ENDPOINT set); /sample-report.pdf linked from hero (prebuild copies repo-root pdf); privacy counter stub (no-op unless NEXT_PUBLIC_COUNTER_ENDPOINT) |
| Deploy | Vercel | LIVE at https://agentaudit-two.vercel.app (project `sidwyn-proj/agentaudit`, static out/ deploy). Domain agentaudit.site attached to the project but **DNS pending**: add `A @ 76.76.21.21` at Hover (or move nameservers to Vercel) |

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
4. Azure CIDR list is a seed; refresh via `packages/audit/scripts/update-cidrs.ts --azure <ServiceTags.json>`.
5. Smoke-test `audit readiness` against a real store before the first paid audit (`SMOKE_STORE_URL=... pnpm --filter @agentaudit/audit test` runs the gated probe test).
6. Untracked working file: docs/marketing/agent-audit-target-pitches.csv (Sidwyn's outreach list — not part of the build).
