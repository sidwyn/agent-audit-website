# AgentAudit — Agent Commerce Audit

Tooling for a $99 productized audit of Shopify stores: can AI shopping agents
(ChatGPT, Perplexity, Claude, Gemini) buy from the store, what share of recent orders
were agent-placed, and how those orders perform on disputes. Output is a scored
PDF report plus a readout call.

Monorepo (pnpm, TypeScript, Node 20):

- `packages/audit` — CLI: `audit readiness <url>`, `audit classify`, `audit manual`
- `packages/report` — scored HTML report printed to PDF (`report generate`, `report demo`)
- `apps/site` — static landing page (Next.js export) at agentaudit.site

## Setup

```bash
pnpm install
pnpm --filter @agentaudit/audit exec playwright install chromium
pnpm demo   # renders sample-report.pdf from bundled fixtures, zero credentials
```

All checks: `pnpm typecheck && pnpm test && pnpm lint`.

## Runbook: one audit end to end (< 2 hours)

**0:00 — Intake.** Merchant has paid and answered the five intake questions
(store URL, myshopify domain, GMV band, contact, anything fragile we should
avoid). Create the workspace row and send the token guide below.

**0:05 — Readiness (automated, ~15 min wall clock).**

```bash
pnpm --filter @agentaudit/audit exec tsx src/cli.ts readiness https://store.com
```

Writes `data/<store>/readiness.json`, screenshots to `artifacts/<store>/`.
Throttled to 1 req/sec; the checkout probe stops at the checkout information
page and never enters payment details. CAPTCHA is recorded, never bypassed.

**0:20 — Classify (needs merchant token).**

```bash
export AGENTAUDIT_SHOP_TOKEN=...   # paste from merchant, never commit/log
pnpm --filter @agentaudit/audit exec tsx src/cli.ts classify \
  --shop store.myshopify.com --token AGENTAUDIT_SHOP_TOKEN
```

`--token` takes the env var **name**, not the value. CSV fallback if the
merchant prefers an export:

```bash
pnpm --filter @agentaudit/audit exec tsx src/cli.ts classify \
  --orders orders.csv --disputes disputes.csv --store store.com
```

CSV columns — orders: `id, source_name, app_id, user_agent, browser_ip,
referring_site, landing_site, total_price, created_at, financial_status`;
disputes: `order_id, status, type, amount, initiated_at`.

**0:40 — Manual agent runs (~40 min).** Run the same purchase task in ChatGPT
agent mode, Perplexity, and Claude. Use test mode or cancel before fulfillment,
coordinated with the merchant. Record each run in `runs.yaml`:

```yaml
store: store.com
runs:
  - agent: chatgpt            # chatgpt | perplexity | claude | gemini
    task: Buy the field jacket in size M
    steps:
      - What the agent did, step by step
    outcome: success           # success | abandoned
    failure_stage: variant     # required when abandoned: discovery|product_page|variant|cart|checkout|payment
    notes: Optional color
    screenshots: [artifacts/store.com/manual-chatgpt-01.png]
```

```bash
pnpm --filter @agentaudit/audit exec tsx src/cli.ts manual --store store.com --file runs.yaml
```

**1:20 — Generate the report.** Create `data/<store>/store.json`
(`{"name", "domain", "gmvBand", "contact"}`), then:

```bash
pnpm --filter @agentaudit/report exec tsx src/cli.ts generate \
  --data-dir data/store.com --meta data/store.com/store.json --out report-store.pdf
```

**1:40 — Review and deliver.** Sanity-check the score, fix list and VAMP math.
Send the PDF, book the readout, then delete their data:

```bash
make scrub STORE=store.com
```

Ask the merchant to revoke the token (uninstall the custom app).

## Merchant guide: create a read-only token (no code, ~10 minutes)

Send this verbatim — written for a non-technical store owner:

