# AgentAudit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the AgentAudit tooling: a CLI that audits Shopify stores for AI-agent readiness and classifies 90 days of orders, a report generator that renders a sellable PDF, and a static marketing one-pager — `pnpm demo` produces sample-report.pdf from fixtures with zero credentials.

**Architecture:** pnpm monorepo (TypeScript strict, Node 20, ESM) with three workspaces: `packages/audit` (commander CLI: `readiness`, `classify`, `manual`; pure classifier functions + Playwright storefront probe), `packages/report` (HTML template → PDF via Playwright, inline SVG charts, scoring), `apps/site` (Next.js static export rendering marketing copy from the repo-root markdown). All merchant data under gitignored `./data/` and `./artifacts/`.

**Tech Stack:** pnpm workspaces, TypeScript 5 strict, commander, zod, yaml, csv-parse, playwright, Next.js (static export), Vitest (unit), @playwright/test (site E2E), ESLint. **No other runtime deps without asking the user first.**

**Branding:** Product name is **AgentAudit** everywhere (the marketing doc's "AgentProof" working name is superseded — substitute on sight).

**Build order (per spec):** classifier → readiness checks → report generator → landing page → deploy preview (user asked to see it live).

**Hard rules (apply to every task):**
- Never complete a purchase, never enter payment details; readiness probe stops at the checkout information page. CAPTCHA: detect and record only — never attempt to solve or bypass.
- Secrets via env only (`--token` takes an env var *name*); never log tokens.
- Merchant data only under `./data/` and `./artifacts/` (gitignored).
- Throttle storefront fetches to 1 req/sec.
- After every task: `pnpm -r typecheck && pnpm -r test && pnpm -r lint` green before committing.
- Conventional commits (`feat:`/`fix:`/`docs:`/`refactor:`) on branch `feat/agentaudit-v1` — never on `main` after bootstrap.

---

## File structure

```
agent-audit-website/
├── PLAN.md                       # this file
├── README.md                     # runbook + merchant token guide (Task 24)
├── Makefile                      # scrub task (Task 24)
├── agent-audit-marketing.md      # marketing copy (verbatim source for site)
├── package.json                  # root: workspace scripts (demo/test/typecheck/lint/build)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
├── .gitignore                    # data/, artifacts/, dist/, out/, .next/, sample-report.pdf, .env*
├── data/                         # gitignored merchant outputs: data/<store>/{readiness,classify}.json
├── artifacts/                    # gitignored screenshots: artifacts/<store>/*.png
├── packages/audit/
│   ├── package.json              # @agentaudit/audit — bin "audit"
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── scripts/update-cidrs.ts   # refresh vendored datacenter ranges (AWS/GCP auto, Azure via file arg)
│   ├── src/
│   │   ├── cli.ts                # commander entry: readiness | classify | manual
│   │   ├── paths.ts              # storeSlug(), dataDir(), artifactsDir()
│   │   ├── classify/
│   │   │   ├── agents.ts         # UA tokens, assistant hosts, utm matching, headless markers
│   │   │   ├── cidr.ts           # ipToBigInt, ipInCidr, ipInAnyCidr
│   │   │   ├── data/datacenter-cidrs.json  # vendored AWS/GCP/Azure CIDRs
│   │   │   ├── types.ts          # OrderRecord, DisputeRecord, Classification, ClassifyOutput…
│   │   │   ├── rules.ts          # classifyOrder() — pure
│   │   │   ├── summary.ts        # summarize() — GMV share, dispute join, VAMP bands — pure
│   │   │   ├── csv.ts            # parseOrdersCsv/parseDisputesCsv
│   │   │   └── shopify.ts        # Admin API client (pagination, rate limit, env token)
│   │   ├── readiness/
│   │   │   ├── http.ts           # throttledFetch (1 req/s), honest UA
│   │   │   ├── robots.ts         # parseRobots, evaluateAgentAccess — pure
│   │   │   ├── feeds.ts          # /products.json, /sitemap.xml, /llms.txt checks
│   │   │   ├── product-page.ts   # JSON-LD Product/Offer, OG, canonical validation — pure core
│   │   │   ├── checkout.ts       # Playwright probe → cart → checkout info page (HARD STOP)
│   │   │   ├── detect.ts         # detectCaptcha, detectPasswordPage, popup selectors — pure
│   │   │   └── types.ts          # ReadinessReport, CheckResult, Blocker…
│   │   ├── manual/
│   │   │   └── schema.ts         # zod schema for manual-runs YAML
│   │   └── commands/
│   │       ├── readiness.ts      # orchestrates readiness → data/<store>/readiness.json
│   │       ├── classify.ts       # API or CSV → data/<store>/classify.json
│   │       └── manual.ts         # validate YAML → data/<store>/manual-runs.json
│   └── tests/                    # mirrors src/: classify/*.test.ts, readiness/*.test.ts, manual/*.test.ts
│       └── fixtures/             # orders.csv, disputes.csv, product-page.html, robots.txt samples
├── packages/report/
│   ├── package.json              # @agentaudit/report — bin "report"; deps: @agentaudit/audit (types)
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── fixtures/demo-store/      # readiness.json, classify.json, manual-runs.yaml, store.json
│   ├── src/
│   │   ├── cli.ts                # report generate | report demo
│   │   ├── types.ts              # StoreMeta, ReportData
│   │   ├── load.ts               # read + zod-validate the three inputs
│   │   ├── score.ts              # computeScore() + DEFAULT_WEIGHTS — pure
│   │   ├── charts.ts             # hBarChart() inline SVG — pure
│   │   ├── findings.ts           # draftFindings() exec-summary sentences — pure
│   │   ├── fixlist.ts            # buildFixList() impact×effort ranking — pure
│   │   ├── template.ts           # renderReportHtml() — single-column doc, print CSS
│   │   ├── sections.ts           # per-section HTML renderers (kept <150 lines each)
│   │   └── render.ts             # htmlToPdf() via Playwright chromium
│   └── tests/                    # score/charts/findings/fixlist/template tests
└── apps/site/
    ├── package.json              # agentaudit-site — next build (output: export)
    ├── next.config.mjs
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── playwright.config.ts      # E2E against built out/
    ├── scripts/serve-static.mjs  # tiny node http server for out/ (E2E + preview)
    ├── src/
    │   ├── app/layout.tsx        # metadata: AgentAudit
    │   ├── app/page.tsx          # composes sections from parsed marketing copy
    │   ├── app/globals.css       # design tokens: dark accent, tabular numerals, mobile-first
    │   ├── lib/marketing.ts      # extract landing sections from ../../agent-audit-marketing.md
    │   ├── lib/markdown.ts       # tiny block/inline renderer (p, ol, ul, bold) — no dep
    │   ├── lib/counter.ts        # privacy-friendly counter stub (no-op POST)
    │   └── components/           # Hero, StatsBar, WhatYouGet, HowItWorks, Guarantee, Faq, About, EmailCapture
    └── tests/                    # markdown.test.ts, marketing.test.ts; e2e/landing.spec.ts
```

---

### Task 0: Repo bootstrap + workspace scaffold

**Files:** Create: `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `agent-audit-marketing.md`, `data/.gitkeep`, `artifacts/.gitkeep`

- [ ] **Step 1: git init + bootstrap commit on main, then feature branch**

```bash
git init -b main
# write .gitignore + PLAN.md first, then the single bootstrap commit main needs to exist:
git add .gitignore PLAN.md && git commit -m "chore: bootstrap repo with plan"
git switch -c feat/agentaudit-v1
```

`.gitignore`:

```
node_modules/
dist/
.next/
out/
data/
!data/.gitkeep
artifacts/
!artifacts/.gitkeep
sample-report.pdf
*.log
.env
.env.*
.DS_Store
test-results/
playwright-report/
```

- [ ] **Step 2: write `agent-audit-marketing.md`** — verbatim content from the user's attachment, with `AgentProof` → `AgentAudit` substituted (title line and working-name line only; landing copy sections contain no brand name).

- [ ] **Step 3: root `package.json`**

```json
{
  "name": "agentaudit",
  "private": true,
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.2.1",
  "scripts": {
    "demo": "pnpm --filter @agentaudit/report demo",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "@eslint/js": "^9.0.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

`eslint.config.mjs` — flat config: `@eslint/js` recommended + `typescript-eslint` recommended over `**/*.ts`/`**/*.tsx`, ignore `dist`, `.next`, `out`, `node_modules`. Add rule `"@typescript-eslint/no-explicit-any": "error"`.

- [ ] **Step 4: install + verify**

Run: `pnpm install` → lockfile created, no errors.

- [ ] **Step 5: Commit** — `chore: scaffold pnpm workspace, ts/eslint config, marketing copy`

---

### Task 1: packages/audit scaffold

**Files:** Create: `packages/audit/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/cli.ts` (stub), `src/paths.ts`, `tests/paths.test.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@agentaudit/audit",
  "version": "0.1.0",
  "type": "module",
  "bin": { "audit": "./dist/cli.js" },
  "exports": { ".": "./dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src tests"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "csv-parse": "^5.5.0",
    "playwright": "^1.45.0",
    "yaml": "^2.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": { "tsx": "^4.0.0", "vitest": "^2.0.0" }
}
```

`tsconfig.json` extends `../../tsconfig.base.json`, `"outDir": "dist"`, `"rootDir": "src"`, include `src`. Tests are typechecked by vitest + a separate `tsconfig.test.json` if needed — simpler: include `tests` in a `tsc --noEmit` project reference is overkill; vitest handles TS in tests, lint covers both.

- [ ] **Step 2: failing test for paths helper** (`tests/paths.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { storeSlug } from "../src/paths.js";

describe("storeSlug", () => {
  it("normalizes URLs and domains to a filesystem-safe slug", () => {
    expect(storeSlug("https://Shop.Example.com/path?x=1")).toBe("shop.example.com");
    expect(storeSlug("shop.example.com")).toBe("shop.example.com");
    expect(storeSlug("my-store.myshopify.com")).toBe("my-store.myshopify.com");
  });
});
```

- [ ] **Step 3: implement `src/paths.ts`**

```ts
import path from "node:path";

export function storeSlug(input: string): string {
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  const host = new URL(withScheme).hostname.toLowerCase();
  return host.replace(/[^a-z0-9.-]/g, "-");
}

export function dataDir(store: string): string {
  return path.join(process.cwd(), "data", storeSlug(store));
}

export function artifactsDir(store: string): string {
  return path.join(process.cwd(), "artifacts", storeSlug(store));
}
```

`src/cli.ts` stub: commander program named `audit` with description; subcommands added in later tasks.

- [ ] **Step 4: run** `pnpm --filter @agentaudit/audit test` → PASS; typecheck + lint green.
- [ ] **Step 5: Commit** — `feat: scaffold audit package with cli stub and path helpers`

---

### Task 2: Agent signatures (`classify/agents.ts`)

**Files:** Create: `src/classify/agents.ts`, `tests/classify/agents.test.ts`

- [ ] **Step 1: failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  AGENT_UA_TOKENS, matchesAgentUa, isAssistantReferrer,
  hasAssistantUtmSource, hasHeadlessMarker, isAssistantSourceName,
} from "../../src/classify/agents.js";

it("has the full 13-agent UA list from the spec", () => {
  expect(AGENT_UA_TOKENS).toHaveLength(13);
  expect(AGENT_UA_TOKENS).toContain("Claude-SearchBot");
});

it("matches agent UAs case-insensitively and returns the token", () => {
  expect(matchesAgentUa("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe("GPTBot");
  expect(matchesAgentUa("mozilla/5.0 perplexitybot/1.0")).toBe("PerplexityBot");
  expect(matchesAgentUa("Mozilla/5.0 (Macintosh) Safari/605.1")).toBeNull();
  expect(matchesAgentUa(null)).toBeNull();
});

it("matches assistant referrer hosts incl. subdomains, rejects lookalikes", () => {
  expect(isAssistantReferrer("https://chatgpt.com/c/abc")).toBe(true);
  expect(isAssistantReferrer("https://www.perplexity.ai/search?q=x")).toBe(true);
  expect(isAssistantReferrer("https://notchatgpt.com/")).toBe(false);
  expect(isAssistantReferrer(null)).toBe(false);
});

it("matches utm_source on landing_site (full URL or path-only)", () => {
  expect(hasAssistantUtmSource("/products/x?utm_source=chatgpt.com")).toBe(true);
  expect(hasAssistantUtmSource("https://s.com/?utm_source=perplexity")).toBe(true);
  expect(hasAssistantUtmSource("/?utm_source=newsletter")).toBe(false);
});

it("flags headless markers", () => {
  expect(hasHeadlessMarker("Mozilla/5.0 HeadlessChrome/120.0")).toBe(true);
  expect(hasHeadlessMarker("python-requests/2.31")).toBe(true);
  expect(hasHeadlessMarker("Mozilla/5.0 (iPhone) Safari")).toBe(false);
});

it("flags assistant source_name channels", () => {
  expect(isAssistantSourceName("chatgpt")).toBe(true);
  expect(isAssistantSourceName("instagram")).toBe(false);
});
```

- [ ] **Step 2: run → FAIL** (module not found)
- [ ] **Step 3: implement**

```ts
export const AGENT_UA_TOKENS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "Perplexity-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot", "Google-Extended", "Amazonbot",
  "Applebot-Extended", "meta-externalagent", "Bytespider",
] as const;

export const ASSISTANT_REFERRER_HOSTS = [
  "chatgpt.com", "chat.openai.com", "perplexity.ai", "claude.ai",
  "gemini.google.com", "copilot.microsoft.com",
] as const;

export const ASSISTANT_UTM_SOURCES = [
  ...ASSISTANT_REFERRER_HOSTS,
  "chatgpt", "openai", "perplexity", "claude", "anthropic", "gemini", "copilot",
] as const;

export const HEADLESS_UA_MARKERS = [
  "headlesschrome", "phantomjs", "puppeteer", "playwright", "selenium",
  "python-requests", "python-httpx", "node-fetch", "axios/", "go-http-client",
  "curl/", "wget/", "okhttp",
] as const;

const ASSISTANT_SOURCE_HINTS = ["chatgpt", "openai", "perplexity", "claude", "anthropic", "gemini", "copilot"];

export function matchesAgentUa(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const low = ua.toLowerCase();
  return AGENT_UA_TOKENS.find((t) => low.includes(t.toLowerCase())) ?? null;
}

function hostOf(url: string): string | null {
  try { return new URL(url, "https://placeholder.invalid").hostname.toLowerCase(); }
  catch { return null; }
}

export function isAssistantReferrer(url: string | null | undefined): boolean {
  if (!url) return false;
  const host = hostOf(url);
  if (!host) return false;
  return ASSISTANT_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function hasAssistantUtmSource(landingSite: string | null | undefined): boolean {
  if (!landingSite) return false;
  try {
    const u = new URL(landingSite, "https://placeholder.invalid");
    const src = u.searchParams.get("utm_source")?.toLowerCase();
    return !!src && ASSISTANT_UTM_SOURCES.some((s) => src === s.toLowerCase());
  } catch { return false; }
}

export function hasHeadlessMarker(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const low = ua.toLowerCase();
  return HEADLESS_UA_MARKERS.some((m) => low.includes(m));
}

export function isAssistantSourceName(sourceName: string): boolean {
  const low = sourceName.toLowerCase();
  return ASSISTANT_SOURCE_HINTS.some((h) => low.includes(h));
}
```

- [ ] **Step 4: run → PASS**; typecheck/lint green.
- [ ] **Step 5: Commit** — `feat: agent UA, referrer, utm and headless signature matching`

---

### Task 3: CIDR matching + vendored datacenter ranges

**Files:** Create: `src/classify/cidr.ts`, `src/classify/data/datacenter-cidrs.json`, `scripts/update-cidrs.ts`, `tests/classify/cidr.test.ts`

- [ ] **Step 1: failing tests**

```ts
import { describe, expect, it } from "vitest";
import { ipInCidr, ipInAnyCidr } from "../../src/classify/cidr.js";

it("matches IPv4 in CIDR", () => {
  expect(ipInCidr("3.5.140.10", "3.5.140.0/22")).toBe(true);
  expect(ipInCidr("3.5.144.1", "3.5.140.0/22")).toBe(false);
  expect(ipInCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
});

it("matches IPv6 in CIDR", () => {
  expect(ipInCidr("2600:1f13::1", "2600:1f13::/36")).toBe(true);
  expect(ipInCidr("2001:db8::1", "2600:1f13::/36")).toBe(false);
});

it("returns false for malformed input and mixed families", () => {
  expect(ipInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
  expect(ipInCidr("10.0.0.1", "2600::/12")).toBe(false);
});

it("ipInAnyCidr scans a list", () => {
  expect(ipInAnyCidr("3.5.140.10", ["1.2.3.0/24", "3.5.140.0/22"])).toBe(true);
});
```

- [ ] **Step 2: run → FAIL**
- [ ] **Step 3: implement** — `ipToBigInt` handling IPv4 dotted-quad and IPv6 (with `::` expansion); `ipInCidr` compares the top `bits` of ip vs base for matching family (32/128-bit space); export `loadDatacenterCidrs()` reading the vendored JSON (`{ aws: string[], gcp: string[], azure: string[] }`) and flattening.

```ts
function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = (out << 8n) | BigInt(n);
  }
  return out;
}

function ipv6ToBigInt(ip: string): bigint | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 && fill < 0) return null;
  if (halves.length === 1 && head.length !== 8) return null;
  const groups = [...head, ...Array(Math.max(fill, 0)).fill("0"), ...tail];
  let out = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    out = (out << 16n) | BigInt(parseInt(g, 16));
  }
  return out;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  if (!base || !bitsRaw) return false;
  const bits = Number(bitsRaw);
  const v4 = !base.includes(":");
  const size = v4 ? 32 : 128;
  if (!Number.isInteger(bits) || bits < 0 || bits > size) return false;
  const ipVal = v4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  const baseVal = v4 ? ipv4ToBigInt(base) : ipv6ToBigInt(base);
  if (ipVal === null || baseVal === null) return false;
  const shift = BigInt(size - bits);
  return ipVal >> shift === baseVal >> shift;
}

export function ipInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}
```

- [ ] **Step 4: vendor the data.** `scripts/update-cidrs.ts` (run with `tsx`): fetch `https://ip-ranges.amazonaws.com/ip-ranges.json` (take `prefixes[].ip_prefix` + `ipv6_prefixes[].ipv6_prefix`) and `https://www.gstatic.com/ipranges/cloud.json` (`prefixes[].ipv4Prefix|ipv6Prefix`); Azure Service Tags JSON has no stable URL — script accepts `--azure <downloaded.json>` and extracts `values[].properties.addressPrefixes`. Write `src/classify/data/datacenter-cidrs.json`. Run it once for AWS+GCP; seed Azure with its well-known core blocks (e.g. `13.64.0.0/11`, `20.33.0.0/16`, `20.34.0.0/15`, `20.36.0.0/14`, `20.40.0.0/13`, `40.74.0.0/15`, `52.224.0.0/11`, `104.40.0.0/13`) and note in README how to refresh. If offline, seed AWS/GCP from their well-known supernets and note it.
- [ ] **Step 5: run tests → PASS**; commit — `feat: cidr matcher with vendored datacenter ip ranges`

---

### Task 4: Order types + classifier rules (pure)

**Files:** Create: `src/classify/types.ts`, `src/classify/rules.ts`, `tests/classify/rules.test.ts`, `tests/fixtures/orders.ts`

- [ ] **Step 1: types** (`src/classify/types.ts`)

```ts
export type OrderRecord = {
  id: string;
  sourceName: string | null;
  appId: string | null;
  userAgent: string | null;
  browserIp: string | null;
  referringSite: string | null;
  landingSite: string | null;
  totalPrice: number;
  createdAt: string;          // ISO 8601
  financialStatus: string | null;
};

export type DisputeRecord = {
  orderId: string;
  status: string;
  type: string | null;
  amount: number | null;
  initiatedAt: string | null;
};

export type OrderClass = "confirmed_channel" | "high_confidence_agent" | "heuristic_agent" | "human";

export type Classification = { orderClass: OrderClass; signals: string[] };
```

- [ ] **Step 2: failing tests** — fixture orders in `tests/fixtures/orders.ts` (a `makeOrder(overrides)` factory defaulting to a plain human web order). Cases:

```ts
const DC = ["3.5.140.0/22"];
// tier 1: non-web source_name wins over everything
expect(classifyOrder(makeOrder({ sourceName: "chatgpt" }), DC))
  .toEqual({ orderClass: "confirmed_channel", signals: ["source_name:chatgpt", "assistant_channel"] });
expect(classifyOrder(makeOrder({ sourceName: "instagram" }), DC).orderClass).toBe("confirmed_channel");
// app_id present and non-standard → tier 1 even when source_name is web
expect(classifyOrder(makeOrder({ sourceName: "web", appId: "99999999" }), DC).orderClass).toBe("confirmed_channel");
// tier 2: each signal independently
expect(classifyOrder(makeOrder({ userAgent: "Mozilla/5.0 ChatGPT-User/1.0" }), DC).orderClass).toBe("high_confidence_agent");
expect(classifyOrder(makeOrder({ referringSite: "https://chatgpt.com/" }), DC).orderClass).toBe("high_confidence_agent");
expect(classifyOrder(makeOrder({ landingSite: "/?utm_source=perplexity" }), DC).orderClass).toBe("high_confidence_agent");
// tier 3: headless UA or datacenter IP
expect(classifyOrder(makeOrder({ userAgent: "HeadlessChrome/120" }), DC).orderClass).toBe("heuristic_agent");
expect(classifyOrder(makeOrder({ browserIp: "3.5.140.9" }), DC).orderClass).toBe("heuristic_agent");
// tier 4
expect(classifyOrder(makeOrder({}), DC).orderClass).toBe("human");
// standard sources stay out of tier 1
for (const s of ["web", "pos", "shopify_draft_order", "draft"]) {
  expect(classifyOrder(makeOrder({ sourceName: s }), DC).orderClass).toBe("human");
}
```

- [ ] **Step 3: implement `rules.ts`**

```ts
import { hasAssistantUtmSource, hasHeadlessMarker, isAssistantReferrer, isAssistantSourceName, matchesAgentUa } from "./agents.js";
import { ipInAnyCidr } from "./cidr.js";
import type { Classification, OrderRecord } from "./types.js";

const STANDARD_SOURCE_NAMES = new Set(["web", "pos", "shopify_draft_order", "draft"]);
// Shopify first-party surfaces: 580111 online store, 129785 POS, 1354745 draft orders
const STANDARD_APP_IDS = new Set(["580111", "129785", "1354745"]);

export function classifyOrder(order: OrderRecord, datacenterCidrs: readonly string[]): Classification {
  const signals: string[] = [];

  const source = order.sourceName?.trim().toLowerCase() ?? "";
  const nonStandardSource = source !== "" && !STANDARD_SOURCE_NAMES.has(source);
  const nonStandardApp = order.appId !== null && !STANDARD_APP_IDS.has(order.appId);
  if (nonStandardSource || nonStandardApp) {
    if (nonStandardSource) signals.push(`source_name:${source}`);
    if (nonStandardApp) signals.push(`app_id:${order.appId}`);
    if (isAssistantSourceName(source)) signals.push("assistant_channel");
    return { orderClass: "confirmed_channel", signals };
  }

  const uaToken = matchesAgentUa(order.userAgent);
  if (uaToken) signals.push(`ua:${uaToken}`);
  if (isAssistantReferrer(order.referringSite)) signals.push(`referrer:${order.referringSite}`);
  if (hasAssistantUtmSource(order.landingSite)) signals.push(`utm_source:${order.landingSite}`);
  if (signals.length > 0) return { orderClass: "high_confidence_agent", signals };

  if (hasHeadlessMarker(order.userAgent)) {
    return { orderClass: "heuristic_agent", signals: [`ua_headless:${order.userAgent}`] };
  }
  if (order.browserIp && ipInAnyCidr(order.browserIp, datacenterCidrs)) {
    return { orderClass: "heuristic_agent", signals: [`ip_datacenter:${order.browserIp}`] };
  }

  return { orderClass: "human", signals: [] };
}
```

- [ ] **Step 4: run → PASS**; commit — `feat: tiered order classifier as pure function with fixture tests`

---

### Task 5: Aggregation + VAMP math (`classify/summary.ts`)

**Files:** Create: `src/classify/summary.ts`, `tests/classify/summary.test.ts`

- [ ] **Step 1: output types** (append to `types.ts`)

```ts
export type ClassSummary = {
  orders: number; orderShare: number;
  gmv: number; gmvShare: number;
  disputes: number; disputeRate: number;
};

export type VampConfig = { aboveStandard: number; excessive: number }; // ratios: 0.005, 0.015

export type ClassifyOutput = {
  store: string;
  generatedAt: string;
  windowDays: number;
  totals: { orders: number; gmv: number; disputes: number; disputeRate: number };
  byClass: Record<OrderClass, ClassSummary>;
  distinctSources: { sourceName: string; appId: string | null; orders: number; flaggedAssistant: boolean }[];
  agentVsHuman: { agentOrders: number; agentDisputeRate: number; humanDisputeRate: number; delta: number };
  vamp: {
    config: VampConfig;
    combinedRatio: number;
    band: "ok" | "above_standard" | "excessive";
    headroomToNextBand: number | null; // disputes-per-current-orders distance to next band; null if already excessive
  };
};
```

- [ ] **Step 2: failing tests** — 10 fixture orders (6 human, 2 high_confidence_agent, 1 heuristic, 1 confirmed assistant channel), 2 disputes (1 on an agent order, 1 on a human order). Assert: shares sum to 1 (±1e-9), GMV share math, `agentVsHuman.delta = agentRate - humanRate` where agent = tiers 2+3 + assistant-flagged tier 1, dispute join by orderId, `combinedRatio = 0.2` → band `excessive` with defaults, band boundaries (`0.005` → `above_standard`, `0.0049` → `ok`), zero-order guard (no NaN).

- [ ] **Step 3: implement `summarize()`** — pure; signature:

```ts
export const DEFAULT_VAMP: VampConfig = { aboveStandard: 0.005, excessive: 0.015 }; // Visa VAMP, April 2026 rules

export function summarize(args: {
  store: string;
  generatedAt: string;
  windowDays: number;
  orders: OrderRecord[];
  classifications: Map<string, Classification>;
  disputes: DisputeRecord[];
  vamp?: VampConfig;
}): ClassifyOutput
```

Agent side of the delta = orders whose class is `high_confidence_agent`/`heuristic_agent`, plus `confirmed_channel` with the `assistant_channel` signal. `distinctSources` enumerates unique `(sourceName, appId)` pairs with counts. All rates guard division by zero → 0.

- [ ] **Step 4: run → PASS**; commit — `feat: classification aggregation with dispute join and vamp banding`

---

### Task 6: CSV ingestion (fallback path)

**Files:** Create: `src/classify/csv.ts`, `tests/classify/csv.test.ts`, `tests/fixtures/orders.csv`, `tests/fixtures/disputes.csv`

- [ ] **Step 1: failing tests** — parse fixture CSVs; assert row counts, field mapping (snake_case headers → OrderRecord), numeric coercion of `total_price`, empty strings → null, helpful error on a missing required header (`id`).

- [ ] **Step 2: implement with `csv-parse/sync`**

```ts
import { parse } from "csv-parse/sync";
import type { DisputeRecord, OrderRecord } from "./types.js";

// Expected orders headers: id, source_name, app_id, user_agent, browser_ip,
//   referring_site, landing_site, total_price, created_at, financial_status
// Expected disputes headers: order_id, status, type, amount, initiated_at

export function parseOrdersCsv(content: string): OrderRecord[] { /* map rows; throw Error("orders csv missing required column: id") when absent */ }
export function parseDisputesCsv(content: string): DisputeRecord[] { /* same pattern */ }
```

Fixture `orders.csv`: ~40 rows of realistic synthetic data for fake store `demo-store.example` — mix matching every classifier tier (a `chatgpt` source row, ChatGPT-User/PerplexityBot UAs, chatgpt.com referrer, utm_source=perplexity landing, HeadlessChrome UA, one AWS-range IP `3.5.140.9`, rest normal Safari/Chrome mobile UAs, prices $18–$240). `disputes.csv`: 3 rows joined to existing order ids (2 on agent rows, 1 on human).

- [ ] **Step 3: run → PASS**; commit — `feat: csv fallback ingestion for orders and disputes`

---

### Task 7: Shopify Admin API client

**Files:** Create: `src/classify/shopify.ts`, `tests/classify/shopify.test.ts`

**Doc check during implementation:** fetch current Shopify Admin API docs (REST `GET /admin/api/{version}/orders.json` fields + `shopify_payments/disputes.json`, current stable version string, REST-vs-GraphQL availability for new custom apps). If REST orders is unavailable to new custom apps, switch to the GraphQL equivalent — keep `mapOrder()` as the single translation point so the rest of the pipeline is unaffected.

- [ ] **Step 1: failing tests** with injected `fetchImpl` (no network):
  - paginates via `Link: <…page_info=xyz>; rel="next"` header across 2 pages → 3 orders total
  - maps REST fields → `OrderRecord` (`client_details.user_agent` → `userAgent`, `app_id` number → string, missing → null)
  - on 429 with `Retry-After: 0` retries the same page
  - sends `X-Shopify-Access-Token` header; token value never appears in thrown error messages
  - `fetchDisputes` returns `{ available: false, disputes: [] }` on 403/404

- [ ] **Step 2: implement**

```ts
export type ShopifyClientOpts = {
  shop: string;                 // my-store.myshopify.com
  token: string;                // resolved from env by the command layer; never logged
  apiVersion?: string;          // default: current stable, verified against docs
  fetchImpl?: typeof fetch;
  delayMs?: number;             // default 600 between page fetches
};

export async function fetchOrders(opts: ShopifyClientOpts, createdAtMin: string): Promise<OrderRecord[]>
export async function fetchDisputes(opts: ShopifyClientOpts): Promise<{ available: boolean; disputes: DisputeRecord[] }>
```

`fetchOrders`: `GET https://{shop}/admin/api/{v}/orders.json?status=any&limit=250&created_at_min={iso}&fields=id,source_name,app_id,client_details,referring_site,landing_site,total_price,created_at,financial_status`; loop on `Link rel="next"`; on 429 wait `Retry-After` seconds (default 2) and retry; sleep `delayMs` between pages. Errors: `throw new Error(\`shopify orders fetch failed: ${status} ${statusText}\`)` — status only, never body/token.

- [ ] **Step 3: run → PASS**; commit — `feat: shopify admin api client with pagination and rate-limit handling`

---

### Task 8: `audit classify` command

**Files:** Create: `src/commands/classify.ts`; Modify: `src/cli.ts`; Test: `tests/commands/classify.test.ts`

- [ ] **Step 1: failing test** — run the command function (exported, not via child process) with `--orders/--disputes` fixture CSVs and a temp cwd; assert `data/demo-store.example/classify.json` exists, validates against a zod schema of `ClassifyOutput`, and `byClass.human.orders > 0`.

- [ ] **Step 2: implement command**

```
audit classify [--shop <domain> --token <ENV_NAME>] [--orders <csv> --disputes <csv>]
               [--store <label>] [--days 90] [--vamp-standard 0.5] [--vamp-excessive 1.5]
```

- API mode: `process.env[tokenEnvName]` → error `token env var ${name} is not set` if missing (name only, value never echoed). `createdAtMin = now - days`.
- CSV mode: requires `--store` (or derives from `--shop`); disputes csv optional.
- Both: classify each order with vendored CIDRs, `summarize(...)`, write pretty JSON to `data/<store>/classify.json`, print a 6-line summary table to stdout (class / orders / share / disputes).
- `--vamp-*` flags are percentages; convert to ratios.

- [ ] **Step 3: wire into `cli.ts`; run → PASS.** Manual check: `pnpm --filter @agentaudit/audit exec tsx src/cli.ts classify --orders tests/fixtures/orders.csv --disputes tests/fixtures/disputes.csv --store demo-store.example` prints summary, writes JSON. **This satisfies the definition-of-done item "audit classify runs against a sample CSV".**
- [ ] **Step 4: Commit** — `feat: audit classify command with api and csv modes`

---

### Task 9: Throttled HTTP helper

**Files:** Create: `src/readiness/http.ts`, `tests/readiness/http.test.ts`

- [ ] **Step 1: failing test** — `makeThrottledFetch(fetchImpl, { intervalMs: 50 })` called 3× resolves in order with ≥`intervalMs` spacing (use fake timers / capture timestamps with injected clock), passes through status/body, sets UA header `AgentAuditBot/0.1 (+https://agentaudit.dev; store readiness check)`.
- [ ] **Step 2: implement** — promise-chain queue (each call awaits previous + interval). Default interval 1000ms (spec: 1 req/sec). 15s timeout via `AbortSignal.timeout`.
- [ ] **Step 3: Commit** — `feat: throttled fetch helper for storefront checks`

---### Task 10: robots.txt parsing + per-agent verdicts

**Files:** Create: `src/readiness/robots.ts`, `src/readiness/types.ts`, `tests/readiness/robots.test.ts`

- [ ] **Step 1: types** (`src/readiness/types.ts`)

```ts
export type RobotsVerdict = { agent: string; allowed: boolean; matchedGroup: string; matchedRule: string | null };
export type CheckResult = { pass: boolean; status: number | null; notes: string };
export type Blocker = {
  stage: "product_page" | "variant" | "cart" | "checkout";
  kind: "popup" | "geo_gate" | "login_wall" | "captcha" | "password_page" | "js_error" | "not_found" | "timeout";
  detail: string;
};
export type CheckoutProbeResult = {
  productUrl: string | null;
  reachedCart: boolean;
  reachedCheckout: boolean;
  blockers: Blocker[];
  jsErrors: string[];
  timeToCheckoutMs: number | null;
  screenshots: string[];
};
export type ProductPageResult = {
  url: string;
  jsonLd: { found: boolean; price: boolean; priceCurrency: boolean; availability: boolean; skuOrGtin: boolean; image: boolean };
  og: { title: boolean; image: boolean };
  canonical: string | null;
  problems: string[];
};
export type ReadinessReport = {
  store: string;
  generatedAt: string;
  robots: RobotsVerdict[];
  feeds: { productsJson: CheckResult; sitemap: CheckResult & { productUrlCount: number }; llmsTxt: CheckResult };
  productPages: ProductPageResult[];
  checkout: CheckoutProbeResult;
};
```

- [ ] **Step 2: failing tests** — fixtures: (a) blanket `User-agent: * / Disallow: /`, (b) agent-specific deny (`User-agent: GPTBot / Disallow: /` with `*` allowed), (c) allow-override (`Disallow: /` + `Allow: /products/`, evaluate path `/products/x` → allowed; longest match wins), (d) multi-agent group header lines, (e) empty/missing file → all allowed, (f) case-insensitive agent token match.

- [ ] **Step 3: implement** — `parseRobots(txt): RobotsGroup[]` (`{ agents: string[], rules: { type: "allow"|"disallow", path: string }[] }`; consecutive `User-agent` lines share a group; ignore comments/blank lines and non-robots directives). `evaluateAgentAccess(groups, agentToken, path = "/")`: pick the group with an exact case-insensitive agent token, else the `*` group, else allowed; among matching rules pick longest path prefix; tie → allow; empty disallow value = allow. `auditRobots(baseUrl, fetcher)`: fetch `/robots.txt` (404/empty → all 13 agents allowed, note it), return `RobotsVerdict[]` for `AGENT_UA_TOKENS`.

- [ ] **Step 4: run → PASS**; commit — `feat: robots.txt parser with per-agent access verdicts`

---

### Task 11: Feed checks (products.json, sitemap, llms.txt)

**Files:** Create: `src/readiness/feeds.ts`, `tests/readiness/feeds.test.ts`

- [ ] **Step 1: failing tests** with stub fetcher: products.json 200-with-`products`-array → pass; 404/401/HTML-login → fail with note; llms.txt 200 → pass; sitemap index → follows child sitemaps containing `product`, extracts `/products/` locs, caps at 10, returns count; flat sitemap also works; malformed XML → fail with note (no throw).
- [ ] **Step 2: implement** — `<loc>` extraction via regex (`/<loc>\s*(.*?)\s*<\/loc>/g`); fetch at most 3 child sitemaps; functions: `checkProductsJson(base, f)`, `checkLlmsTxt(base, f)`, `checkSitemap(base, f): Promise<{ result: CheckResult & { productUrlCount: number }; productUrls: string[] }>`.
- [ ] **Step 3: Commit** — `feat: storefront feed checks for products.json, sitemap and llms.txt`

---

### Task 12: Product page validation (JSON-LD / OG / canonical)

**Files:** Create: `src/readiness/product-page.ts`, `tests/readiness/product-page.test.ts`, `tests/fixtures/product-good.html`, `tests/fixtures/product-bad.html`

- [ ] **Step 1: fixtures** — `product-good.html`: realistic Shopify-ish page with `application/ld+json` `@graph` containing a `Product` (offers with price/priceCurrency/availability, sku, image), `og:title`/`og:image` metas, canonical link. `product-bad.html`: JSON-LD present but offers missing priceCurrency + no sku/gtin, no canonical, broken second ld+json block (invalid JSON).
- [ ] **Step 2: failing tests** — good page → all booleans true, problems empty; bad page → specific problems listed (`offer missing priceCurrency`, `product missing sku/gtin`, `missing canonical`, `unparseable ld+json block`); page with no Product node → `jsonLd.found === false`; Product as array `@type: ["Product","Thing"]` handled; offer-level `gtin13` satisfies skuOrGtin.
- [ ] **Step 3: implement** — `extractJsonLdBlocks(html)` regex over script tags + tolerant JSON.parse; `findProductNode(blocks)` walks arrays and `@graph`; `validateProductPage(html, url): ProductPageResult` checks Product/Offer fields (price, priceCurrency, availability, sku||gtin8/12/13/14 at product or offer level, image), OG via `<meta property="og:…"`, canonical via `<link rel="canonical"`. Pure (string in, result out).
- [ ] **Step 4: Commit** — `feat: json-ld product schema, og and canonical validation`

---

### Task 13: Playwright checkout probe

**Files:** Create: `src/readiness/detect.ts`, `src/readiness/checkout.ts`, `tests/readiness/detect.test.ts`

- [ ] **Step 1: pure detectors first (TDD-able)** — `detect.ts`:

```ts
export const CAPTCHA_MARKERS = ["recaptcha", "hcaptcha", "cf-turnstile", "challenges.cloudflare.com", "arkoselabs", "px-captcha"];
export function detectCaptcha(html: string): boolean;          // marker substring, case-insensitive
export function detectPasswordPage(url: string, html: string): boolean; // /password path or form action*="/password"
export function detectLoginWall(url: string): boolean;          // /account/login redirect
export const POPUP_DIALOG_SELECTORS = ['[role="dialog"]', '[aria-modal="true"]', ".modal[class*='open']", "#shopify-pc__banner"];
export const CLOSE_BUTTON_SELECTORS = ['[aria-label*="close" i]', 'button[class*="close" i]', '[data-testid*="close" i]'];
```

Tests over HTML/URL strings for each detector.

- [ ] **Step 2: implement `probeCheckout(productUrl, artifactsDir, opts?)`** (integration — no unit test; structure for a gated smoke test):
  1. Launch chromium (headed=false; `opts.headed` override). Collect `page.on("pageerror")` into `jsErrors`.
  2. `goto` product page (fall back: if `detectPasswordPage` → record `password_page` blocker, stop). Screenshot `01-product.png`.
  3. Detect/close popups (`POPUP_DIALOG_SELECTORS` visible → try `CLOSE_BUTTON_SELECTORS` + `Escape`; record `popup` blocker either way).
  4. Select first available variant: enabled options in `select[name^="options"]` / non-disabled variant radios / Shopify `variant-selects`; record `variant` blocker if all sold out.
  5. Add to cart: `form[action*="/cart/add"] [type=submit]:not([disabled])`, `button[name="add"]`. Then `goto /cart` → `reachedCart` when cart row visible. Screenshot `02-cart.png`.
  6. Click `button[name="checkout"], a[href*="checkout"], [data-testid*="checkout"]`. Success = URL matches `/checkouts/` AND an email/contact field is visible → `reachedCheckout = true`, `timeToCheckoutMs` recorded. Screenshot `03-checkout.png`.
  7. **HARD STOP. Never fill any field on checkout. Never proceed past the information page.** (Comment in code; no payment selectors anywhere.)
  8. Each stage wrapped in try/catch → on failure record blocker (`captcha` if `detectCaptcha(await page.content())`, else `timeout`/`not_found`) and return partial result. Overall budget 90s.
- [ ] **Step 3: gated smoke test** — `tests/readiness/checkout.smoke.test.ts` runs only when `SMOKE_STORE_URL` env is set (`it.skipIf`); asserts result shape. CI-safe.
- [ ] **Step 4: `pnpm --filter @agentaudit/audit exec playwright install chromium`** documented in README; commit — `feat: playwright checkout probe with blocker detection, hard-stop at checkout info`

---

### Task 14: `audit readiness` command

**Files:** Create: `src/commands/readiness.ts`; Modify: `src/cli.ts`; Test: `tests/commands/readiness.test.ts`

- [ ] **Step 1: failing test** — orchestrator accepts injected fetcher + probe stub; given stubs, writes `data/<store>/readiness.json` matching the `ReadinessReport` shape (zod-validate in test).
- [ ] **Step 2: implement** — `audit readiness <store-url> [--max-pages 10] [--skip-checkout]`: throttled fetcher (1 req/s) → robots → feeds → up to `--max-pages` product pages from sitemap (validated with `validateProductPage`) → `probeCheckout` on the first product URL (screenshots to `artifacts/<store>/`) → assemble `ReadinessReport` → write JSON; print compact pass/fail table.
- [ ] **Step 3: Commit** — `feat: audit readiness command writing per-store readiness.json`

---

### Task 15: Manual runs YAML (`audit manual`)

**Files:** Create: `src/manual/schema.ts`, `src/commands/manual.ts`; Modify: `src/cli.ts`; Test: `tests/manual/schema.test.ts`, `tests/fixtures/manual-runs.yaml`

- [ ] **Step 1: failing tests** — valid file parses; `outcome: abandoned` without `failure_stage` → error naming the field and run index; bad enum value → readable zod error.
- [ ] **Step 2: schema**

```ts
import { z } from "zod";

export const manualRunSchema = z.object({
  agent: z.enum(["chatgpt", "perplexity", "claude"]),
  task: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  outcome: z.enum(["success", "abandoned"]),
  failure_stage: z.enum(["discovery", "product_page", "variant", "cart", "checkout", "payment"]).optional(),
  notes: z.string().optional(),
  screenshots: z.array(z.string()).default([]),
}).superRefine((run, ctx) => {
  if (run.outcome === "abandoned" && !run.failure_stage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["failure_stage"], message: "failure_stage is required when outcome is abandoned" });
  }
});

export const manualRunsFileSchema = z.object({
  store: z.string().min(1),
  runs: z.array(manualRunSchema).min(1),
});

export type ManualRun = z.infer<typeof manualRunSchema>;
export type ManualRunsFile = z.infer<typeof manualRunsFileSchema>;
```

Fixture YAML: 3 runs (chatgpt success; perplexity abandoned at `variant`; claude abandoned at `checkout` with notes + screenshot paths).

- [ ] **Step 3: command** — `audit manual --store <domain> --file <yaml>`: parse with `yaml`, validate, write `data/<store>/manual-runs.json` (and copy the YAML alongside); print per-agent outcome summary. Export an `index.ts` from the package re-exporting types + schemas for the report package.
- [ ] **Step 4: Commit** — `feat: manual agent-run yaml schema and merge command`

---

### Task 16: packages/report scaffold + scoring

**Files:** Create: `packages/report/{package.json,tsconfig.json,vitest.config.ts}`, `src/types.ts`, `src/score.ts`, `tests/score.test.ts`

- [ ] **Step 1: scaffold** — package `@agentaudit/report`, bin `report`, deps: `commander`, `playwright`, `yaml`, `zod`, `@agentaudit/audit: workspace:*`; same scripts as audit package.
- [ ] **Step 2: types**

```ts
import type { ClassifyOutput, ManualRun, ReadinessReport } from "@agentaudit/audit";

export type StoreMeta = { name: string; domain: string; gmvBand: string; contact: string };
export type ReportData = {
  meta: StoreMeta;
  readiness: ReadinessReport;
  classify: ClassifyOutput;
  manualRuns: ManualRun[];
  generatedAt: string;
};
```

- [ ] **Step 3: failing score tests** — perfect inputs → 100; all-fail → 0; component math: robots = allowedAgents/13 × 10; structuredData = mean over pages of presentRequiredFields/5 × 15; feeds = 5×productsJson + 5×sitemap; llmsTxt = 5; cart 20; checkout 20; manual = successes/runs × 20 (no runs → 0 with detail note). Weights injectable; default sums to 100 (assert).
- [ ] **Step 4: implement**

```ts
export type WeightsConfig = {
  discovery: { robots: number; structuredData: number; feeds: number; llmsTxt: number };
  transaction: { cartReachable: number; checkoutReachable: number; manualOutcomes: number };
};
export const DEFAULT_WEIGHTS: WeightsConfig = {
  discovery: { robots: 10, structuredData: 15, feeds: 10, llmsTxt: 5 },
  transaction: { cartReachable: 20, checkoutReachable: 20, manualOutcomes: 20 },
};
export type ScorePart = { key: string; label: string; earned: number; max: number; detail: string };
export function computeScore(data: Pick<ReportData, "readiness" | "manualRuns">, weights = DEFAULT_WEIGHTS): { total: number; parts: ScorePart[] };
```

- [ ] **Step 5: Commit** — `feat: report package with weighted agent readiness score`

---

### Task 17: Inline SVG charts

**Files:** Create: `src/charts.ts`, `tests/charts.test.ts`

- [ ] **Step 1: failing tests** — output starts `<svg`, one `<rect>` per bar, widths proportional to values (parse attrs), labels and display values escaped (`<` → `&lt;`), zero-max guard.
- [ ] **Step 2: implement** — `hBarChart(bars: { label: string; value: number; display: string }[], opts?: { width?: number; accent?: string }): string` — horizontal bars, label column, value right-aligned, no external fonts (inherits document font). Pure string builder + `escapeXml()`.
- [ ] **Step 3: Commit** — `feat: dependency-free inline svg bar charts`

---

### Task 18: Findings + fix list generators

**Files:** Create: `src/findings.ts`, `src/fixlist.ts`, `tests/findings.test.ts`, `tests/fixlist.test.ts`

- [ ] **Step 1: failing tests** — findings: given a ReportData with GPTBot blocked + checkout unreached + 4.1% agent GMV + above_standard VAMP band, sentences include each fact as plain prose (assert substrings like `"4 of 13 agent user-agents are blocked"`, `"No automated path reached checkout"`); given clean data → positive sentences, never empty. Fix list: blocked robots → high impact/low effort item ranked above llms.txt item; ranking = impact/effort descending, ties by impact; every failed check maps to exactly one item; passing checks produce none.
- [ ] **Step 2: implement** — `draftFindings(data, score): Finding[]` (`{ severity: "critical"|"warning"|"info", sentence: string }`) — template sentences from: robots verdicts, feeds, structured-data field gaps, checkout result + blockers, manual outcomes by agent/stage, agent GMV share, dispute delta, VAMP band + headroom. `buildFixList(data): FixItem[]` — static catalog keyed by check id: `{ title, impact: 1-5, effort: 1-5, rationale }`, e.g. robots-blocking (impact 5, effort 1), missing JSON-LD offer fields (4,2), products.json disabled (3,1), llms.txt (2,1), popup interstitial (4,2), captcha on checkout (5,4), variant picker unparseable (4,3). Rank by `impact / effort` desc; expose both columns for the report table.
- [ ] **Step 3: Commit** — `feat: auto-drafted findings and impact-ranked fix list`

---

### Task 19: HTML template + PDF rendering

**Files:** Create: `src/template.ts`, `src/sections.ts`, `src/render.ts`, `tests/template.test.ts`

- [ ] **Step 1: failing template tests** — `renderReportHtml(data)` returns a full document containing: the store name, score `NN / 100`, all 7 section headings (Executive summary / Discovery layer / Transaction layer / Order classification / Dispute exposure / Fix list / Methodology & caveats), an `<svg` for the classification chart, the VAMP math line (e.g. `3 disputes ÷ 412 orders = 0.73%`), agent×stage table rows for each manual run, and **no `undefined`/`NaN` anywhere** (regex assert).
- [ ] **Step 2: implement** — `sections.ts`: one exported function per section (each <150 lines, takes typed slice of data + helpers). `template.ts`: composes head (embedded CSS: single column max-width 720px, print margins, `font-variant-numeric: tabular-nums` on numbers, dark-ink scorecard block at top with big score numeral and per-part bars), then sections in spec order. Methodology section states the confidence tiers honestly (confirmed vs high-confidence vs heuristic; heuristic = signals, not proof). `render.ts`:

```ts
import { chromium } from "playwright";

export async function htmlToPdf(html: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({ path: outPath, format: "Letter", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } });
  } finally { await browser.close(); }
}
```

- [ ] **Step 3: Commit** — `feat: report html template and playwright pdf rendering`

---

### Task 20: Report CLI + demo fixtures + `pnpm demo` (definition of done #1)

**Files:** Create: `src/cli.ts`, `src/load.ts`, `fixtures/demo-store/{readiness.json,classify.json,manual-runs.yaml,store.json}`; Modify: root `package.json` (already has `demo` script)

- [ ] **Step 1: fixtures** — generate honestly: run `audit classify` against the Task 6 fixture CSVs and copy the output JSON; hand-write `readiness.json` for fictional **Meridian Supply Co.** (`demo-store.example`, GMV band `$1M–$5M`): GPTBot+Bytespider+ClaudeBot blocked by robots, products.json ok, sitemap ok (8 pages sampled, 6 fully valid), llms.txt missing, cart reached, checkout reached with one popup blocker, 41s time-to-checkout; `manual-runs.yaml` = the Task 15 fixture content adapted (chatgpt success, perplexity abandoned at variant, claude abandoned at checkout).
- [ ] **Step 2: `load.ts`** — read + zod-validate the three inputs + `store.json` (StoreMeta); clear errors naming the offending file.
- [ ] **Step 3: CLI** — `report generate --data-dir <dir> --meta <store.json> --out <pdf>` and `report demo` (paths baked to `fixtures/demo-store`, output `<repo-root>/sample-report.pdf`). Demo runs: load → score → findings → fixlist → html → pdf.
- [ ] **Step 4: verify end-to-end**: `pnpm demo` from repo root → `sample-report.pdf` exists, >20KB; open-check the HTML snapshot in a test (`renderReportHtml` over loaded fixtures contains score). Visually inspect the PDF once (screenshot pages) — scorecard top, single column, charts render.
- [ ] **Step 5: Commit** — `feat: report cli with demo fixtures producing sample-report.pdf`

---

### Task 21: Site scaffold + marketing copy parsing

**Files:** Create: `apps/site/{package.json,next.config.mjs,tsconfig.json,vitest.config.ts}`, `src/lib/marketing.ts`, `src/lib/markdown.ts`, `tests/{marketing.test.ts,markdown.test.ts}`

- [ ] **Step 1: scaffold** — `next@^15`, `react`, `react-dom`; `next.config.mjs` = `{ output: "export" }`; scripts: `dev`, `build` (= `next build`), `typecheck`, `test`, `lint`, `e2e`. (next/react are the framework the spec names — not "new" dependencies; everything else stays out.)
- [ ] **Step 2: failing parser tests** — `marketing.ts`: `loadLandingCopy(mdPath)` extracts the seven `###` sections under `## Landing page copy` (Hero, Stats bar, What you get, How it works, Guarantee, FAQ, About) verbatim; throws naming any missing section. `markdown.ts`: block parser handles paragraphs, `**bold**` inline, ordered lists with bold leads, unordered lists, and the CTA line `**[Get the audit for $99]**` → `{ type: "cta", label: "Get the audit for $99" }` token; sub-line `Founding rate…` stays a paragraph. FAQ splitter: `**Q?**` bold-paragraph + following paragraphs → `{ q, a }[]`.
- [ ] **Step 3: implement both libs** (pure string → token functions, no deps), tests PASS.
- [ ] **Step 4: Commit** — `feat: site scaffold with verbatim marketing copy parser`

---

### Task 22: Landing page UI

**Files:** Create: `src/app/{layout.tsx,page.tsx,globals.css}`, `src/components/{Hero,StatsBar,WhatYouGet,HowItWorks,Guarantee,Faq,About,EmailCapture}.tsx`, `src/lib/counter.ts`

- [ ] **Step 1: page composition** — `page.tsx` (server component): `loadLandingCopy()` at build time; env: `const stripe = process.env.STRIPE_PAYMENT_LINK`, `const form = process.env.FORM_ENDPOINT`. CTA buttons → `<a href={stripe}>` when set; when unset render `EmailCapture` (plain HTML `<form method="POST" action={form}>`, email input + button — works with JS disabled, Formspree-style). All copy flows from the parser — no hardcoded marketing strings in components.
- [ ] **Step 2: design** (globals.css, no Tailwind): mobile-first single column; design tokens — ink `#0E0F12`, paper `#FAFAF7`, accent `#3F6212`-family signal green or deep indigo `#312E81` (pick one, used sparingly: CTA, score chips, rules); display type: system stack with tight tracking for the hero (`clamp(2.2rem, 8vw, 4rem)`); stats bar: dark band, `font-variant-numeric: tabular-nums`, big numerals; FAQ as native `<details>`; visible focus rings; **`cursor: pointer` on every clickable element** (global CLAUDE.md rule). Footer: "AgentAudit · run by Sidwyn Koh" + mailto. No cookie banner, no trackers.
- [ ] **Step 3: counter stub** — `lib/counter.ts`: `recordVisit()` that POSTs `{ path }` to `process.env.NEXT_PUBLIC_COUNTER_ENDPOINT` if set, else no-op; called from a tiny client component in layout. No cookies, no fingerprinting (comment).
- [ ] **Step 4: verify** — `pnpm --filter agentaudit-site build` → static `out/` with copy rendered (grep hero text in out/index.html). Both env permutations build (with/without STRIPE_PAYMENT_LINK).
- [ ] **Step 5: Commit** — `feat: agentaudit landing page with stripe cta and email fallback`

---

### Task 23: Site E2E (Playwright)

**Files:** Create: `playwright.config.ts`, `scripts/serve-static.mjs`, `tests/e2e/landing.spec.ts`

- [ ] **Step 1: static server** — ~30-line node http server for `out/` (content-type map, / → index.html). `playwright.config.ts` `webServer: node scripts/serve-static.mjs`.
- [ ] **Step 2: specs** — h1 equals hero headline; stats bar shows `1,200%`; CTA href equals STRIPE_PAYMENT_LINK when build had it; email form posts to FORM_ENDPOINT when not; FAQ toggles; mobile viewport (390px) has no horizontal overflow.
- [ ] **Step 3: run** `pnpm --filter agentaudit-site e2e` → PASS. Commit — `test: e2e coverage for landing page`

---

### Task 24: Makefile scrub + README runbook

**Files:** Create: `Makefile`, `README.md`

- [ ] **Step 1: Makefile**

```make
.PHONY: scrub
scrub:
ifndef STORE
	$(error STORE is required: make scrub STORE=<domain>)
endif
	rm -rf "data/$(STORE)" "artifacts/$(STORE)"
	@echo "scrubbed data/$(STORE) and artifacts/$(STORE)"
```

- [ ] **Step 2: README** — sections: What this is (one paragraph); Setup (`pnpm install`, `pnpm exec playwright install chromium`); **Runbook: one audit in <2 hours** — timed checklist: (0:00) intake answers → (0:05) `audit readiness https://store.com` → (0:20) merchant token received → `audit classify --shop x.myshopify.com --token AGENTAUDIT_SHOP_TOKEN` → (0:40) manual agent runs in ChatGPT/Perplexity/Claude recording YAML per schema → (1:20) `audit manual --store … --file runs.yaml` → `report generate …` → (1:40) review PDF, send + book readout → `make scrub STORE=…` after delivery; **Merchant guide (non-technical, copy-paste-able):** Shopify admin → Settings → Apps and sales channels → Develop apps → Allow custom app development → Create app "AgentAudit (read-only)" → Configure Admin API scopes → tick **read_orders** and **read_shopify_payments_disputes** only → Install app → Reveal token once → send via the secure channel we give you (never email) → revoke after delivery (uninstall the app); CSV fallback column spec; data handling (everything under data/ + artifacts/, gitignored, `make scrub`); demo (`pnpm demo`); CIDR refresh (`tsx scripts/update-cidrs.ts`).
- [ ] **Step 3: Commit** — `docs: runbook, merchant token guide and scrub task`

---

### Task 25: Deploy preview (user request: "start a deploy, I want to see how it looks")

**Files:** none new (deploy config only if the platform needs it)

- [ ] **Step 1:** local proof first — build site, serve `out/`, capture full-page screenshots (mobile + desktop) into `artifacts/site-preview/` and show the user.
- [ ] **Step 2:** check `gh auth status`. If authenticated: create private GitHub repo `agentaudit`, push branch, deploy `out/` to GitHub Pages (actions workflow or `gh api` upload). If not: ask user to pick Vercel/Netlify and provide auth — blocked on user input at that point, everything else done.
- [ ] **Step 3:** report the preview URL. Note: STRIPE_PAYMENT_LINK unset on preview → email-capture variant is what renders (state this to the user).

---

### Task 26: Final verification (definition of done)

- [ ] `pnpm demo` from a clean checkout (`git stash -u` sanity) generates `sample-report.pdf` from fixtures — zero credentials.
- [ ] `audit classify --orders … --disputes … --store demo-store.example` runs against the sample CSVs and writes classify.json.
- [ ] `pnpm --filter agentaudit-site build && node apps/site/scripts/serve-static.mjs` serves the page with marketing copy rendered.
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint` all green; `git status` clean; no merchant data or secrets tracked (`git ls-files | grep -E '^(data|artifacts)/'` → only .gitkeep).
- [ ] Run superpowers:requesting-code-review against the spec, fix anything found, then report completion honestly.

---

## Self-review (performed while writing)

- **Spec coverage:** robots per 13 UAs ✔ (T10), feeds ✔ (T11), JSON-LD/OG/canonical 10 pages @1req/s ✔ (T12, T9, T14), Playwright probe + blockers + screenshots + hard stop ✔ (T13), readiness.json ✔ (T14); classify API+CSV ✔ (T7, T6, T8), 4 tiers ✔ (T4), dispute join + GMV share + delta + VAMP ✔ (T5), pure functions + fixture tests ✔ (T4–T5); manual YAML schema + validate + merge ✔ (T15); report inputs/score weights/sections/SVG/PDF/demo fixtures ✔ (T16–T20); site verbatim copy/CTA env/email fallback/design/counter stub ✔ (T21–T23); scrub + README runbook + merchant guide ✔ (T24); deploy request ✔ (T25); definition of done ✔ (T26, T8 step 3, T20 step 4).
- **Placeholder scan:** none — every step names exact files, code, or exact content lists.
- **Type consistency:** `OrderRecord/DisputeRecord/Classification` defined T4, consumed T5–T8; `ReadinessReport/CheckResult/Blocker/ProductPageResult/CheckoutProbeResult` defined T10, consumed T11–T14, T16; `ManualRun` defined T15, consumed T16/T19; `ClassifyOutput` defined T5, consumed T16/T19/T20. Checked.
