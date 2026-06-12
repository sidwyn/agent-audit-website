import { describe, expect, it } from "vitest";
import { evaluateAgentAccess, parseRobots } from "../../src/readiness/robots.js";

describe("parseRobots + evaluateAgentAccess", () => {
  it("blanket disallow blocks every agent via the wildcard group", () => {
    const groups = parseRobots("User-agent: *\nDisallow: /");
    const v = evaluateAgentAccess(groups, "GPTBot");
    expect(v.allowed).toBe(false);
    expect(v.matchedGroup).toBe("*");
    expect(v.matchedRule).toBe("Disallow: /");
  });

  it("agent-specific deny overrides a permissive wildcard", () => {
    const txt = "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /";
    const groups = parseRobots(txt);
    expect(evaluateAgentAccess(groups, "GPTBot").allowed).toBe(false);
    expect(evaluateAgentAccess(groups, "ClaudeBot").allowed).toBe(true);
  });

  it("longest path match wins: allow override on /products/", () => {
    const txt = "User-agent: *\nDisallow: /\nAllow: /products/";
    const groups = parseRobots(txt);
    expect(evaluateAgentAccess(groups, "GPTBot", "/products/x").allowed).toBe(true);
    expect(evaluateAgentAccess(groups, "GPTBot", "/cart").allowed).toBe(false);
  });

  it("consecutive user-agent lines share one group", () => {
    const txt = "User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /";
    const groups = parseRobots(txt);
    expect(groups).toHaveLength(1);
    expect(evaluateAgentAccess(groups, "ClaudeBot").allowed).toBe(false);
    expect(evaluateAgentAccess(groups, "Bytespider").allowed).toBe(true);
  });

  it("empty or missing robots allows everything", () => {
    expect(evaluateAgentAccess(parseRobots(""), "GPTBot").allowed).toBe(true);
    expect(evaluateAgentAccess(parseRobots(""), "GPTBot").matchedGroup).toBe("(none)");
  });

  it("matches agent tokens case-insensitively and ignores comments", () => {
    const txt = "# block ai\nUser-Agent: gptbot\nDisallow: / # everything";
    const groups = parseRobots(txt);
    expect(evaluateAgentAccess(groups, "GPTBot").allowed).toBe(false);
  });

  it("empty disallow value allows all", () => {
    const groups = parseRobots("User-agent: *\nDisallow:");
    expect(evaluateAgentAccess(groups, "GPTBot").allowed).toBe(true);
  });
});
