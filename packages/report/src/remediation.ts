import type { ReadinessReport } from "@agentaudit/audit";
import type { StoreMeta } from "./types.js";

export type Snippet = { title: string; language: string; body: string; note: string };

// Turns diagnoses into copy-paste fixes so the readout call ships changes live.
export function buildRemediation(readiness: ReadinessReport, meta: StoreMeta): Snippet[] {
  const snippets: Snippet[] = [];

  const blocked = readiness.robots.filter((r) => !r.allowed);
  if (blocked.length > 0) {
    const lines = [
      "# Allow AI shopping agents to read your storefront",
      ...blocked.map((r) => `User-agent: ${r.agent}`),
      "Allow: /",
      "",
      "# (keep your existing rules for other crawlers below)",
    ];
    snippets.push({
      title: `robots.txt — unblock ${blocked.length} agent user-agent${blocked.length === 1 ? "" : "s"}`,
      language: "text",
      body: lines.join("\n"),
      note: `Currently blocked: ${blocked.map((b) => b.agent).join(", ")}. Add these stanzas to your robots.txt (Shopify: Online Store > themes > edit code > robots.txt.liquid).`,
    });
  }

  const gapPages = readiness.productPages.filter((p) => p.problems.length > 0);
  if (gapPages.length > 0) {
    const missing = new Set(gapPages.flatMap((p) => p.problems));
    const needsOffer = [...missing].some((m) => m.includes("price") || m.includes("availability") || m.includes("Currency"));
    if (needsOffer || [...missing].some((m) => m.includes("sku") || m.includes("Product") || m.includes("image"))) {
      snippets.push({
        title: "Server-rendered JSON-LD Product/Offer",
        language: "html",
        body: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "<product title>",
  "image": ["https://${meta.domain}/<product-image>.jpg"],
  "sku": "<your SKU or GTIN>",
  "brand": { "@type": "Brand", "name": "${meta.name}" },
  "offers": {
    "@type": "Offer",
    "price": "<numeric price, no currency symbol>",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://${meta.domain}/products/<handle>"
  }
}
</script>`,
        note: `Serve this in the initial HTML (server-rendered), not injected by JavaScript — most crawler-class agents don't run JS. Affected pages: ${gapPages.map((p) => safePath(p.url)).slice(0, 6).join(", ")}${gapPages.length > 6 ? ` (+${gapPages.length - 6} more)` : ""}.`,
      });
    }
  }

  if (!readiness.feeds.llmsTxt.pass) {
    snippets.push({
      title: "llms.txt — a guided index for AI agents",
      language: "text",
      body: `# ${meta.name}
> ${meta.name} storefront. Products, prices, and policies for AI shopping agents.

## Products
- Catalog (JSON): https://${meta.domain}/products.json
- Sitemap: https://${meta.domain}/sitemap.xml

## Policies
- Shipping: https://${meta.domain}/policies/shipping-policy
- Returns: https://${meta.domain}/policies/refund-policy

## Contact
- ${meta.contact}`,
      note: `Serve this at https://${meta.domain}/llms.txt. Emerging convention; cheap to add and increasingly read by assistants.`,
    });
  }

  return snippets;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
