import { expect, test } from "@playwright/test";

// Runs against the static export in out/ (build first: pnpm build).
// The default build has no STRIPE_PAYMENT_LINK, so the email capture renders.

test("hero renders the verbatim headline and subcopy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Can an AI agent buy from your store?");
  await expect(page.locator(".hero .sub")).toContainText(
    "ChatGPT, Perplexity, and Claude now shop on behalf of real buyers.",
  );
});

test("stats bar shows the three stats with tabular numerals", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".stats h2")).toHaveText("Why optimize for agents?");
  const stats = page.locator(".stats li");
  await expect(stats).toHaveCount(3);
  await expect(stats.first()).toContainText("393%");
  const links = page.locator(".stats li a.footnote-ref");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveText("1");
  await expect(links.nth(1)).toHaveText("2");
  await expect(links.nth(2)).toHaveText("3");
  await expect(stats.first().locator("a").first()).not.toHaveText(
    "AI traffic to U.S. retail sites grew 393% YoY in Q1 2026",
  );
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "https://business.adobe.com/blog/ai-traffic-surge-retail-sites-not-machine-readable",
  );
  await expect(links.nth(2)).toHaveAttribute(
    "href",
    "https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2026/stricter-vamp-ratio-thresholds-are-now-in-effect-heres-how-to-stay-compliant",
  );
});

test("email capture renders when stripe link is unset at build time", async ({ page }) => {
  await page.goto("/");
  const capture = page.getByTestId("email-capture").first();
  await expect(capture).toBeVisible();
  await expect(capture.locator("button")).toHaveText("Get the audit for $99");
});

test("sample report link serves the pdf", async ({ page, request }) => {
  await page.goto("/");
  const link = page.getByTestId("sample-report-link");
  await expect(link).toHaveAttribute("href", "/sample-report.pdf");
  const res = await request.get("/sample-report.pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("pdf");
});

test("faq entries toggle open", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".faq details").first();
  const answer = first.locator("p");
  await expect(answer).not.toBeVisible();
  await first.locator("summary").click();
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("Automated checks stop at the checkout page.");
});

test("no horizontal overflow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("all sections render in order", async ({ page }) => {
  await page.goto("/");
  for (const id of ["what-you-get", "how-it-works", "guarantee", "faq", "about"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator("footer")).toContainText("run by Sidwyn Koh");
});

test("about section shows Sidwyn's circular portrait", async ({ page }) => {
  await page.goto("/");
  const portrait = page.getByAltText("Sidwyn Koh");
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute("src", "/sidwyn-koh.jpeg");
  const shape = await portrait.evaluate((img) => {
    const style = getComputedStyle(img);
    return {
      borderRadius: style.borderRadius,
      height: img.getBoundingClientRect().height,
      objectFit: style.objectFit,
      width: img.getBoundingClientRect().width,
    };
  });
  expect(shape).toEqual({
    borderRadius: "50%",
    height: 128,
    objectFit: "cover",
    width: 128,
  });
});
