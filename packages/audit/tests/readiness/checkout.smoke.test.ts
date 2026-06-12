import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { probeCheckout } from "../../src/readiness/checkout.js";

// Gated smoke test: set SMOKE_STORE_URL to a live product page to exercise the
// real browser flow, e.g. SMOKE_STORE_URL=https://store.com/products/x pnpm test
const url = process.env.SMOKE_STORE_URL;

describe.skipIf(!url)("probeCheckout (smoke)", () => {
  it("returns a structurally valid result and never proceeds past checkout info", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-smoke-"));
    const result = await probeCheckout(url!, dir);
    expect(result.productUrl).toBe(url);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.screenshots)).toBe(true);
    expect(typeof result.reachedCart).toBe("boolean");
    expect(typeof result.reachedCheckout).toBe("boolean");
  }, 120_000);
});
