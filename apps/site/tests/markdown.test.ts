import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, stripBold } from "../src/lib/markdown.js";
import { loadLandingCopy } from "../src/lib/marketing.js";

const copy = loadLandingCopy();

describe("parseBlocks", () => {
  it("turns the hero into eyebrow, headline, subhead, and cta", () => {
    const blocks = parseBlocks(copy.hero);
    expect(blocks[0]).toEqual({ type: "p", text: "Agent Abuse & Fraud Protection · for Shopify" });
    expect(blocks[1]).toEqual({ type: "p", text: "**Stop agents from gaming your store.**" });
    expect(blocks[2]!.type).toBe("p");
    expect(blocks[3]).toEqual({ type: "cta", label: "Start — $39/month" });
  });

  it("parses stakes as body paragraph plus unordered list of three", () => {
    const blocks = parseBlocks(copy.stakes);
    expect(blocks[0]!.type).toBe("p");
    const list = blocks.find((b) => b.type === "ul");
    expect(list).toBeDefined();
    expect((list as { items: string[] }).items).toHaveLength(3);
  });

  it("parses how-it-works as an ordered list of three", () => {
    const blocks = parseBlocks(copy.howItWorks);
    expect(blocks[0]).toMatchObject({ type: "ol" });
    expect((blocks[0] as { items: string[] }).items[0]).toContain("Connect in two clicks");
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
