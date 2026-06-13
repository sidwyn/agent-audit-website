import type { ManualRun, ReadinessReport } from "@agentaudit/audit";

// Maps the 13 crawler/agent user-agents to the buyer-facing brands owners think
// in. Only ChatGPT/Perplexity/Claude can be live-tested today (manual run enum);
// every other row is access-inference only and is marked as such.
export const AGENT_BRANDS: { brand: string; uas: string[]; liveTestable: boolean }[] = [
  { brand: "ChatGPT (OpenAI)", uas: ["GPTBot", "ChatGPT-User", "OAI-SearchBot"], liveTestable: true },
  { brand: "Perplexity", uas: ["PerplexityBot", "Perplexity-User"], liveTestable: true },
  { brand: "Claude (Anthropic)", uas: ["ClaudeBot", "Claude-User", "Claude-SearchBot"], liveTestable: true },
  { brand: "Google (Gemini/AI)", uas: ["Google-Extended"], liveTestable: false },
  { brand: "Amazon (Rufus)", uas: ["Amazonbot"], liveTestable: false },
  { brand: "Apple Intelligence", uas: ["Applebot-Extended"], liveTestable: false },
  { brand: "Meta AI", uas: ["meta-externalagent"], liveTestable: false },
  // { brand: "ByteDance (TikTok)", uas: ["Bytespider"], liveTestable: false }, // disabled for now
];

export type Cell = "yes" | "no" | "partial" | "unknown";

export type AgentRow = {
  brand: string;
  liveTested: boolean;
  discover: Cell; // allowed by robots.txt
  readProduct: Cell; // structured data present on product pages
  reachCart: Cell;
  reachCheckout: Cell;
  manualOutcome: string; // "completed" | "abandoned at <stage>" | "not live-tested"
};

const MANUAL_BRAND: Record<string, string> = {
  chatgpt: "ChatGPT (OpenAI)",
  perplexity: "Perplexity",
  claude: "Claude (Anthropic)",
};

export function buildAgentMatrix(readiness: ReadinessReport, manualRuns: ManualRun[]): AgentRow[] {
  const robotsByAgent = new Map(readiness.robots.map((r) => [r.agent, r.allowed]));
  const pages = readiness.productPages;
  const structuredOk =
    pages.length > 0 && pages.some((p) => p.jsonLd.found && p.jsonLd.price && p.jsonLd.priceCurrency);
  const readProduct: Cell = pages.length === 0 ? "unknown" : structuredOk ? "yes" : "partial";

  return AGENT_BRANDS.map((b) => {
    const anyAllowed = b.uas.some((ua) => robotsByAgent.get(ua) === true);
    const allBlocked = b.uas.every((ua) => robotsByAgent.get(ua) === false);
    const discover: Cell = allBlocked ? "no" : anyAllowed ? "yes" : "partial";

    const manual = manualRuns.find((r) => MANUAL_BRAND[r.agent] === b.brand);
    if (b.liveTestable && manual) {
      // Live evidence beats inference for the transaction columns.
      const reachedCart =
        manual.outcome === "success" ||
        ["checkout", "payment"].includes(manual.failure_stage ?? "");
      const reachedCheckout =
        manual.outcome === "success" || manual.failure_stage === "payment";
      return {
        brand: b.brand,
        liveTested: true,
        discover,
        readProduct,
        reachCart: reachedCart ? "yes" : "no",
        reachCheckout: reachedCheckout ? "yes" : "no",
        manualOutcome:
          manual.outcome === "success" ? "completed" : `abandoned at ${manual.failure_stage ?? "unknown"}`,
      };
    }

    // No live run: infer transaction reachability from the single shared probe,
    // but mark it as inference, not a per-agent purchase test.
    const probe = readiness.checkout;
    return {
      brand: b.brand,
      liveTested: false,
      discover,
      readProduct,
      reachCart: discover === "no" ? "no" : probe.reachedCart ? "partial" : "unknown",
      reachCheckout: discover === "no" ? "no" : probe.reachedCheckout ? "partial" : "unknown",
      manualOutcome: "not live-tested",
    };
  });
}
