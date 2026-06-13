# Agent Commerce Readiness — Next 100 Leads (June 2026)

Live agent-readiness audit of the 100 leads in
`docs/marketing/agent-audit-next-100-high-quality-leads.csv`, run 2026-06-12 with
the AgentAudit `audit readiness` pipeline. **Readiness-only** (public-surface):
robots.txt, product feeds, and JSON-LD structured data on up to 8 product pages
per store. Throttled GET requests only — nothing purchased, gentle on each store.

Each store's `report.pdf` is **benchmarked against the top-50 Shopify cohort**
(`../cohort-2026-06`).

## What's in this folder

- `<domain>/report.pdf` — **the per-lead PDF to send**
- `<domain>/readiness.json`, `<domain>/store.json` — raw audit data + metadata
- `cohort-summary.pdf` — overview across all 100
- `cohort-stats.json`, `index.json`, `stores.json`

## Aggregate findings (n = 100)

- **1%** block at least one AI agent in robots.txt.
- **74%** expose `/products.json`; **97%** a reachable sitemap; **75%** a real `llms.txt`.
- **11%** exposed no sitemap-discoverable product pages to an honest crawler.
- **Only 25%** had complete Product/Offer structured data on every sampled page; **25% exposed no schema.org Product JSON-LD at all in their initial HTML** — agents that don't run JavaScript can't read their prices.

Per-store specifics (which agent, which fields, which pages) are in each PDF,
with copy-paste robots.txt / JSON-LD / llms.txt fixes.

## Caveats

- Structured-data detection reads the **initial HTML** (no JS execution) — also how non-JS agents see the page.
- 26 of 100 did not return `/products.json` to our user-agent (bot-wall or non-Shopify); readiness still measured on robots/sitemap/structured data.
- Discovery-only; transaction-layer reachability and order/dispute classification are the full paid audit.

## Reproduce

```bash
pnpm --filter @agentaudit/audit exec tsx scripts/leads-to-stores.ts docs/marketing/agent-audit-next-100-high-quality-leads.csv cohort-next100-2026-06/stores.json
pnpm --filter @agentaudit/audit exec tsx scripts/batch-readiness.ts cohort-next100-2026-06/stores.json cohort-next100-2026-06 8 8
pnpm --filter @agentaudit/report exec tsx scripts/build-cohort.mts cohort-next100-2026-06 2026-06-12T00:00:00Z packages/report/fixtures/cohort-stats.json
```