> 1. In your Shopify admin, click **Settings** (bottom left), then **Apps and
>    sales channels**.
> 2. Click **Develop apps** (top right). If you see a prompt to allow custom
>    app development, click **Allow custom app development** (twice).
> 3. Click **Create an app**. Name it `AgentAudit (read-only)` and click
>    **Create app**.
> 4. Open the **Configuration** tab and click **Configure** next to *Admin API
>    integration*.
> 5. In the scopes list, tick **exactly two** boxes: `read_orders` and
>    `read_shopify_payments_disputes`. Click **Save**.
> 6. Open the **API credentials** tab and click **Install app**, then confirm.
> 7. Under *Admin API access token*, click **Reveal token once** and copy it.
>    This token can only be viewed once — copy it now.
> 8. Send it to us through the secure link we gave you (please don't email it).
> 9. After you receive your report: come back to this app and click
>    **Uninstall app**. That revokes the token permanently.
>
> This token can only **read** orders and disputes. It cannot see customer
> passwords or payment details, and it cannot change anything in your store.

## Data handling

- Merchant data lives only under `./data/<store>/` and `./artifacts/<store>/` —
  both gitignored. `make scrub STORE=<domain>` deletes a store entirely.
- Tokens come in via env vars, are never logged, and never leave the machine.

## Maintenance

- **Datacenter IP ranges** (heuristic tier): refresh with
  `pnpm --filter @agentaudit/audit exec tsx scripts/update-cidrs.ts`
  (AWS + GCP automatic; for Azure download the Service Tags JSON from
  microsoft.com/download id=56519 and pass `--azure <file>`).
- **Shopify API version** is pinned in `packages/audit/src/classify/shopify.ts`
  (`2026-01`); REST is legacy-but-supported for admin-created custom apps.
- **Site**: `pnpm --filter agentaudit-site build` → static `out/`; preview with
  `node apps/site/scripts/serve-static.mjs`. CTA uses `STRIPE_PAYMENT_LINK` at
  build time, email capture posts to `FORM_ENDPOINT` when Stripe is unset. The
  landing copy renders verbatim from `agent-audit-marketing.md`.

## Agent testing — live per-agent runs & the inbox watcher

The readiness-only reports infer the per-agent matrix from robots/structured-data. To put
**real** "can this agent buy" data into a store's report, run the agents live and feed the
results in. Two paths: generate paste-ready prompts (Tier 2), or run a watch-folder that
auto-rebuilds the PDF as results arrive.

### Quick path — generate prompts, paste replies

```bash
# 1. print one copy-paste prompt per assistant (ChatGPT / Perplexity / Claude / Gemini)
pnpm --filter @agentaudit/audit exec tsx src/cli.ts agent-prompts --store graza.co --product https://graza.co/products/sizzle

# 2. paste each into the agent. Each reply ends with a line like:
#    RESULT | agent: chatgpt | outcome: success | furthest_stage: payment | blocker: none | notes: ...
# 3. drop all replies into one file, then fold them in:
pnpm --filter @agentaudit/audit exec tsx src/cli.ts manual --store graza.co \
  --from-replies replies.txt --out cohort-2026-06/graza.co

# 4. re-render that store's report
pnpm --filter @agentaudit/report exec tsx scripts/render-one.mts \
  cohort-2026-06 graza.co packages/report/fixtures/cohort-stats.json
```

`agent` is free-form — `chatgpt`, `perplexity`, `claude`, `gemini`, `rufus`, `codex`, etc.
Known consumer brands populate the per-agent matrix; others appear in the transaction layer.
Runs must stop before payment and must never bypass a CAPTCHA.

### Auto path — the inbox watcher

Run this once (from the repo root) and leave it running:

```bash
pnpm --filter @agentaudit/report exec tsx scripts/watch-inbox.mts \
  "$PWD/inbox" \
  "$PWD/cohort-2026-06,$PWD/cohort-leads-2026-06,$PWD/cohort-next100-2026-06" \
  "$PWD/packages/report/fixtures/cohort-stats.json"
```

Then drop results into `inbox/<domain>/` — the watcher polls every 3s, merges by agent
(adds/replaces that agent, preserves the others), copies screenshots into the store's
`live-session/`, and re-renders `report.pdf`. It prints `updated <slug>: N run(s) ...` per change.

```bash
mkdir -p inbox/graza.co
pbpaste > inbox/graza.co/chatgpt.txt              # paste an agent reply (must contain a RESULT line)
cp ~/Downloads/chatgpt-3-cart.png inbox/graza.co/ # step screenshots (see naming below)
```

- `$PWD/` keeps paths absolute (required, since `pnpm --filter` runs from the package dir).
- The store's folder must already have `readiness.json` in one of the listed cohort dirs.
- `inbox/` is gitignored. To publish an updated report, commit `cohort-*/<domain>/`.

#### Screenshots — one per step, per agent (required)

We want a screenshot at **every step** from **every agent**. They render as a "Step-by-step
screenshots" gallery in the report's transaction layer, grouped by agent.

- **Name each file `<agent>-<step>-<stage>.png`** so it attaches to the right agent's run.
  The watcher links a screenshot to an agent when the filename starts with that agent name
  (`chatgpt-…`, `perplexity-…`, `claude-…`, `codex-…`, …). Recommended set per agent:
  - `<agent>-1-product.png` — product page
  - `<agent>-2-variant.png` — options/variant selected
  - `<agent>-3-cart.png` — added to cart (cart page or drawer)
  - `<agent>-4-checkout.png` — checkout (contact/shipping)
  - `<agent>-5-payment.png` — payment step (card fields visible; stop here)
- If an agent stalls, still screenshot that step and name it for the stage it reached.
- Drop them in the **same `inbox/<domain>/`** folder as the reply. The watcher copies them
  into `cohort-*/<domain>/live-session/`, attaches them to that agent's run, and re-renders.

The `agent-prompts` command already bakes these instructions (and the naming) into each prompt,
so the agent is told to capture and name every step.

**Letting Codex (or any file-writing agent) self-serve.** Tell it:
> After the shopping run, create `inbox/<domain>/` in the repo. Write your
> `RESULT | agent: codex | ...` line to `inbox/<domain>/codex.txt`, and save a screenshot at
> every step as `inbox/<domain>/codex-1-product.png`, `codex-2-variant.png`, `codex-3-cart.png`,
> `codex-4-checkout.png`, `codex-5-payment.png`. Do not enter payment details or place an order.

Browser/app agents (ChatGPT, Perplexity, Gemini) can't write to disk — paste their reply into
`inbox/<domain>/<agent>.txt` yourself, and save each step screenshot into the same folder using
the `<agent>-<step>-<stage>.png` names above (the agent prompt asks them to take one per step).

### Personalizing a report

Drop `cohort-*/<domain>/branding/screenshot.png` (a homepage screenshot) and
`branding/favicon.png` — they render as a banner + logo in the scorecard on the next rebuild.
