import { describe, expect, it } from "vitest";
import { loadLandingCopy } from "../src/lib/marketing.js";

describe("loadLandingCopy", () => {
  const copy = loadLandingCopy();

  it("extracts all ten landing sections", () => {
    for (const key of [
      "hero",
      "stakes",
      "howItWorks",
      "ongoingAudits",
      "continuousScanning",
      "fraudMonitoring",
      "whatWeTest",
      "trust",
      "pricing",
      "about",
    ] as const) {
      expect(copy[key].length, key).toBeGreaterThan(10);
    }
  });

  it("keeps the copy verbatim", () => {
    expect(copy.hero).toContain("**Stop agents from gaming your store.**");
    expect(copy.hero).toContain("$39/month");
    expect(copy.hero).toContain("**[Start — $39/month]**");
    expect(copy.stakes).toContain("**393%**");
    expect(copy.stakes).toContain("https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable");
    expect(copy.stakes).toContain("https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2026/stricter-vamp-ratio-thresholds-are-now-in-effect-heres-how-to-stay-compliant");
    expect(copy.pricing).toContain("**[Start — $39/month]**");
    expect(copy.about).toContain("I'm Sidwyn Koh.");
  });

  it("does not bleed into the social posts section", () => {
    expect(copy.about).not.toContain("X launch post");
  });
});
