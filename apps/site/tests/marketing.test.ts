import { describe, expect, it } from "vitest";
import { loadLandingCopy } from "../src/lib/marketing.js";

describe("loadLandingCopy", () => {
  const copy = loadLandingCopy();

  it("extracts all seven landing sections", () => {
    for (const key of ["hero", "statsBar", "whatYouGet", "howItWorks", "guarantee", "faq", "about"] as const) {
      expect(copy[key].length, key).toBeGreaterThan(10);
    }
  });

  it("keeps the copy verbatim", () => {
    expect(copy.hero).toContain("**Can an AI agent buy from your store?**");
    expect(copy.hero).toContain("ChatGPT, Perplexity, and Claude now shop on behalf of real buyers.");
    expect(copy.hero).toContain("**[Get the audit for $99]**");
    expect(copy.statsBar).toContain("[AI traffic to U.S. retail sites grew 393% YoY in Q1 2026]");
    expect(copy.statsBar).toContain("https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable");
    expect(copy.statsBar).toContain("https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2026/stricter-vamp-ratio-thresholds-are-now-in-effect-heres-how-to-stay-compliant");
    expect(copy.guarantee).toBe("Three or more actionable findings, or your $99 back.");
    expect(copy.about).toContain("I'm Sidwyn Koh.");
    expect(copy.faq).not.toContain("### ");
  });

  it("does not bleed into the social posts section", () => {
    expect(copy.about).not.toContain("X launch post");
  });
});
