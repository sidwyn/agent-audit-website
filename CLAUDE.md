# AgentArmor — Project Context for Claude Code (Shopware edition)

AgentArmor is a **native Shopware 6 PHP plugin** that protects a self-hosted Shopware store from AI-agent
abuse: catalog scraping, promo-code farming, and text-field injection. North-star spec:
`Agent_Armor_Build_Spec_v7_Shopware.pdf`. Work ships as **vertical slices**; each has a ticket (S0, S1, …).

## Stack (decided)
- PHP 8.2+, **Shopware 6.6+ self-hosted**, Symfony, MySQL via DAL/DBAL, Redis.
- Tests: PHPUnit (Shopware test bootstrap). Static analysis: PHPStan + Easy Coding Standard (ECS).
- Dev env: a **free self-hosted Shopware** (the `dockware/dev` Docker image is easiest). **Not** Shopware Cloud/SaaS.

## Workflow per ticket
1. Read the ticket. Implement module by module (smallest verifiable unit first).
2. `composer install`; `bin/console plugin:refresh`; `bin/console plugin:install --activate AgentArmor`; run migrations.
3. Run PHPUnit → fix until green. Run PHPStan + ECS → fix until clean.
4. Confirm the ticket's **Definition of done**. **Stop.** Don't refactor beyond scope or start another slice.

Done = PHPUnit green, PHPStan + ECS clean, all acceptance criteria met.

## Guardrails (non-negotiable)
- **Watch-only first.** Validators/DLP run in observe mode (log the would-block) behind a config flag; in watch
  mode never block a request or modify a response. Enforce is a guarded branch, enabled only by the slice that owns it.
- **Config-driven:** mode, kill switch, allowlist, thresholds, and promo policy live in plugin config
  (`SystemConfigService`), hot-readable. No hardcoding.
- **Identity is verified, not trusted:** unsigned/invalid agent → anonymous; no customer → not logged in.
- **Performance:** heavy lookups go in a `CartDataCollector` (runs once), **not** the cart Processor (runs many
  times per request). Keep the Redis ledger small.
- **Self-hosted only.** Never assume Cloud/SaaS or the App System. This is a PHP plugin.
- **Every decision emits one structured JSON log line** (the future dashboard reads these).
- **Don't hand-roll RFC 9421** — use a library or reuse SwagUcp's verification.

## Slice backlog
- **S0 — Plugin skeleton + identity + config + logging.** Start here.
- **S1 — Threat 1 (scraping):** Store API DLP + rate-limit + feed-field control, watch-only.
- **S2 — Threat 2 (promo):** collector + validator + Redis ledger + order.placed claim. The dollar wedge.
- **S3 — Threat 3 (text):** sanitize untrusted fields + "untrusted" tag.
- **Deferred but committed:** admin Dashboard (reads the decision log); Shopware Store listing.

## Key Shopware mechanisms (verified against the docs)
- Intercept/block a request: `kernel.request` event subscriber → set a 403/429 response.
- Catalog DLP: `ProductListingResultEvent` / Store API route decoration.
- Rate limit: built-in `RateLimiter` (escalating `time_backoff`) or custom Redis.
- Promo: read promotion line items (`Cart->getLineItems()`, type `promotion`, payload has the `code`); block via
  `CartValidatorInterface` + an error whose `blockOrder()` is true; dedup via a `CartDataCollector` querying Redis/DB.
- Login: `SalesChannelContext->getCustomer()`.
- Post-order: `checkout.order.placed` event + `StateMachineRegistry` (cancel/refund/flag).
- Card fingerprint: provider-dependent — Stripe exposes a stable `fingerprint`; last4+brand only is weak.
- UCP layer: the `SwagUcp` reference plugin (beta) — integrate with / extend it; it already does RFC 9421 verification.
