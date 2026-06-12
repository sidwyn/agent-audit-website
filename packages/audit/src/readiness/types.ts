export type RobotsVerdict = {
  agent: string;
  allowed: boolean;
  matchedGroup: string;
  matchedRule: string | null;
};

export type CheckResult = { pass: boolean; status: number | null; notes: string };

export type Blocker = {
  stage: "product_page" | "variant" | "cart" | "checkout";
  kind:
    | "popup"
    | "geo_gate"
    | "login_wall"
    | "captcha"
    | "password_page"
    | "js_error"
    | "not_found"
    | "timeout";
  detail: string;
};

export type CheckoutProbeResult = {
  productUrl: string | null;
  reachedCart: boolean;
  reachedCheckout: boolean;
  blockers: Blocker[];
  jsErrors: string[];
  timeToCheckoutMs: number | null;
  screenshots: string[];
};

export type ProductPageResult = {
  url: string;
  jsonLd: {
    found: boolean;
    price: boolean;
    priceCurrency: boolean;
    availability: boolean;
    skuOrGtin: boolean;
    image: boolean;
  };
  og: { title: boolean; image: boolean };
  canonical: string | null;
  problems: string[];
};

export type ReadinessReport = {
  store: string;
  generatedAt: string;
  robots: RobotsVerdict[];
  feeds: {
    productsJson: CheckResult;
    sitemap: CheckResult & { productUrlCount: number };
    llmsTxt: CheckResult;
  };
  productPages: ProductPageResult[];
  checkout: CheckoutProbeResult;
};
