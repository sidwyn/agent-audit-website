import { describe, expect, it } from "vitest";
import { loadLandingCopy } from "../src/lib/marketing.js";

describe("loadLandingCopy", () => {
  const copy = loadLandingCopy();

  it("extracts all eight landing sections", () => {
    for (const key of [
      "hero",
      "whatItStops",
      "promoDepth",
      "howItWorks",
      "builtFor",
      "pricing",
      "whoBuiltIt",
      "faq",
    ] as const) {
      expect(copy[key].length, key).toBeGreaterThan(10);
    }
  });

  it("keeps the copy verbatim", () => {
    expect(copy.hero).toContain("**Open to agents. Hard to exploit.**");
    expect(copy.hero).toContain("**[Get early access]**");
    expect(copy.whatItStops).toContain("**Promo farming.**");
    expect(copy.pricing).toContain("**[Get early access]**");
    expect(copy.whoBuiltIt).toContain("I'm **Sidwyn Koh**.");
  });

  it("does not mention price or AgentAudit", () => {
    for (const key of ["hero", "pricing", "whoBuiltIt", "faq"] as const) {
      expect(copy[key], key).not.toContain("€39");
      expect(copy[key].toLowerCase(), key).not.toContain("agentaudit");
    }
  });

  it("does not bleed across sections", () => {
    expect(copy.whoBuiltIt).not.toContain("### FAQ");
    expect(copy.faq).not.toContain("Footer");
  });
});
