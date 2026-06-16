import { describe, expect, it } from "vitest";
import { buildAgentPrompts, buildInstructions, parseReplies } from "../../src/manual/prompts.js";
import { manualRunsFileSchema } from "../../src/manual/schema.js";

describe("buildAgentPrompts", () => {
  it("emits the full inline prompt per assistant with the parseable RESULT line and guardrails", () => {
    const prompts = buildAgentPrompts("graza.co", { product: "https://graza.co/products/sizzle", full: true });
    expect(prompts).toHaveLength(4);
    expect(prompts.map((p) => p.agent)).toEqual(["codex", "perplexity", "claude", "gemini"]);
    for (const p of prompts) {
      const agentName = p.agent.charAt(0).toUpperCase() + p.agent.slice(1);
      expect(p.prompt).toContain(`RESULT | agent: ${p.agent} |`);
      expect(p.prompt).toContain("Walk the FULL shopping funnel");
      expect(p.prompt).toContain(`${p.agent}-10-payment_boundary.png`);
      expect(p.prompt).toContain(`${p.agent}-5-variant.png`);
      expect(p.prompt).toContain("inbox/graza.co/");
      expect(p.prompt).toContain("do NOT solve or bypass it");
      expect(p.prompt).toContain("graza.co/products/sizzle");
      expect(p.prompt).toContain("model:");
      expect(p.prompt).toContain("time_to_cart_seconds:");
      expect(p.prompt).toContain("blocker_code:");
      expect(p.prompt).toMatch(/stage: <homepage \| search/);
      // every agent must be told to use a real, non-headless browser
      expect(p.prompt).toContain("non-headless browser");
      // ...and to tag any new Chrome group with its own name
      expect(p.prompt).toContain(`- ${agentName}"`);
    }
  });

  it("emits a short prompt that points at instructions.md by default", () => {
    const prompts = buildAgentPrompts("graza.co", { product: "https://graza.co/products/sizzle" });
    for (const p of prompts) {
      expect(p.prompt).toContain("instructions.md");
      expect(p.prompt).toContain("graza.co/products/sizzle");
      expect(p.prompt).toContain(`${p.agent}-<n>-<stage>.png`);
      expect(p.prompt).toContain("STOP before payment");
      // the brief prompt must NOT inline the full funnel walk
      expect(p.prompt).not.toContain("Walk the FULL shopping funnel");
      expect(p.prompt.length).toBeLessThan(1200); // brief: far shorter than the full inline prompt
    }
  });

  it("renders instructions.md with the funnel, chrome-devtools tips and output format", () => {
    const md = buildInstructions();
    expect(md).toContain("MUST drive the browser via the chrome-devtools MCP");
    expect(md).toContain("take_snapshot");
    expect(md).toContain("?skip_shop_pay=true");
    expect(md).toContain("checkout.pci.shopifyinc.com");
    expect(md).toContain("homepage.nav");
    expect(md).toContain("captcha_cloudflare_bot");
    expect(md).toContain("RESULT | agent:");
    expect(md).toContain("non-headless browser");
  });

  it("adds agent-specific notes only to their own prompts", () => {
    const prompts = buildAgentPrompts("graza.co", { product: "https://graza.co/products/sizzle" });
    const claudeNote = "Use the Claude Chrome extension to achieve this.";
    expect(prompts.find((p) => p.agent === "claude")!.prompt).toContain(claudeNote);
    for (const p of prompts.filter((p) => p.agent !== "claude")) {
      expect(p.prompt).not.toContain(claudeNote);
    }

    const perplexity = prompts.find((p) => p.agent === "perplexity")!.prompt;
    expect(perplexity).toContain("Perplexity saves files to its own sandbox");
    expect(perplexity).toContain("inbox/graza.co/");
    expect(perplexity).toContain("attach or inline every screenshot");
    for (const p of prompts.filter((p) => p.agent !== "perplexity")) {
      expect(p.prompt).not.toContain("Perplexity saves files to its own sandbox");
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

  it("captures model and discovery→cart timing when present", () => {
    const runs = parseReplies(
      "RESULT | agent: gemini | model: Gemini 2.5 Pro | outcome: success | furthest_stage: payment | time_to_cart_seconds: 42 | blocker: none | notes: smooth run",
    );
    expect(runs[0]!.model).toBe("Gemini 2.5 Pro");
    expect(runs[0]!.secondsToCart).toBe(42);
  });

  it("leaves model/timing undefined when omitted or n/a", () => {
    const runs = parseReplies(
      "RESULT | agent: claude | model: n/a | outcome: abandoned | furthest_stage: cart | blocker: popup | notes: stuck",
    );
    expect(runs[0]!.model).toBeUndefined();
    expect(runs[0]!.secondsToCart).toBeUndefined();
  });

  it("parses a STAGES block and a taxonomy-coded blocker", () => {
    const reply = `
stage: homepage | status: pass | note: nav clear
stage: product | status: pass | note: read price/availability
stage: variant | status: partial | note: had to guess the color
stage: add_to_cart | status: fail | note: button stayed disabled
RESULT | agent: claude | model: Claude Opus 4.8 | outcome: abandoned | furthest_stage: variant | time_to_cart_seconds: none | blocker_code: disabled_button | blocker: add-to-cart never enabled | notes: stuck choosing color`;
    const runs = parseReplies(reply);
    expect(runs).toHaveLength(1);
    const r = runs[0]!;
    expect(r.stages.map((s) => s.stage)).toEqual(["homepage", "product", "variant", "add_to_cart"]);
    expect(r.stages.find((s) => s.stage === "add_to_cart")!.status).toBe("fail");
    expect(r.blockerCode).toBe("disabled_button");
    expect(r.failure_stage).toBe("variant");
    expect(r.outcome).toBe("abandoned");
  });

  it("parses the capability checklist + obstacles and rolls stages up from checks", () => {
    const reply = `
homepage.nav: pass | clear
product.price: pass | $76
variant.color: pass | Royal Black
cart.discount: partial | field present, not tested
add_to_cart.button: fail | button never enabled
captcha_cloudflare_bot: hit on checkout
cookie_banner: dismissed
RESULT | agent: gemini | model: Gemini 3.5 Pro | outcome: success | furthest_stage: payment_boundary | time_to_cart_seconds: 17 | blocker_code: none | blocker: none | notes: ok`;
    const r = parseReplies(reply)[0]!;
    expect(r.checks).toHaveLength(5);
    expect(r.checks.find((c) => c.key === "price")!.status).toBe("pass");
    expect(r.checks.find((c) => c.key === "discount")!.status).toBe("partial");
    expect(r.checks.find((c) => c.key === "button")!.note).toBe("button never enabled");
    expect(r.obstacles.map((o) => o.key)).toEqual(expect.arrayContaining(["captcha_cloudflare_bot", "cookie_banner"]));
    // section status rolls up from its checks: product (all pass) -> pass; add_to_cart (a fail) -> fail
    expect(r.stages.find((s) => s.stage === "product")!.status).toBe("pass");
    expect(r.stages.find((s) => s.stage === "add_to_cart")!.status).toBe("fail");
  });

  it("ignores unknown check/obstacle keys", () => {
    const r = parseReplies(
      "bogus.key: pass\nnot_an_obstacle: hit\nproduct.title: pass\nRESULT | agent: claude | outcome: success | furthest_stage: product | blocker_code: none | blocker: none | notes: x",
    )[0]!;
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0]!.key).toBe("title");
    expect(r.obstacles).toHaveLength(0);
  });

  it("maps an unknown blocker_code to 'other' and funnel stages to the coarse enum", () => {
    const runs = parseReplies(
      "RESULT | agent: gemini | outcome: abandoned | furthest_stage: checkout_info | blocker_code: weird_thing | blocker: ? | notes: x",
    );
    expect(runs[0]!.blockerCode).toBe("other");
    expect(runs[0]!.failure_stage).toBe("checkout"); // checkout_info -> coarse "checkout"
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
