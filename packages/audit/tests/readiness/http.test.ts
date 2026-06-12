import { describe, expect, it } from "vitest";
import { AUDIT_USER_AGENT, makeThrottledFetch } from "../../src/readiness/http.js";

describe("makeThrottledFetch", () => {
  it("spaces sequential requests by at least the interval", async () => {
    const startedAt: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      startedAt.push(Date.now());
      return new Response("ok");
    };
    const f = makeThrottledFetch({ fetchImpl, intervalMs: 50 });
    await Promise.all([f("https://a.test/1"), f("https://a.test/2"), f("https://a.test/3")]);
    expect(startedAt).toHaveLength(3);
    expect(startedAt[1]! - startedAt[0]!).toBeGreaterThanOrEqual(45);
    expect(startedAt[2]! - startedAt[1]!).toBeGreaterThanOrEqual(45);
  });

  it("sends the honest audit user-agent and passes responses through", async () => {
    let seenUa: string | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      seenUa = (init?.headers as Record<string, string>)["User-Agent"];
      return new Response("body", { status: 418 });
    };
    const f = makeThrottledFetch({ fetchImpl, intervalMs: 1 });
    const res = await f("https://a.test/");
    expect(res.status).toBe(418);
    expect(seenUa).toBe(AUDIT_USER_AGENT);
  });

  it("keeps the queue alive after a failed request", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n += 1;
      if (n === 1) throw new Error("network down");
      return new Response("ok");
    };
    const f = makeThrottledFetch({ fetchImpl, intervalMs: 1 });
    await expect(f("https://a.test/fail")).rejects.toThrow("network down");
    const res = await f("https://a.test/ok");
    expect(res.ok).toBe(true);
  });
});
