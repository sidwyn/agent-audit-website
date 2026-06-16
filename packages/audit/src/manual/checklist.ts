import type { FunnelStageName } from "./schema.js";

// Single source of truth for the per-agent capability checklist. The prompt asks
// the agent to fill it, the parser validates against it, and the report renders
// one table per agent from it — so all three stay in lockstep.

export type CapabilityCheck = { section: FunnelStageName; key: string; label: string };

// ~40 granular actions, grouped by funnel section. `key` is what the agent
// reports (e.g. "homepage.nav: pass"); `label` is the human row in the report.
export const CAPABILITY_CHECKS: CapabilityCheck[] = [
  { section: "homepage", key: "nav", label: "Read nav / menu" },
  { section: "homepage", key: "search_box", label: "Find search box" },
  { section: "homepage", key: "categories", label: "Read categories / announcement bar" },

  { section: "search", key: "locate", label: "Locate search input" },
  { section: "search", key: "query_results", label: "Enter query + get results" },
  { section: "search", key: "results_parseable", label: "Results parseable (title/price)" },

  { section: "collection", key: "grid", label: "Read product grid" },
  { section: "collection", key: "filter", label: "Apply a filter" },
  { section: "collection", key: "sort", label: "Apply a sort" },
  { section: "collection", key: "pagination", label: "Pagination / infinite scroll" },

  { section: "product", key: "title", label: "Read title" },
  { section: "product", key: "price", label: "Read price" },
  { section: "product", key: "availability", label: "Read availability / stock" },
  { section: "product", key: "options", label: "Read options / variants" },
  { section: "product", key: "reviews", label: "Read reviews / rating" },
  { section: "product", key: "shipping_returns", label: "Read shipping & returns" },
  { section: "product", key: "images", label: "Read images" },

  { section: "variant", key: "color", label: "Select color" },
  { section: "variant", key: "material_kit", label: "Select material / kit" },
  { section: "variant", key: "addon", label: "Add-on / upsell selection" },
  { section: "variant", key: "quantity", label: "Set quantity" },
  { section: "variant", key: "atc_gating", label: "ATC gated until required option chosen?" },

  { section: "add_to_cart", key: "button", label: "Add-to-cart button works" },
  { section: "add_to_cart", key: "confirmation", label: "Cart confirmation appears" },

  { section: "cart", key: "read", label: "Read cart / drawer" },
  { section: "cart", key: "edit_qty", label: "Edit quantity" },
  { section: "cart", key: "remove", label: "Remove an item" },
  { section: "cart", key: "discount", label: "Apply a discount code" },
  { section: "cart", key: "subtotal", label: "Read subtotal" },

  { section: "checkout_info", key: "reach", label: "Reach checkout" },
  { section: "checkout_info", key: "email", label: "Fill email" },
  { section: "checkout_info", key: "address", label: "Fill shipping address" },
  { section: "checkout_info", key: "phone", label: "Fill phone" },
  { section: "checkout_info", key: "validation", label: "Address validation passed" },

  { section: "shipping", key: "options", label: "See shipping options" },
  { section: "shipping", key: "select", label: "Select a method" },
  { section: "shipping", key: "cost", label: "Cost updates" },

  { section: "payment_boundary", key: "reach_card", label: "Reach card screen" },
  { section: "payment_boundary", key: "methods_visible", label: "Payment methods visible" },
  { section: "payment_boundary", key: "stopped_safely", label: "Stopped safely (no card entered)" },

  { section: "confirmation", key: "parseable", label: "Order-confirmation parseable" },
];

export type ObstacleDef = { key: string; label: string };

// Obstacles the agent watches for. Report = "hit" (encountered) or not.
export const OBSTACLE_CHECKS: ObstacleDef[] = [
  { key: "cookie_banner", label: "Cookie banner" },
  { key: "email_sms_popup", label: "Email / SMS popup" },
  { key: "uncloseable_modal", label: "Uncloseable modal" },
  { key: "cart_drawer_unparsed", label: "Cart drawer not parseable" },
  { key: "sticky_atc", label: "Sticky add-to-cart bar" },
  { key: "login_wall", label: "Login wall" },
  { key: "address_validation_error", label: "Address validation error" },
  { key: "phone_validation_error", label: "Phone validation error" },
  { key: "disabled_buttons", label: "Disabled buttons" },
  { key: "iframe_issue", label: "Iframe issue" },
  { key: "cross_domain_checkout", label: "Cross-domain checkout" },
  { key: "captcha_cloudflare_bot", label: "CAPTCHA / Cloudflare / bot check" },
];

export const SECTION_LABELS: Record<FunnelStageName, string> = {
  homepage: "Homepage",
  search: "Search",
  collection: "Collection",
  product: "Product (PDP)",
  variant: "Variant",
  add_to_cart: "Add to cart",
  cart: "Cart",
  checkout_info: "Checkout info",
  shipping: "Shipping",
  payment_boundary: "Payment boundary",
  confirmation: "Confirmation",
};

export const CHECK_KEYS = new Set(CAPABILITY_CHECKS.map((c) => `${c.section}.${c.key}`));
export const OBSTACLE_KEYS = new Set(OBSTACLE_CHECKS.map((o) => o.key));
