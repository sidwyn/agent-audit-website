import { describe, expect, it } from "vitest";
import { classifyOrder } from "../../src/classify/rules.js";
import { makeOrder } from "../fixtures/orders.js";

const DC = ["3.5.140.0/22"];

describe("classifyOrder", () => {
  it("tier 1: non-standard source_name wins over everything", () => {
    expect(classifyOrder(makeOrder({ sourceName: "chatgpt" }), DC)).toEqual({
      orderClass: "confirmed_channel",
      signals: ["source_name:chatgpt", "assistant_channel"],
    });
    expect(classifyOrder(makeOrder({ sourceName: "instagram" }), DC).orderClass).toBe(
      "confirmed_channel",
    );
  });

  it("tier 1: non-standard app_id triggers even when source_name is web", () => {
    const c = classifyOrder(makeOrder({ sourceName: "web", appId: "99999999" }), DC);
    expect(c.orderClass).toBe("confirmed_channel");
    expect(c.signals).toContain("app_id:99999999");
  });

  it("tier 2: each high-confidence signal independently classifies", () => {
    expect(
      classifyOrder(makeOrder({ userAgent: "Mozilla/5.0 ChatGPT-User/1.0" }), DC).orderClass,
    ).toBe("high_confidence_agent");
    expect(
      classifyOrder(makeOrder({ referringSite: "https://chatgpt.com/" }), DC).orderClass,
    ).toBe("high_confidence_agent");
    expect(
      classifyOrder(makeOrder({ landingSite: "/?utm_source=perplexity" }), DC).orderClass,
    ).toBe("high_confidence_agent");
  });

  it("tier 3: headless UA or datacenter IP", () => {
    expect(classifyOrder(makeOrder({ userAgent: "HeadlessChrome/120" }), DC).orderClass).toBe(
      "heuristic_agent",
    );
    expect(classifyOrder(makeOrder({ browserIp: "3.5.140.9" }), DC).orderClass).toBe(
      "heuristic_agent",
    );
  });

  it("tier 4: plain web order is human", () => {
    expect(classifyOrder(makeOrder({}), DC)).toEqual({ orderClass: "human", signals: [] });
  });

  it("standard sources and first-party app ids stay out of tier 1", () => {
    for (const s of ["web", "pos", "shopify_draft_order", "draft"]) {
      expect(classifyOrder(makeOrder({ sourceName: s, appId: null }), DC).orderClass).toBe("human");
    }
    expect(classifyOrder(makeOrder({ sourceName: "WEB" }), DC).orderClass).toBe("human");
    expect(classifyOrder(makeOrder({ sourceName: null, appId: "129785" }), DC).orderClass).toBe(
      "human",
    );
  });

  it("collects multiple tier-2 signals", () => {
    const c = classifyOrder(
      makeOrder({
        userAgent: "Mozilla/5.0 Perplexity-User/1.0",
        referringSite: "https://perplexity.ai/search",
      }),
      DC,
    );
    expect(c.orderClass).toBe("high_confidence_agent");
    expect(c.signals).toHaveLength(2);
  });
});
