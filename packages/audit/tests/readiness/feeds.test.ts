import { describe, expect, it } from "vitest";
import { checkLlmsTxt, checkProductsJson, checkSitemap } from "../../src/readiness/feeds.js";
import type { Fetcher } from "../../src/readiness/http.js";

function stubFetcher(routes: Record<string, Response | (() => Response)>): Fetcher {
  return async (url: string) => {
    const hit = routes[url];
    if (!hit) return new Response("not found", { status: 404 });
    return typeof hit === "function" ? hit() : hit.clone();
  };
}

const BASE = "https://shop.test";

describe("checkProductsJson", () => {
  it("passes on 200 with a products array", async () => {
    const f = stubFetcher({
      [`${BASE}/products.json?limit=1`]: new Response(JSON.stringify({ products: [{ id: 1 }] })),
    });
    const r = await checkProductsJson(BASE, f);
    expect(r).toMatchObject({ pass: true, status: 200 });
  });

  it("fails on 401 and on 200-without-array", async () => {
    const f401 = stubFetcher({ [`${BASE}/products.json?limit=1`]: new Response("denied", { status: 401 }) });
    expect((await checkProductsJson(BASE, f401)).pass).toBe(false);

    const fHtml = stubFetcher({ [`${BASE}/products.json?limit=1`]: new Response("<html>login</html>") });
    const r = await checkProductsJson(BASE, fHtml);
    expect(r.pass).toBe(false);
    expect(r.notes).toMatch(/no products array/);
  });
});

describe("checkLlmsTxt", () => {
  it("passes on plain text, fails on 404 and soft-404 html", async () => {
    const ok = stubFetcher({ [`${BASE}/llms.txt`]: new Response("# Store\nProducts: /products.json") });
    expect((await checkLlmsTxt(BASE, ok)).pass).toBe(true);

    const missing = stubFetcher({});
    expect((await checkLlmsTxt(BASE, missing)).pass).toBe(false);

    const soft = stubFetcher({ [`${BASE}/llms.txt`]: new Response("<!doctype html><html></html>") });
    expect((await checkLlmsTxt(BASE, soft)).pass).toBe(false);
  });
});

describe("checkSitemap", () => {
  const child = `${BASE}/sitemap_products_1.xml`;
  const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>${child}</loc></sitemap><sitemap><loc>${BASE}/sitemap_pages_1.xml</loc></sitemap></sitemapindex>`;
  const urls = Array.from(
    { length: 14 },
    (_, i) => `<url><loc>${BASE}/products/item-${i}</loc></url>`,
  ).join("");
  const childXml = `<?xml version="1.0"?><urlset>${urls}</urlset>`;

  it("follows product child sitemaps from an index and caps at 10", async () => {
    const f = stubFetcher({
      [`${BASE}/sitemap.xml`]: new Response(index),
      [child]: new Response(childXml),
    });
    const { result, productUrls } = await checkSitemap(BASE, f);
    expect(result.pass).toBe(true);
    expect(productUrls).toHaveLength(10);
    expect(result.productUrlCount).toBe(10);
    expect(productUrls[0]).toBe(`${BASE}/products/item-0`);
  });

  it("handles a flat urlset sitemap", async () => {
    const f = stubFetcher({
      [`${BASE}/sitemap.xml`]: new Response(
        `<urlset><url><loc>${BASE}/products/solo</loc></url><url><loc>${BASE}/pages/about</loc></url></urlset>`,
      ),
    });
    const { productUrls } = await checkSitemap(BASE, f);
    expect(productUrls).toEqual([`${BASE}/products/solo`]);
  });

  it("excludes gift-card and store-credit handles from sampling", async () => {
    const f = stubFetcher({
      [`${BASE}/sitemap.xml`]: new Response(
        `<urlset><url><loc>${BASE}/products/gift-card</loc></url><url><loc>${BASE}/products/e-gift-card</loc></url><url><loc>${BASE}/products/real-jacket</loc></url></urlset>`,
      ),
    });
    const { productUrls } = await checkSitemap(BASE, f);
    expect(productUrls).toEqual([`${BASE}/products/real-jacket`]);
  });

  it("fails gracefully on missing or malformed sitemap", async () => {
    expect((await checkSitemap(BASE, stubFetcher({}))).result.pass).toBe(false);
    const bad = stubFetcher({ [`${BASE}/sitemap.xml`]: new Response("this is not xml") });
    const { result } = await checkSitemap(BASE, bad);
    expect(result.pass).toBe(false);
    expect(result.notes).toMatch(/not valid sitemap/);
  });
});
