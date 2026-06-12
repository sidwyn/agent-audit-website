import type { Fetcher } from "./http.js";
import type { CheckResult } from "./types.js";

const MAX_PRODUCT_URLS = 10;
const MAX_CHILD_SITEMAPS = 3;

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((m) => m[1]!);
}

export async function checkProductsJson(baseUrl: string, fetcher: Fetcher): Promise<CheckResult> {
  const url = new URL("/products.json?limit=1", baseUrl).toString();
  try {
    const res = await fetcher(url);
    if (!res.ok) {
      return { pass: false, status: res.status, notes: `products.json returned ${res.status}` };
    }
    const body: unknown = await res.json().catch(() => null);
    const hasProducts =
      typeof body === "object" && body !== null && Array.isArray((body as { products?: unknown }).products);
    return hasProducts
      ? { pass: true, status: res.status, notes: "products.json accessible" }
      : { pass: false, status: res.status, notes: "products.json returned 200 but no products array (likely disabled or html)" };
  } catch (err) {
    return { pass: false, status: null, notes: `products.json unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function checkLlmsTxt(baseUrl: string, fetcher: Fetcher): Promise<CheckResult> {
  const url = new URL("/llms.txt", baseUrl).toString();
  try {
    const res = await fetcher(url);
    if (!res.ok) return { pass: false, status: res.status, notes: `llms.txt returned ${res.status}` };
    const text = await res.text();
    const looksHtml = /^\s*</.test(text);
    return looksHtml || text.trim() === ""
      ? { pass: false, status: res.status, notes: "llms.txt returned 200 but content is empty or html (likely a soft-404)" }
      : { pass: true, status: res.status, notes: "llms.txt present" };
  } catch (err) {
    return { pass: false, status: null, notes: `llms.txt unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function checkSitemap(
  baseUrl: string,
  fetcher: Fetcher,
): Promise<{ result: CheckResult & { productUrlCount: number }; productUrls: string[] }> {
  const url = new URL("/sitemap.xml", baseUrl).toString();
  try {
    const res = await fetcher(url);
    if (!res.ok) {
      return {
        result: { pass: false, status: res.status, notes: `sitemap.xml returned ${res.status}`, productUrlCount: 0 },
        productUrls: [],
      };
    }
    const xml = await res.text();
    let productUrls: string[] = [];

    if (/<sitemapindex/i.test(xml)) {
      const children = extractLocs(xml)
        .filter((u) => u.toLowerCase().includes("product"))
        .slice(0, MAX_CHILD_SITEMAPS);
      for (const child of children) {
        if (productUrls.length >= MAX_PRODUCT_URLS) break;
        try {
          const childRes = await fetcher(child);
          if (!childRes.ok) continue;
          const childXml = await childRes.text();
          productUrls.push(...extractLocs(childXml).filter((u) => u.includes("/products/")));
        } catch {
          continue; // a broken child sitemap shouldn't sink the whole check
        }
      }
    } else if (/<urlset/i.test(xml)) {
      productUrls = extractLocs(xml).filter((u) => u.includes("/products/"));
    } else {
      return {
        result: { pass: false, status: res.status, notes: "sitemap.xml is not valid sitemap xml", productUrlCount: 0 },
        productUrls: [],
      };
    }

    productUrls = productUrls.slice(0, MAX_PRODUCT_URLS);
    return {
      result: {
        pass: true,
        status: res.status,
        notes: `sitemap ok, ${productUrls.length} product urls sampled`,
        productUrlCount: productUrls.length,
      },
      productUrls,
    };
  } catch (err) {
    return {
      result: {
        pass: false,
        status: null,
        notes: `sitemap.xml unreachable: ${err instanceof Error ? err.message : String(err)}`,
        productUrlCount: 0,
      },
      productUrls: [],
    };
  }
}
