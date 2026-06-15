import type { ManualRun } from "./schema.js";

// Tier-2 human-in-the-loop: generate one copy-paste prompt per assistant, each
// ending with a strict, parseable RESULT line, then parse the pasted replies
// back into ManualRun entries for the report's per-agent matrix.

export const PROMPT_AGENTS: { key: "chatgpt" | "perplexity" | "claude" | "gemini"; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT (agent mode)" },
  { key: "perplexity", label: "Perplexity" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
];

const STAGES = "discovery | product_page | variant | cart | checkout | payment";

export function defaultTask(store: string): string {
  return `Buy any in-stock product from ${store} and get as far as the payment step`;
}

export function buildAgentPrompt(
  agentKey: string,
  store: string,
  opts: { product?: string; task?: string } = {},
): string {
  const task = opts.task ?? defaultTask(store);
  const target = opts.product ? `this product: ${opts.product}` : `any in-stock product on https://${store}`;
  return [
    `You are acting as a shopping assistant buying on behalf of a user. Task: ${task}.`,
    ``,
    `Attempt to purchase ${target}, going as far as you can. Take a SCREENSHOT AT EVERY STEP — one per stage, even if a step fails:`,
    `1. Product page loaded — screenshot it. Save as ${agentKey}-1-product.png`,
    `2. Options/variant selected (size, color, etc.) — screenshot. Save as ${agentKey}-2-variant.png`,
    `3. Item added to cart (cart page or drawer) — screenshot. Save as ${agentKey}-3-cart.png`,
    `4. Checkout reached (contact/shipping filled if asked) — screenshot. Save as ${agentKey}-4-checkout.png`,
    `5. Payment step (card fields visible) — screenshot. Save as ${agentKey}-5-payment.png. STOP HERE: do NOT enter card details and do NOT place the order.`,
    `If you stall at any step, screenshot what you see and name it for that step (e.g. ${agentKey}-2-variant.png).`,
    ``,
    `Where to put screenshots: save every screenshot into the folder inbox/${store}/ in the repo. If you cannot save files, keep/attach each screenshot so it can be dropped into inbox/${store}/ by hand.`,
    ``,
    `Rules: do not solve or bypass any CAPTCHA or bot check — if you hit one, screenshot it, stop, and report it. If you get stuck, note exactly where and why.`,
    ``,
    `When finished, end your reply with EXACTLY one line in this format:`,
    `RESULT | agent: ${agentKey} | outcome: <success|abandoned> | furthest_stage: <${STAGES}> | blocker: <short description or none> | notes: <one short sentence>`,
    `- outcome=success = you reached the checkout or payment step without placing an order.`,
    `- outcome=abandoned = you could not get that far; set furthest_stage to the last stage you reached.`,
  ].join("\n");
}

export function buildAgentPrompts(
  store: string,
  opts: { product?: string; task?: string } = {},
): { agent: string; label: string; prompt: string }[] {
  return PROMPT_AGENTS.map((a) => ({
    agent: a.key,
    label: a.label,
    prompt: buildAgentPrompt(a.key, store, opts),
  }));
}

const STAGE_VALUES = ["discovery", "product_page", "variant", "cart", "checkout", "payment"] as const;
type Stage = (typeof STAGE_VALUES)[number];

function field(parts: Map<string, string>, key: string): string {
  return (parts.get(key) ?? "").trim();
}

// Parse pasted agent replies. Tolerant of surrounding markdown/code fences;
// scans for the RESULT line(s) and builds one ManualRun per recognized agent.
export function parseReplies(text: string, opts: { task?: string } = {}): ManualRun[] {
  const runs: ManualRun[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const m = rawLine.match(/RESULT\s*\|(.+)$/i);
    if (!m) continue;
    const parts = new Map<string, string>();
    for (const seg of m[1]!.split("|")) {
      const idx = seg.indexOf(":");
      if (idx === -1) continue;
      parts.set(seg.slice(0, idx).trim().toLowerCase(), seg.slice(idx + 1).trim().replace(/[`*]+$/g, ""));
    }
    const agent = field(parts, "agent").toLowerCase();
    // accept any assistant token (chatgpt, perplexity, claude, gemini, codex, rufus, ...)
    if (!/^[a-z0-9][a-z0-9 ._-]*$/.test(agent) || seen.has(agent)) continue;
    seen.add(agent);

    const outcome = field(parts, "outcome").toLowerCase() === "success" ? "success" : "abandoned";
    const stageRaw = field(parts, "furthest_stage").toLowerCase().replace(/[\s-]+/g, "_");
    const stage: Stage = (STAGE_VALUES as readonly string[]).includes(stageRaw) ? (stageRaw as Stage) : "discovery";
    const blocker = field(parts, "blocker");
    const notes = field(parts, "notes");

    const steps = [
      `Live ${agent} run (human-in-the-loop, pasted result).`,
      `Furthest stage reached: ${stage.replace(/_/g, " ")}.`,
      blocker && blocker.toLowerCase() !== "none" ? `Blocker: ${blocker}` : `No blocker reported.`,
    ];

    runs.push({
      agent: agent as ManualRun["agent"],
      task: opts.task ?? "Buy a product and reach the payment step",
      steps,
      outcome,
      ...(outcome === "abandoned" ? { failure_stage: stage } : {}),
      notes: [notes, blocker && blocker.toLowerCase() !== "none" ? `Blocker: ${blocker}` : ""]
        .filter(Boolean)
        .join(" — ") || undefined,
      screenshots: [],
    });
  }
  return runs;
}
