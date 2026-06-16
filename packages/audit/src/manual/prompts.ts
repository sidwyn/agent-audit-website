import { BLOCKER_CODES, FUNNEL_STAGES, type CapabilityCheckResult, type CheckStatus, type ManualRun, type ObstacleResult } from "./schema.js";
import type { BlockerCode, FunnelStageName } from "./schema.js";
import { CAPABILITY_CHECKS, CHECK_KEYS, OBSTACLE_KEYS } from "./checklist.js";

// Tier-2 human-in-the-loop: generate one copy-paste prompt per assistant that
// walks the FULL shopping funnel and fills a ~40-action capability checklist +
// obstacles, then parse the structured reply back into a ManualRun. The report
// renders one capability table per agent from it.

export const PROMPT_AGENTS: { key: "codex" | "perplexity" | "claude" | "gemini"; label: string }[] = [
  { key: "codex", label: "Codex" },
  { key: "perplexity", label: "Perplexity" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
];

// What to test at each funnel stage — the human-readable section guidance.
const STAGE_TESTS: { stage: FunnelStageName; test: string }[] = [
  { stage: "homepage", test: "can you read the nav, search box, and categories?" },
  { stage: "search", test: "can you search for a product and get usable results?" },
  { stage: "collection", test: "can you read the product grid, filters, and sorting?" },
  { stage: "product", test: "can you read title, options, price, availability, reviews, shipping & returns?" },
  { stage: "variant", test: "can you pick the required options (color/size/material/add-ons)? Did add-to-cart stay disabled until you did?" },
  { stage: "add_to_cart", test: "does the add-to-cart button work?" },
  { stage: "cart", test: "can you read the cart/drawer and edit quantity, remove an item, or apply a discount?" },
  { stage: "checkout_info", test: "can you fill email, shipping address, and phone? (use clearly-fake @example.com test data)" },
  { stage: "shipping", test: "can you choose a shipping method?" },
  { stage: "payment_boundary", test: "do you reach the card screen and STOP safely? (do NOT enter card details, do NOT place the order)" },
  { stage: "confirmation", test: "would the order-confirmation page be parseable? (you stop before paying — answer na if you can't tell)" },
];

// Agent-specific guidance (may reference the store's inbox folder). Claude runs
// via the real Claude Chrome extension (a logged-in browser session) to avoid the
// bot-detection wall a CDP browser hits; Perplexity sandboxes its files, so it's
// told to get the screenshots out to the local folder or into the chat reply.
const AGENT_NOTES: Record<string, (store: string) => string> = {
  claude: () => "Use the Claude Chrome extension to achieve this.",
  perplexity: (store) =>
    `Perplexity saves files to its own sandbox — copy/download each screenshot into inbox/${store}/ in the repo. If you cannot write to the repo, attach or inline every screenshot directly in your chat reply so the operator can save them.`,
};

const BLOCKER_LIST = BLOCKER_CODES.join(" | ");
const STAGE_NAMES = FUNNEL_STAGES.join(" | ");
const keysFor = (stage: FunnelStageName): string =>
  CAPABILITY_CHECKS.filter((c) => c.section === stage).map((c) => `${c.section}.${c.key}`).join(", ");

export function defaultTask(store: string): string {
  return `Buy any in-stock product from ${store} and get as far as the payment step`;
}

export function buildAgentPrompt(
  agentKey: string,
  store: string,
  opts: { product?: string; task?: string; productType?: string } = {},
): string {
  const task = opts.task ?? defaultTask(store);
  const agentName = agentKey.charAt(0).toUpperCase() + agentKey.slice(1);
  const target = opts.product ? `this product: ${opts.product}` : `any in-stock product on https://${store}`;
  const typeLine = `This run is testing the "${opts.productType}" product type — include "product_type: ${opts.productType}" in the RESULT line.`;
  return [
    `You are acting as a shopping assistant buying on behalf of a user. Task: ${task}.`,
    `You MUST use a real, non-headless browser. Headless browsers are NOT allowed for this test — they get blocked by bot protection and do not reflect a real shopper.`,
    `If you create a new browser group, profile, or window in Chrome for this run, append " - ${agentName}" to its name (e.g. "Shopping - ${agentName}") so the operator can tell which agent is which.`,
    ...(AGENT_NOTES[agentKey] ? [AGENT_NOTES[agentKey]!(store)] : []),
    ...(opts.productType ? [typeLine] : []),
    ``,
    `Note the START TIME before you begin. You will report how many seconds it took to get the item into the cart.`,
    ``,
    `Walk the FULL shopping funnel on ${store}, attempting to buy ${target}, going as far as you can. STOP before payment. Work through the 11 sections below; for each, CAPTURE A SCREENSHOT and judge each individual check (the dotted keys) as pass / fail / partial / blocked / na:`,
    ...STAGE_TESTS.map(
      (s, i) =>
        `${i + 1}. ${s.stage} — ${s.test}\n   Screenshot: ${agentKey}-${i + 1}-${s.stage}.png\n   checks: ${keysFor(s.stage)}`,
    ),
    ``,
    `Also watch for OBSTACLES: cookie banner, email/SMS popup, a modal you couldn't close, a cart drawer you couldn't parse, a sticky add-to-cart bar, a login wall, address/phone validation errors, disabled buttons, iframe or cross-domain checkout. If you hit a CAPTCHA, Cloudflare, or bot check, do NOT solve or bypass it — screenshot it, stop, and report it.`,
    ``,
    `Screenshots: save every screenshot into the folder inbox/${store}/ in the repo. If you (the model) cannot save files, the operator will capture them — capture just the STORE BROWSER PAGE (crop to the page, not the whole desktop).`,
    ``,
    `Report your results in THREE parts.`,
    ``,
    `PART 1 — CHECKLIST: one line per check you attempted, using the EXACT dotted keys above. Format:`,
    `<section.key>: <pass|fail|partial|blocked|na> | <optional short note>`,
    `(pass = worked; fail = tried but broke; partial = worked but clunky/uncertain; blocked = couldn't, due to an obstacle; na = not applicable.) Example:  product.price: pass | $76, clearly shown`,
    ``,
    `PART 2 — OBSTACLES: list ONLY the ones you actually hit, one per line, using these keys:`,
    `cookie_banner | email_sms_popup | uncloseable_modal | cart_drawer_unparsed | sticky_atc | login_wall | address_validation_error | phone_validation_error | disabled_buttons | iframe_issue | cross_domain_checkout | captcha_cloudflare_bot`,
    `Format:  <obstacle_key>: <short note>`,
    ``,
    `PART 3 — exactly one summary line:`,
    `RESULT | agent: ${agentKey} | model: <the exact model/version you are, e.g. Gemini 2.5 Pro, GPT-5, Claude Opus 4.8> | outcome: <success|abandoned> | furthest_stage: <${STAGE_NAMES}> | time_to_cart_seconds: <integer seconds from opening the product to the item being in the cart, or none> | blocker_code: <${BLOCKER_LIST}> | blocker: <short description or none> | notes: <one short sentence>`,
    `- outcome=success = you reached the checkout or payment step without placing an order.`,
    `- outcome=abandoned = you could not get that far; set furthest_stage to the last stage reached and blocker_code to the precise reason.`,
  ].join("\n");
}

export function buildAgentPrompts(
  store: string,
  opts: { product?: string; task?: string; productType?: string } = {},
): { agent: string; label: string; prompt: string }[] {
  return PROMPT_AGENTS.map((a) => ({
    agent: a.key,
    label: a.label,
    prompt: buildAgentPrompt(a.key, store, opts),
  }));
}

const STAGE_STATUS = ["pass", "fail", "partial", "skipped", "na"] as const;
type StageStatus = (typeof STAGE_STATUS)[number];
const CHECK_STATUS = ["pass", "fail", "partial", "blocked", "na"] as const;

// Coarse failure_stage (the legacy enum the matrix/funnel read) derived from a
// fine-grained funnel stage so the older report logic keeps working.
const COARSE_STAGE = ["discovery", "product_page", "variant", "cart", "checkout", "payment"] as const;
type CoarseStage = (typeof COARSE_STAGE)[number];
const FUNNEL_TO_COARSE: Record<FunnelStageName, CoarseStage> = {
  homepage: "discovery",
  search: "discovery",
  collection: "discovery",
  product: "product_page",
  variant: "variant",
  add_to_cart: "cart",
  cart: "cart",
  checkout_info: "checkout",
  shipping: "checkout",
  payment_boundary: "payment",
  confirmation: "payment",
};

function field(parts: Map<string, string>, key: string): string {
  return (parts.get(key) ?? "").trim();
}

function splitFields(segment: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const seg of segment.split("|")) {
    const idx = seg.indexOf(":");
    if (idx === -1) continue;
    parts.set(seg.slice(0, idx).trim().toLowerCase(), seg.slice(idx + 1).trim().replace(/[`*]+$/g, ""));
  }
  return parts;
}

function normalizeStage(raw: string): { funnel?: FunnelStageName; coarse: CoarseStage } {
  const v = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if ((FUNNEL_STAGES as readonly string[]).includes(v)) {
    const funnel = v as FunnelStageName;
    return { funnel, coarse: FUNNEL_TO_COARSE[funnel] };
  }
  if ((COARSE_STAGE as readonly string[]).includes(v)) return { coarse: v as CoarseStage };
  return { coarse: "discovery" };
}

// Parse a "section.key: status | note" capability line. Returns null if it isn't
// a recognized check.
function parseCheckLine(line: string): CapabilityCheckResult | null {
  const m = line.match(/(?:^|[\s>*`-])([a-z_]+\.[a-z_]+)\s*:\s*([a-z_]+)\b\s*(?:\|\s*(.*))?$/i);
  if (!m) return null;
  const id = m[1]!.toLowerCase();
  if (!CHECK_KEYS.has(id)) return null;
  let status = m[2]!.toLowerCase();
  if (status === "skipped") status = "na";
  if (!(CHECK_STATUS as readonly string[]).includes(status)) return null;
  const [section, key] = id.split(".") as [string, string];
  const note = (m[3] ?? "").trim().replace(/[`*]+$/g, "");
  return { section, key, status: status as CheckStatus, ...(note ? { note } : {}) };
}

// Parse an "obstacle_key: note" line. Returns null if the key isn't a known obstacle.
function parseObstacleLine(line: string): ObstacleResult | null {
  const m = line.match(/(?:^|[\s>*`-])([a-z_]+)\s*:\s*(.*)$/i);
  if (!m) return null;
  const key = m[1]!.toLowerCase();
  if (!OBSTACLE_KEYS.has(key)) return null;
  const note = (m[2] ?? "").trim().replace(/[`*]+$/g, "");
  return { key, hit: true, ...(note && !/^(no|none|n\/?a)$/i.test(note) ? { note } : {}) };
}

// Roll a section's individual checks up into one stage status for the legacy
// stages[] field (which the funnel/matrix read).
function rollupStages(checks: CapabilityCheckResult[]): { stage: FunnelStageName; status: StageStatus }[] {
  const out: { stage: FunnelStageName; status: StageStatus }[] = [];
  for (const stage of FUNNEL_STAGES) {
    const inSection = checks.filter((c) => c.section === stage).map((c) => c.status);
    if (inSection.length === 0) continue;
    let status: StageStatus;
    if (inSection.some((s) => s === "blocked")) status = "fail";
    else if (inSection.every((s) => s === "na")) status = "na";
    else if (inSection.every((s) => s === "pass" || s === "na")) status = "pass";
    else if (inSection.every((s) => s === "fail" || s === "na")) status = "fail";
    else status = "partial";
    out.push({ stage, status });
  }
  return out;
}

// Parse pasted agent replies. Tolerant of markdown/code fences. Collects the
// CHECKLIST + OBSTACLES blocks and the RESULT line. One ManualRun per agent.
// NOTE: the structured blocks aren't agent-scoped, so they attach to the run in
// this reply — agents are run one at a time (one reply per agent).
export function parseReplies(text: string, opts: { task?: string } = {}): ManualRun[] {
  const lines = text.split(/\r?\n/);

  const checks: CapabilityCheckResult[] = [];
  const obstacles: ObstacleResult[] = [];
  const stageLines: { stage: FunnelStageName; status: StageStatus; note?: string }[] = [];
  const seenObstacle = new Set<string>();
  for (const line of lines) {
    if (/RESULT\s*\|/i.test(line)) continue;
    const check = parseCheckLine(line);
    if (check) {
      checks.push(check);
      continue;
    }
    // Legacy "stage: <name> | status: <s>" lines (older prompt format).
    const sm = line.match(/(?:^|[\s>*`-])stage\s*:\s*(.+)$/i);
    if (sm) {
      const parts = splitFields(`stage: ${sm[1]}`);
      const { funnel } = normalizeStage(field(parts, "stage"));
      if (funnel) {
        const statusRaw = field(parts, "status").toLowerCase();
        const status = (STAGE_STATUS as readonly string[]).includes(statusRaw)
          ? (statusRaw as StageStatus)
          : "partial";
        stageLines.push({ stage: funnel, status });
      }
      continue;
    }
    const obstacle = parseObstacleLine(line);
    if (obstacle && !seenObstacle.has(obstacle.key)) {
      seenObstacle.add(obstacle.key);
      obstacles.push(obstacle);
    }
  }
  // Prefer the fine-grained checklist rollup; fall back to legacy stage lines.
  const stages = checks.length > 0 ? rollupStages(checks) : stageLines;

  const runs: ManualRun[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const m = rawLine.match(/RESULT\s*\|(.+)$/i);
    if (!m) continue;
    const parts = splitFields(m[1]!);
    const agent = field(parts, "agent").toLowerCase();
    if (!/^[a-z0-9][a-z0-9 ._-]*$/.test(agent) || seen.has(agent)) continue;
    seen.add(agent);

    const outcome = field(parts, "outcome").toLowerCase() === "success" ? "success" : "abandoned";
    const { coarse } = normalizeStage(field(parts, "furthest_stage"));
    const blocker = field(parts, "blocker");
    const notes = field(parts, "notes");

    const modelRaw = field(parts, "model");
    const model = modelRaw && !/^(none|n\/?a|unknown)$/i.test(modelRaw) ? modelRaw : undefined;
    const secsRaw = field(parts, "time_to_cart_seconds").match(/\d+(\.\d+)?/);
    const secondsToCart = secsRaw ? Number(secsRaw[0]) : undefined;

    const codeRaw = field(parts, "blocker_code").toLowerCase().replace(/[\s-]+/g, "_");
    const blockerCode: BlockerCode | undefined = (BLOCKER_CODES as readonly string[]).includes(codeRaw)
      ? (codeRaw as BlockerCode)
      : codeRaw
        ? "other"
        : undefined;
    const productType = field(parts, "product_type") || undefined;

    const steps = [
      `Live ${agent} run (human-in-the-loop, pasted result).`,
      `Furthest stage reached: ${coarse.replace(/_/g, " ")}.`,
      blocker && blocker.toLowerCase() !== "none" ? `Blocker: ${blocker}` : `No blocker reported.`,
    ];

    runs.push({
      agent: agent as ManualRun["agent"],
      ...(model ? { model } : {}),
      task: opts.task ?? "Buy a product and reach the payment step",
      steps,
      outcome,
      ...(secondsToCart != null ? { secondsToCart } : {}),
      stages,
      checks,
      obstacles,
      ...(productType ? { productType } : {}),
      ...(blockerCode ? { blockerCode } : {}),
      ...(outcome === "abandoned" ? { failure_stage: coarse } : {}),
      notes:
        [notes, blocker && blocker.toLowerCase() !== "none" ? `Blocker: ${blocker}` : ""]
          .filter(Boolean)
          .join(" — ") || undefined,
      screenshots: [],
    });
  }
  return runs;
}
