import { BLOCKER_CODES, FUNNEL_STAGES, type ManualRun } from "./schema.js";
import type { BlockerCode, FunnelStageName } from "./schema.js";

// Tier-2 human-in-the-loop: generate one copy-paste prompt per assistant that
// walks the FULL shopping funnel, then parse the structured reply (a per-stage
// STAGES block + one RESULT line) back into a ManualRun for the report.

export const PROMPT_AGENTS: { key: "chatgpt" | "perplexity" | "claude" | "gemini"; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT (agent mode)" },
  { key: "perplexity", label: "Perplexity" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
];

// What to test at each funnel stage — drives both the prompt and the report.
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

const BLOCKER_LIST = BLOCKER_CODES.join(" | ");
const STAGE_NAMES = FUNNEL_STAGES.join(" | ");

export function defaultTask(store: string): string {
  return `Buy any in-stock product from ${store} and get as far as the payment step`;
}

export function buildAgentPrompt(
  agentKey: string,
  store: string,
  opts: { product?: string; task?: string; productType?: string } = {},
): string {
  const task = opts.task ?? defaultTask(store);
  const target = opts.product ? `this product: ${opts.product}` : `any in-stock product on https://${store}`;
  const typeLine = `This run is testing the "${opts.productType}" product type — include "product_type: ${opts.productType}" in the RESULT line.`;
  return [
    `You are acting as a shopping assistant buying on behalf of a user. Task: ${task}.`,
    ...(opts.productType ? [typeLine] : []),
    ``,
    `Note the START TIME before you begin. You will report how many seconds it took to get the item into the cart.`,
    ``,
    `Walk the FULL shopping funnel on ${store}, attempting to buy ${target}, going as far as you can. STOP before payment. At EACH stage below, judge whether you could do it (pass / fail / partial / skipped / na), and CAPTURE A SCREENSHOT of that stage:`,
    ...STAGE_TESTS.map((s, i) => `${i + 1}. ${s.stage} — ${s.test} Screenshot: ${agentKey}-${i + 1}-${s.stage}.png`),
    ``,
    `Also watch for OBSTACLES and report any you hit: cookie banner, email/SMS popup, a modal you couldn't close, a cart drawer you couldn't parse, a sticky add-to-cart bar, a login wall, address/phone validation errors, disabled buttons, iframe or cross-domain checkout. If you hit a CAPTCHA, Cloudflare, or bot check, do NOT solve or bypass it — screenshot it, stop, and report it.`,
    ``,
    `Screenshots: save every screenshot into the folder inbox/${store}/ in the repo. If you (the model) cannot save files, the operator will capture them — in that case capture just the STORE BROWSER PAGE (crop to the page, not the whole desktop) so each shot clearly shows that stage on ${store}.`,
    ``,
    `Report your results in TWO parts. First, one STAGES line per stage you attempted:`,
    `stage: <${STAGE_NAMES}> | status: <pass|fail|partial|skipped|na> | note: <what you saw, or why it failed>`,
    ``,
    `Then end with EXACTLY one summary line:`,
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

// Parse pasted agent replies. Tolerant of surrounding markdown/code fences:
// collects any `stage: ... | status: ...` lines into a per-agent funnel map, and
// the RESULT line(s) into the headline. One ManualRun per recognized agent.
export function parseReplies(text: string, opts: { task?: string } = {}): ManualRun[] {
  const lines = text.split(/\r?\n/);

  // First pass: gather stage lines (they aren't agent-scoped in the format, so
  // they attach to the single run in this reply — agents are run one at a time).
  const stages: { stage: FunnelStageName; status: StageStatus; note?: string }[] = [];
  for (const line of lines) {
    const m = line.match(/(?:^|[\s>*`-])stage\s*:\s*(.+)$/i);
    if (!m || /RESULT\s*\|/i.test(line)) continue;
    const parts = splitFields(`stage: ${m[1]}`);
    const stageRaw = field(parts, "stage");
    const { funnel } = normalizeStage(stageRaw);
    if (!funnel) continue;
    const statusRaw = field(parts, "status").toLowerCase();
    const status: StageStatus = (STAGE_STATUS as readonly string[]).includes(statusRaw)
      ? (statusRaw as StageStatus)
      : "partial";
    const note = field(parts, "note");
    stages.push({ stage: funnel, status, ...(note ? { note } : {}) });
  }

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
