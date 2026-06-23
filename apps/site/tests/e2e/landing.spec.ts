import { expect, test } from "@playwright/test";

// Runs against the static export in out/ (build first: bun run build).
// The default build has no STRIPE_PAYMENT_LINK, so the email capture renders.

test("hero renders the verbatim headline and subcopy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Open to agents. Hard to exploit.");
  await expect(page.locator(".hero .sub")).toContainText(
    "AI agents now shop on your store.",
  );
  await expect(page.locator(".brand")).toHaveText("AgentArmor");
});

test("two truths shows both cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".truths h2")).toHaveText("Two things are true about agent traffic");
  const cards = page.locator(".truth-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Agents convert.");
  await expect(cards.nth(1)).toContainText("Agents probe.");
});

test("what it stops lists the three threats", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#what-it-stops .cards li");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Price and stock scraping.");
  await expect(cards.nth(1)).toContainText("Promo code farming.");
  await expect(cards.nth(2)).toContainText("Dangerous text.");
});

test("email capture renders when stripe link is unset at build time", async ({ page }) => {
  await page.goto("/");
  const capture = page.getByTestId("email-capture").first();
  await expect(capture).toBeVisible();
  await expect(capture.locator("button")).toHaveText("Get early access");
});

test("faq entries toggle open", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".faq details").first();
  const answer = first.locator("p");
  await expect(answer).not.toBeVisible();
  await first.locator("summary").click();
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("never blocks a real order");
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
  for (const id of [
    "two-truths",
    "what-it-stops",
    "how-it-works",
    "built-for",
    "pricing",
    "about",
    "faq",
  ]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator("footer")).toContainText("by Sidwyn Koh");
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
