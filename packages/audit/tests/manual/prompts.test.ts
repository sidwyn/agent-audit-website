import { describe, expect, it } from "vitest";
import { buildAgentPrompts, parseReplies } from "../../src/manual/prompts.js";
import { manualRunsFileSchema } from "../../src/manual/schema.js";

describe("buildAgentPrompts", () => {
  it("emits one prompt per assistant with the parseable RESULT line and guardrails", () => {
    const prompts = buildAgentPrompts("graza.co", { product: "https://graza.co/products/sizzle" });
    expect(prompts).toHaveLength(4);
    expect(prompts.map((p) => p.agent)).toEqual(["chatgpt", "perplexity", "claude", "gemini"]);
    for (const p of prompts) {
      expect(p.prompt).toContain(`RESULT | agent: ${p.agent} |`);
      expect(p.prompt).toContain("SCREENSHOT AT EVERY STEP");
      expect(p.prompt).toContain(`${p.agent}-5-payment.png`);
      expect(p.prompt).toContain("inbox/graza.co/");
      expect(p.prompt).toContain("do not solve or bypass any CAPTCHA");
      expect(p.prompt).toContain("graza.co/products/sizzle");
    }
  });
});

describe("parseReplies", () => {
  const pasted = `
Sure — here's what happened on ChatGPT...
I found the kettle, picked matte black, added to cart, reached the email page.
**RESULT | agent: chatgpt | outcome: success | furthest_stage: checkout | blocker: none | notes: reached checkout info in ~2 min**

Perplexity output:
\`RESULT | agent: perplexity | outcome: abandoned | furthest_stage: variant | blocker: color swatches unlabeled | notes: add-to-cart stayed disabled\`

Claude:
RESULT | agent: claude | outcome: abandoned | furthest_stage: cart | blocker: popup re-rendered | notes: looped on the email popup
`;

  it("parses each agent's RESULT line into a ManualRun", () => {
    const runs = parseReplies(pasted, { task: "Buy the 8-cup kettle" });
    expect(runs).toHaveLength(3);

    const chatgpt = runs.find((r) => r.agent === "chatgpt")!;
    expect(chatgpt.outcome).toBe("success");
    expect(chatgpt.failure_stage).toBeUndefined();
    expect(chatgpt.notes).toContain("reached checkout info");

    const perplexity = runs.find((r) => r.agent === "perplexity")!;
    expect(perplexity.outcome).toBe("abandoned");
    expect(perplexity.failure_stage).toBe("variant");
    expect(perplexity.notes).toContain("color swatches unlabeled");

    const claude = runs.find((r) => r.agent === "claude")!;
    expect(claude.failure_stage).toBe("cart");
  });

  it("produces runs that pass the manual-runs schema", () => {
    const runs = parseReplies(pasted);
    const parsed = manualRunsFileSchema.safeParse({ store: "x", runs });
    expect(parsed.success).toBe(true);
  });

  it("accepts non-standard agents like codex", () => {
    const runs = parseReplies("RESULT | agent: Codex | outcome: success | furthest_stage: payment | blocker: none | notes: reached card fields");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.agent).toBe("codex");
    expect(runs[0]!.outcome).toBe("success");
  });

  it("ignores non-RESULT text and dedupes repeated agents", () => {
    expect(parseReplies("no result lines here")).toEqual([]);
    const dupe = "RESULT | agent: chatgpt | outcome: success | furthest_stage: checkout | blocker: none | notes: a\nRESULT | agent: chatgpt | outcome: abandoned | furthest_stage: cart | blocker: x | notes: b";
    expect(parseReplies(dupe)).toHaveLength(1);
  });
});
