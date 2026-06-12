import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findProductNode, validateProductPage } from "../../src/readiness/product-page.js";

const good = readFileSync(new URL("../fixtures/product-good.html", import.meta.url), "utf8");
const bad = readFileSync(new URL("../fixtures/product-bad.html", import.meta.url), "utf8");

describe("validateProductPage", () => {
  it("passes a complete product page with @graph json-ld", () => {
    const r = validateProductPage(good, "https://shop.test/products/field-jacket");
    expect(r.jsonLd).toEqual({
      found: true,
      price: true,
      priceCurrency: true,
      availability: true,
      skuOrGtin: true,
      image: true,
    });
    expect(r.og).toEqual({ title: true, image: true });
    expect(r.canonical).toBe("https://shop.test/products/field-jacket");
    expect(r.problems).toEqual([]);
  });

  it("lists specific problems for an incomplete page", () => {
    const r = validateProductPage(bad, "https://shop.test/products/canvas-tote");
    expect(r.jsonLd.found).toBe(true);
    expect(r.jsonLd.price).toBe(true);
    expect(r.jsonLd.priceCurrency).toBe(false);
    expect(r.problems).toEqual(
      expect.arrayContaining([
        "1 unparseable ld+json block(s)",
        "offer missing priceCurrency",
        "offer missing availability",
        "product missing sku/gtin",
        "product missing image",
        "missing og:title",
        "missing og:image",
        "missing canonical",
      ]),
    );
  });

  it("reports jsonLd.found=false when no Product node exists", () => {
    const r = validateProductPage("<html><head></head></html>", "https://shop.test/x");
    expect(r.jsonLd.found).toBe(false);
    expect(r.problems).toContain("no schema.org Product in ld+json");
  });

  it("handles @type arrays and offer-level gtin", () => {
    const node = findProductNode([
      { "@type": ["Product", "Thing"], name: "X", offers: { gtin13: "1234567890123" } },
    ]);
    expect(node).not.toBeNull();
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": ["Product", "Thing"],
      name: "X",
      image: "i.jpg",
      offers: { price: "1", priceCurrency: "USD", availability: "InStock", gtin13: "1234567890123" },
    })}</script>`;
    const r = validateProductPage(html, "u");
    expect(r.jsonLd.skuOrGtin).toBe(true);
  });
});
