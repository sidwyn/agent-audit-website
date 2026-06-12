import { describe, expect, it } from "vitest";
import {
  AGENT_UA_TOKENS,
  hasAssistantUtmSource,
  hasHeadlessMarker,
  isAssistantReferrer,
  isAssistantSourceName,
  matchesAgentUa,
} from "../../src/classify/agents.js";

describe("AGENT_UA_TOKENS", () => {
  it("has the full 13-agent UA list from the spec", () => {
    expect(AGENT_UA_TOKENS).toHaveLength(13);
    expect(AGENT_UA_TOKENS).toContain("Claude-SearchBot");
    expect(AGENT_UA_TOKENS).toContain("meta-externalagent");
  });
});

describe("matchesAgentUa", () => {
  it("matches agent UAs case-insensitively and returns the canonical token", () => {
    expect(matchesAgentUa("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe("GPTBot");
    expect(matchesAgentUa("mozilla/5.0 perplexitybot/1.0")).toBe("PerplexityBot");
    expect(matchesAgentUa("Mozilla/5.0 (Macintosh) Safari/605.1")).toBeNull();
    expect(matchesAgentUa(null)).toBeNull();
    expect(matchesAgentUa(undefined)).toBeNull();
  });
});

describe("isAssistantReferrer", () => {
  it("matches assistant referrer hosts including subdomains, rejects lookalikes", () => {
    expect(isAssistantReferrer("https://chatgpt.com/c/abc")).toBe(true);
    expect(isAssistantReferrer("https://www.perplexity.ai/search?q=x")).toBe(true);
    expect(isAssistantReferrer("https://gemini.google.com/")).toBe(true);
    expect(isAssistantReferrer("https://notchatgpt.com/")).toBe(false);
    expect(isAssistantReferrer("https://google.com/")).toBe(false);
    expect(isAssistantReferrer(null)).toBe(false);
    expect(isAssistantReferrer("not a url")).toBe(false);
  });
});

describe("hasAssistantUtmSource", () => {
  it("matches utm_source on landing_site (full URL or path-only)", () => {
    expect(hasAssistantUtmSource("/products/x?utm_source=chatgpt.com")).toBe(true);
    expect(hasAssistantUtmSource("https://s.com/?utm_source=perplexity")).toBe(true);
    expect(hasAssistantUtmSource("/?utm_source=Claude")).toBe(true);
    expect(hasAssistantUtmSource("/?utm_source=newsletter")).toBe(false);
    expect(hasAssistantUtmSource("/products/x")).toBe(false);
    expect(hasAssistantUtmSource(null)).toBe(false);
  });
});

describe("hasHeadlessMarker", () => {
  it("flags headless and scripted-client markers", () => {
    expect(hasHeadlessMarker("Mozilla/5.0 HeadlessChrome/120.0")).toBe(true);
    expect(hasHeadlessMarker("python-requests/2.31")).toBe(true);
    expect(hasHeadlessMarker("curl/8.4.0")).toBe(true);
    expect(hasHeadlessMarker("Mozilla/5.0 (iPhone) Safari")).toBe(false);
    expect(hasHeadlessMarker(null)).toBe(false);
  });
});

describe("isAssistantSourceName", () => {
  it("flags assistant source_name channels", () => {
    expect(isAssistantSourceName("chatgpt")).toBe(true);
    expect(isAssistantSourceName("openai-shopping")).toBe(true);
    expect(isAssistantSourceName("instagram")).toBe(false);
  });
});
