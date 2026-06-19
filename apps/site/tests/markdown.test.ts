import { describe, expect, it } from "vitest";
import { parseBlocks, parseFaq, parseInline, stripBold } from "../src/lib/markdown.js";
import { loadLandingCopy } from "../src/lib/marketing.js";

const copy = loadLandingCopy();

describe("parseBlocks", () => {
  it("turns the hero into headline, paragraph, cta and fine print", () => {
    const blocks = parseBlocks(copy.hero);
    expect(blocks[0]).toEqual({ type: "p", text: "**Open to agents. Hard to exploit.**" });
    expect(blocks[1]!.type).toBe("p");
    expect(blocks[2]).toEqual({ type: "cta", label: "Get the audit — $99" });
    expect(blocks[3]).toEqual({
      type: "p",
      text: "Founding rate for the first 20 stores. List price $499.",
    });
  });

  it("parses the stats bar as an unordered list of three", () => {
    const blocks = parseBlocks(copy.statsBar);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "ul" });
    expect((blocks[0] as { items: string[] }).items).toHaveLength(3);
  });

  it("parses how-it-works as an ordered list of three", () => {
    const blocks = parseBlocks(copy.howItWorks);
    expect(blocks[0]).toMatchObject({ type: "ol" });
    expect((blocks[0] as { items: string[] }).items[0]).toContain("Pay and answer five questions");
  });

  it("parses what-you-get as intro paragraph plus ordered list of four", () => {
    const blocks = parseBlocks(copy.whatYouGet);
    expect(blocks[0]).toEqual({ type: "p", text: "A scored report and a 30-minute readout call." });
    expect((blocks[1] as { items: string[] }).items).toHaveLength(4);
  });
});

describe("parseInline / stripBold", () => {
  it("splits bold runs", () => {
    expect(parseInline("a **b** c")).toEqual([
      { bold: false, text: "a " },
      { bold: true, text: "b" },
      { bold: false, text: " c" },
    ]);
    expect(stripBold("**Agent Readiness Score.** Automated checks")).toBe(
      "Agent Readiness Score. Automated checks",
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
    expect(stripBold("[Adobe data](https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable)")).toBe(
      "Adobe data",
    );
  });
});

describe("parseFaq", () => {
  it("extracts five q/a pairs from the faq section", () => {
    const faq = parseFaq(copy.faq);
    expect(faq).toHaveLength(5);
    expect(faq[0]!.q).toBe("Will agents place real orders?");
    expect(faq[0]!.a).toContain("Automated checks stop at the checkout page.");
    expect(faq[4]!.q).toBe("My store isn't on Shopify.");
  });
});
