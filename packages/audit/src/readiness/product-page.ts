import type { ProductPageResult } from "./types.js";

type JsonObject = Record<string, unknown>;

export function extractJsonLdBlocks(html: string): { blocks: unknown[]; parseErrors: number } {
  const blocks: unknown[] = [];
  let parseErrors = 0;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      blocks.push(JSON.parse(m[1]!.trim()));
    } catch {
      parseErrors += 1;
    }
  }
  return { blocks, parseErrors };
}

function isType(node: JsonObject, type: string): boolean {
  const t = node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
}

export function findProductNode(blocks: unknown[]): JsonObject | null {
  const queue: unknown[] = [...blocks];
  while (queue.length > 0) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (typeof node !== "object" || node === null) continue;
    const obj = node as JsonObject;
    if (isType(obj, "Product")) return obj;
    if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
  }
  return null;
}

function firstOffer(product: JsonObject): JsonObject | null {
  const offers = product.offers;
  if (Array.isArray(offers)) {
    const first = offers[0];
    return typeof first === "object" && first !== null ? (first as JsonObject) : null;
  }
  return typeof offers === "object" && offers !== null ? (offers as JsonObject) : null;
}

function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

const GTIN_KEYS = ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "mpn"];

function metaPresent(html: string, property: string): boolean {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["'][^"']+["']|<meta[^>]+content=["'][^"']+["'][^>]+property=["']${property}["']`,
    "i",
  );
  return re.test(html);
}

export function extractCanonical(html: string): string | null {
  const m =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m?.[1] ?? null;
}

export function validateProductPage(html: string, url: string): ProductPageResult {
  const problems: string[] = [];
  const { blocks, parseErrors } = extractJsonLdBlocks(html);
  if (parseErrors > 0) problems.push(`${parseErrors} unparseable ld+json block(s)`);

  const product = findProductNode(blocks);
  const offer = product ? firstOffer(product) : null;

  const jsonLd = {
    found: product !== null,
    price: present(offer?.price),
    priceCurrency: present(offer?.priceCurrency),
    availability: present(offer?.availability),
    skuOrGtin:
      (product !== null && GTIN_KEYS.concat("sku").some((k) => present(product[k]))) ||
      (offer !== null && GTIN_KEYS.concat("sku").some((k) => present(offer[k]))),
    image: product !== null && present(product.image),
  };

  if (!jsonLd.found) {
    problems.push("no schema.org Product in ld+json");
  } else {
    if (!offer) problems.push("product has no Offer");
    if (!jsonLd.price) problems.push("offer missing price");
    if (!jsonLd.priceCurrency) problems.push("offer missing priceCurrency");
    if (!jsonLd.availability) problems.push("offer missing availability");
    if (!jsonLd.skuOrGtin) problems.push("product missing sku/gtin");
    if (!jsonLd.image) problems.push("product missing image");
  }

  const og = { title: metaPresent(html, "og:title"), image: metaPresent(html, "og:image") };
  if (!og.title) problems.push("missing og:title");
  if (!og.image) problems.push("missing og:image");

  const canonical = extractCanonical(html);
  if (!canonical) problems.push("missing canonical");

  return { url, jsonLd, og, canonical, problems };
}
