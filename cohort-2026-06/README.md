# Agent Commerce Readiness — Top 50 Shopify Stores (June 2026)

Live agent-readiness audit of 50 well-known Shopify-powered DTC brands, run on
2026-06-12 with the AgentAudit `audit readiness` command. **Readiness-only**
(public-surface): robots.txt, product feeds, and JSON-LD structured data on a
sample of product pages. No order data, and no checkout probe — only throttled
GET requests, to stay gentle on production stores.

## What's in this folder

- `<domain>/readiness.json` — raw readiness data per store
- `<domain>/store.json` — store metadata
- `<domain>/report.pdf` — **the individual PDF report for that store** (with its cohort percentile)
- `cohort-summary.pdf` — the cross-store findings report
- `cohort-stats.json` — the benchmark distribution (also copied to `packages/report/fixtures/` so every future report can cite it)
- `index.json` — machine-readable run results
- `stores.json` — the input list

## Headline findings (n = 50)

The door is open, but the shelves aren't labeled.

- **0 of 50** stores block AI shopping agents in robots.txt. Access is not the problem.
- **86%** serve a real `llms.txt` agent-instruction file (Shopify is auto-provisioning these) and **98%** expose a reachable sitemap.
- **84%** expose a `/products.json` catalog feed. The 8 that didn't were unreachable to an honest bot user-agent (bot-walls or a disabled endpoint) — itself an agent-readiness gap.
- **But only 34%** had complete Product/Offer structured data on every sampled product page, and **26% exposed no schema.org Product JSON-LD at all in their initial HTML** — so an agent that doesn't execute JavaScript (most crawler-class agents) cannot read the price, availability, or SKU.

Discovery-readiness sub-score (the public-surface signals, 0–100): **median 88, mean 80, range 25–100.** The spread is almost entirely the structured-data layer: stores that render product schema server-side score in the 90s; stores that inject it client-side (or omit it) score in the 25–60 range despite being huge brands.

The takeaway for a merchant: passing robots/feeds/llms.txt is necessary but not sufficient. The differentiator — and what agents actually parse to quote and compare your products — is **server-rendered Product/Offer JSON-LD**.

## Caveats

- Structured-data detection reads the **initial HTML response** (no JS execution). A store that injects JSON-LD client-side reads as "missing" here — which is also how non-JS agents see it, so it's a real readiness signal, but not proof the markup is entirely absent post-render.
- Cohort is large, well-known brands, so it is a **conservative** baseline: the typical Shopify store scores lower than this group.
- Discovery-only. Transaction-layer reachability and order/dispute classification are part of the full paid audit, not this batch.

## Reproduce

```bash
pnpm --filter @agentaudit/audit exec tsx scripts/batch-readiness.ts cohort-2026-06/stores.json cohort-2026-06 6
pnpm --filter @agentaudit/report exec tsx scripts/build-cohort.mts cohort-2026-06 2026-06-12T00:00:00Z
```
