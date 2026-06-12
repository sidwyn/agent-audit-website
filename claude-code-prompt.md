# Prompt for Claude Code

Paste everything below this line into Claude Code from an empty directory. Drop `agent-audit-marketing.md` into the repo root first so the site build can read it.

---

I'm launching a $99 productized audit for Shopify merchants called the Agent Commerce Audit. It answers two questions: (1) can AI shopping agents (ChatGPT, Perplexity, Claude) successfully buy from this store, and (2) what share of the store's recent orders were agent-placed, and how do those orders perform on disputes. I deliver a PDF report plus a readout call. I need the tooling built this week. I'm a staff-level engineer; don't over-explain, do ask before big decisions.

Build a pnpm monorepo (TypeScript, Node 20) with three packages. Build in this order: classifier, readiness checks, report generator, landing page. Keep dependencies to: playwright, zod, commander, yaml, csv-parse, plus dev tooling. Ask me before adding others.

## packages/audit — CLI with three commands

### `audit readiness <store-url>`
Automated agent-readiness checks against a storefront:
- Fetch and parse robots.txt; report allow/deny per agent UA: GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Perplexity-User, ClaudeBot, Claude-User, Claude-SearchBot, Google-Extended, Amazonbot, Applebot-Extended, meta-externalagent, Bytespider.
- Check existence/accessibility of /products.json, /sitemap.xml, /llms.txt.
- From the sitemap, fetch up to 10 product pages; validate JSON-LD schema.org Product/Offer (price, priceCurrency, availability, sku or gtin, image), OG tags, canonical. Throttle to 1 req/sec.
- Playwright run: open a product page, select the first available variant, add to cart, proceed until the checkout information page loads. Record blockers encountered: interstitial popups, geo gates, login walls, CAPTCHA presence (detect and record only; never attempt to solve or bypass), JS errors, time-to-checkout. Save screenshots to ./artifacts/<store>/.
- Hard rule: never complete a purchase, never enter payment details. Stop at the checkout info page.
- Output: data/<store>/readiness.json with per-check pass/fail/notes.

### `audit classify --shop <domain> --token <env ref>` (CSV fallback: `--orders <csv> --disputes <csv>`)
- Pull last 90 days of orders via Shopify Admin API (custom app token, read_orders scope; also read_shopify_payments_disputes when available). Fetch latest Admin API docs as needed; handle pagination and rate limits.
- Per order, capture: source_name, app_id, client_details.user_agent, client_details.browser_ip, referring_site, landing_site, total_price, created_at, financial_status.
- Classify into tiers:
  1. confirmed_channel: source_name/app_id is not web/pos/draft (enumerate distinct values; flag assistant channels).
  2. high_confidence_agent: UA matches the agent list above, or referring_site host in [chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com], or landing_site has utm_source matching those.
  3. heuristic_agent: headless markers in UA, or browser_ip in bundled datacenter CIDR lists (AWS/GCP/Azure published ranges, vendored as JSON).
  4. human: default.
- Join disputes to orders. Output data/<store>/classify.json: order count and GMV share per class, dispute rate per class, dispute-rate delta (agent vs human), combined dispute ratio vs Visa VAMP bands (configurable thresholds, defaults: 0.5% above-standard, 1.5% excessive, per April 2026 rules).
- Classifier rules must be pure functions with unit tests over fixture orders.

### `audit manual`
I run ChatGPT agent mode, Perplexity, and Claude against the store by hand and record results. Define a YAML schema: agent, task, steps[], outcome (success|abandoned), failure_stage (discovery|product_page|variant|cart|checkout|payment), notes, screenshots[]. This command validates the YAML and merges it into the report data.

## packages/report
- Input: readiness.json + classify.json + manual-runs.yaml + store metadata (name, GMV band, contact).
- Render an HTML template, print to PDF via Playwright. Single column, scorecard at top, clean enough to charge for. Inline SVG bar charts for traffic and dispute sections; no charting library.
- Agent Readiness Score 0–100, weights in config: discovery 40 (robots 10, structured data 15, feeds 10, llms.txt 5), transaction 60 (cart reachable 20, checkout reachable 20, manual agent outcomes 20).
- Sections: executive summary (auto-drafted findings as plain sentences), discovery layer, transaction layer (table: agent × stage reached × blocker), order classification, dispute exposure with VAMP math shown, fix list ranked by impact × effort, methodology and caveats (state classification confidence tiers honestly).
- Ship demo fixtures for a fake store so `pnpm demo` produces sample-report.pdf end to end with zero credentials.

## apps/site
- Static one-pager (Astro or Next.js static export). Pull all copy verbatim from agent-audit-marketing.md at repo root: hero, stats bar, what you get, how it works, guarantee, FAQ, about.
- Primary CTA buttons link to STRIPE_PAYMENT_LINK env var. Secondary email capture wired to a FORM_ENDPOINT env var (Formspree-style POST), shown if the Stripe var is unset.
- Design: distinctive, fast, mobile-first; avoid template look. Dark accent, tabular numerals for stats. No cookie banners, no trackers beyond a privacy-friendly counter stub.

## Cross-cutting
- Secrets via env only; never log tokens. All merchant data lives under ./data/ and ./artifacts/, both gitignored. Add a `make scrub STORE=<domain>` task that deletes a store's data.
- README with a runbook: exact steps to deliver one audit end to end in under 2 hours, including the merchant-facing instructions for creating a read-only custom app token (write these instructions for a non-technical merchant).
- Definition of done: `pnpm demo` generates sample-report.pdf from fixtures; `audit classify` runs against a sample CSV; site builds and runs locally with marketing copy rendered.
