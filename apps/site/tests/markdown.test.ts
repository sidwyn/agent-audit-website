import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, stripBold } from "../src/lib/markdown.js";
import { loadLandingCopy } from "../src/lib/marketing.js";

const copy = loadLandingCopy();

describe("parseBlocks", () => {
  it("turns the hero into headline, subhead, cta, and fine print", () => {
    const blocks = parseBlocks(copy.hero);
    expect(blocks[0]).toEqual({ type: "p", text: "**Open to agents. Hard to exploit.**" });
    expect(blocks[1]!.type).toBe("p");
    expect(blocks[2]).toEqual({ type: "cta", label: "Get early access" });
    expect(blocks[3]!.type).toBe("p");
  });

  it("parses what-it-stops as an unordered list of three", () => {
    const blocks = parseBlocks(copy.whatItStops);
    const list = blocks.find((b) => b.type === "ul");
    expect(list).toBeDefined();
    expect((list as { items: string[] }).items).toHaveLength(3);
  });

  it("parses how-it-works as paragraphs", () => {
    const blocks = parseBlocks(copy.howItWorks);
    expect(blocks[0]!.type).toBe("p");
    expect((blocks[0] as { text: string }).text).toContain("AgentArmor is a normal Shopware plugin");
  });
});

describe("parseInline / stripBold", () => {
  it("splits bold runs", () => {
    expect(parseInline("a **b** c")).toEqual([
      { bold: false, text: "a " },
      { bold: true, text: "b" },
      { bold: false, text: " c" },
    ]);
    expect(stripBold("**Stop agents from gaming your store.**")).toBe(
      "Stop agents from gaming your store.",
    );
  });

  it("splits markdown links into href segments", () => {
    expect(parseInline("See [Adobe data](https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable).")).toEqual([
      { bold: false, text: "See " },
      {
        bold: false,
        href: "https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable",
        text: "Adobe data",
      },
      { bold: false, text: "." },
    ]);
  });
});
