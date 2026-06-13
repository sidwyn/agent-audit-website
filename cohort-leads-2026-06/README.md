# Agent Commerce Readiness — 100 Outreach Leads (June 2026)

Live agent-readiness audit of the 100 leads in
`docs/marketing/agent-audit-enriched-leads.csv`, run 2026-06-12 with the
AgentAudit `audit readiness` pipeline. **Readiness-only** (public-surface):
robots.txt, product feeds, and JSON-LD structured data on a sample of up to 8
product pages per store. Throttled GET requests only — no carts touched, nothing
purchased, gentle on each prospect's store.

Each store's `report.pdf` is **benchmarked against the top-50 Shopify cohort**
(`../cohort-2026-06`), so a prospect sees how they stack up against the biggest
brands in commerce.

## What's in this folder

- `<domain>/report.pdf` — **the per-lead PDF to send** (discovery readiness score, per-agent buyability matrix, fix list, copy-paste remediation, benchmark vs top 50)
- `<domain>/readiness.json` — raw audit data
- `<domain>/store.json` — store metadata (brand from the lead list)
- `cohort-summary.pdf` — overview across all 100 leads
- `cohort-stats.json` — this set's distribution
- `index.json` — machine-readable results (Shopify-detected, blocked agents, page counts)
- `stores.json` — the input list (derived from the leads CSV)

## Aggregate findings (n = 100)

These mid-market DTC brands are measurably less agent-ready than the top 50 —
which is the opening for outreach.

- **3%** block at least one AI agent in robots.txt (top-50: 0%).
- **76%** expose a `/products.json` catalog feed; **89%** a reachable sitemap; **78%** a real `llms.txt`.
- **20%** exposed no product pages discoverable from their sitemap to an honest crawler.
- **Only 25%** had complete Product/Offer structured data on every sampled product page, and **21% exposed no schema.org Product JSON-LD at all in their initial HTML** — an agent that doesn't run JavaScript can't read their prices.

Per-store specifics (which agent is blocked, which fields are missing, which
pages) are in each PDF, with copy-paste robots.txt / JSON-LD / llms.txt fixes.

## Caveats

- Structured-data detection reads the **initial HTML** (no JS execution) — also how non-JS agents see the page.
- 24 of 100 did not return a `/products.json` to our user-agent (bot-wall or non-Shopify); their readiness is still measured on robots/sitemap/structured data.
- Discovery-only; transaction-layer reachability and order/dispute classification are the full paid audit.

## Reproduce

```bash
pnpm --filter @agentaudit/audit exec tsx scripts/leads-to-stores.ts docs/marketing/agent-audit-enriched-leads.csv cohort-leads-2026-06/stores.json
pnpm --filter @agentaudit/audit exec tsx scripts/batch-readiness.ts cohort-leads-2026-06/stores.json cohort-leads-2026-06 8 8
pnpm --filter @agentaudit/report exec tsx scripts/build-cohort.mts cohort-leads-2026-06 2026-06-12T00:00:00Z packages/report/fixtures/cohort-stats.json
```
