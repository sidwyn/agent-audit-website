import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatReadinessSummary, runReadiness } from "../../src/commands/readiness.js";
import type { Fetcher } from "../../src/readiness/http.js";
import type { CheckoutProbeResult, ReadinessReport } from "../../src/readiness/types.js";

const goodHtml = readFileSync(new URL("../fixtures/product-good.html", import.meta.url), "utf8");
const BASE = "https://demo-store.example";

const routes: Record<string, () => Response> = {
  [`${BASE}/robots.txt`]: () => new Response("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /"),
  [`${BASE}/products.json?limit=1`]: () => new Response(JSON.stringify({ products: [] })),
  [`${BASE}/llms.txt`]: () => new Response("not here", { status: 404 }),
  [`${BASE}/sitemap.xml`]: () =>
    new Response(
      `<urlset><url><loc>${BASE}/products/field-jacket</loc></url><url><loc>${BASE}/products/tote</loc></url></urlset>`,
    ),
  [`${BASE}/products/field-jacket`]: () => new Response(goodHtml),
  [`${BASE}/products/tote`]: () => new Response("<html></html>"),
};

const fetcher: Fetcher = async (url) => {
  const r = routes[url];
  return r ? r() : new Response("nf", { status: 404 });
};

const stubProbe = async (productUrl: string): Promise<CheckoutProbeResult> => ({
  productUrl,
  reachedCart: true,
  reachedCheckout: true,
  blockers: [],
  jsErrors: [],
  timeToCheckoutMs: 41000,
  screenshots: [],
});

describe("runReadiness", () => {
  it("assembles a full readiness report and writes it to disk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-readiness-"));
    const outPath = path.join(dir, "readiness.json");

    const { report } = await runReadiness(
      "https://demo-store.example",
      { out: outPath },
      { fetcher, probe: stubProbe, now: new Date("2026-06-12T00:00:00Z") },
    );

    const onDisk = JSON.parse(await readFile(outPath, "utf8")) as ReadinessReport;
    expect(onDisk.store).toBe("demo-store.example");
    expect(onDisk.robots).toHaveLength(13);
    expect(onDisk.robots.find((r) => r.agent === "GPTBot")!.allowed).toBe(false);
    expect(onDisk.robots.find((r) => r.agent === "ClaudeBot")!.allowed).toBe(true);
    expect(onDisk.feeds.productsJson.pass).toBe(true);
    expect(onDisk.feeds.llmsTxt.pass).toBe(false);
    expect(onDisk.productPages).toHaveLength(2);
    expect(onDisk.productPages[0]!.problems).toEqual([]);
    expect(onDisk.checkout.reachedCheckout).toBe(true);
    expect(onDisk.checkout.productUrl).toBe(`${BASE}/products/field-jacket`);

    const summary = formatReadinessSummary(report);
    expect(summary).toContain("12/13 agents allowed");
    expect(summary).toContain("blocked: GPTBot");
  });

  it("honors --skip-checkout and --max-pages", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-readiness-"));
    const { report } = await runReadiness(
      "demo-store.example",
      { out: path.join(dir, "r.json"), skipCheckout: true, maxPages: 1 },
      { fetcher, now: new Date("2026-06-12T00:00:00Z") },
    );
    expect(report.productPages).toHaveLength(1);
    expect(report.checkout.reachedCart).toBe(false);
    expect(report.checkout.productUrl).toBeNull();
  });
});
