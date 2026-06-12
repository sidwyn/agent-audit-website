import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import {
  CLOSE_BUTTON_SELECTORS,
  POPUP_DIALOG_SELECTORS,
  detectCaptcha,
  detectLoginWall,
  detectPasswordPage,
} from "./detect.js";
import type { Blocker, CheckoutProbeResult } from "./types.js";

// HARD RULE: this probe never completes a purchase and never enters payment
// details. It stops the moment the checkout information page is reached.
// CAPTCHAs are detected and recorded only — never solved or bypassed.

export type ProbeOpts = { headed?: boolean; stepTimeoutMs?: number };

const ADD_TO_CART_SELECTORS =
  'form[action*="/cart/add"] button[type="submit"]:not([disabled]), form[action*="/cart/add"] input[type="submit"]:not([disabled]), button[name="add"]:not([disabled])';
const CHECKOUT_SELECTORS =
  'button[name="checkout"], input[name="checkout"], a[href*="/checkout"], [data-testid*="checkout"]';

async function screenshot(page: Page, dir: string, name: string, out: string[]): Promise<void> {
  const file = path.join(dir, name);
  try {
    await page.screenshot({ path: file });
    out.push(file);
  } catch {
    // a failed screenshot never sinks the probe
  }
}

async function closeVisiblePopups(
  page: Page,
  stage: Blocker["stage"],
  blockers: Blocker[],
): Promise<void> {
  for (const sel of POPUP_DIALOG_SELECTORS) {
    const dialog = page.locator(sel).first();
    if (!(await dialog.isVisible().catch(() => false))) continue;
    blockers.push({ stage, kind: "popup", detail: `interstitial matched ${sel}` });
    for (const closeSel of CLOSE_BUTTON_SELECTORS) {
      const btn = dialog.locator(closeSel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000 }).catch(() => undefined);
        break;
      }
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }
}

async function selectFirstAvailableVariant(page: Page, blockers: Blocker[]): Promise<void> {
  const selects = page.locator(
    'form[action*="/cart/add"] select, select[name^="options"], variant-selects select',
  );
  for (let i = 0; i < (await selects.count().catch(() => 0)); i++) {
    const select = selects.nth(i);
    const value = await select
      .locator("option:not([disabled])")
      .first()
      .getAttribute("value")
      .catch(() => null);
    if (value) await select.selectOption(value).catch(() => undefined);
  }
  const radios = page.locator('form[action*="/cart/add"] input[type="radio"]:not([disabled])');
  if ((await radios.count().catch(() => 0)) > 0) {
    const anyChecked = await radios.evaluateAll((els) =>
      els.some((el) => (el as unknown as { checked?: boolean }).checked === true),
    ).catch(() => true);
    if (!anyChecked) await radios.first().check({ timeout: 2000 }).catch(() => undefined);
  }
  const addBtn = page.locator(ADD_TO_CART_SELECTORS).first();
  if (!(await addBtn.isVisible().catch(() => false))) {
    blockers.push({
      stage: "variant",
      kind: "not_found",
      detail: "no enabled add-to-cart control (all variants sold out or unrecognized picker)",
    });
  }
}

export async function probeCheckout(
  productUrl: string,
  artifactsDirPath: string,
  opts: ProbeOpts = {},
): Promise<CheckoutProbeResult> {
  await mkdir(artifactsDirPath, { recursive: true });
  const result: CheckoutProbeResult = {
    productUrl,
    reachedCart: false,
    reachedCheckout: false,
    blockers: [],
    jsErrors: [],
    timeToCheckoutMs: null,
    screenshots: [],
  };
  const stepTimeout = opts.stepTimeoutMs ?? 15000;
  const browser = await chromium.launch({ headless: !opts.headed });
  const startedAt = Date.now();
  let stage: Blocker["stage"] = "product_page";

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(stepTimeout);
    page.on("pageerror", (err) => result.jsErrors.push(err.message));

    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    const productHtml = await page.content();
    if (detectPasswordPage(page.url(), productHtml)) {
      result.blockers.push({ stage, kind: "password_page", detail: "store is password-protected" });
      await screenshot(page, artifactsDirPath, "01-product.png", result.screenshots);
      return result;
    }
    if (detectCaptcha(productHtml)) {
      result.blockers.push({ stage, kind: "captcha", detail: "captcha markers on product page (recorded only)" });
    }
    await closeVisiblePopups(page, stage, result.blockers);
    await screenshot(page, artifactsDirPath, "01-product.png", result.screenshots);

    stage = "variant";
    await selectFirstAvailableVariant(page, result.blockers);

    stage = "cart";
    const addBtn = page.locator(ADD_TO_CART_SELECTORS).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500); // let ajax-cart drawers settle
    }
    await page.goto(new URL("/cart", productUrl).toString(), { waitUntil: "domcontentloaded" });
    if (detectLoginWall(page.url())) {
      result.blockers.push({ stage, kind: "login_wall", detail: "cart redirected to account login" });
      await screenshot(page, artifactsDirPath, "02-cart.png", result.screenshots);
      return result;
    }
    const checkoutBtn = page.locator(CHECKOUT_SELECTORS).first();
    result.reachedCart = await checkoutBtn.isVisible().catch(() => false);
    await closeVisiblePopups(page, stage, result.blockers);
    await screenshot(page, artifactsDirPath, "02-cart.png", result.screenshots);
    if (!result.reachedCart) {
      result.blockers.push({ stage, kind: "not_found", detail: "no checkout control on cart page (cart may be empty)" });
      return result;
    }

    stage = "checkout";
    await checkoutBtn.click();
    await page.waitForURL(/checkout|\/checkouts\//, { timeout: stepTimeout });
    const checkoutHtml = await page.content();
    if (detectLoginWall(page.url())) {
      result.blockers.push({ stage, kind: "login_wall", detail: "checkout requires account login" });
    } else if (detectCaptcha(checkoutHtml)) {
      result.blockers.push({ stage, kind: "captcha", detail: "captcha at checkout (recorded only)" });
    }
    const infoField = page.locator('input[name*="email" i], input[type="email"], #email').first();
    result.reachedCheckout = await infoField.isVisible({ timeout: stepTimeout }).catch(() => false);
    if (result.reachedCheckout) result.timeToCheckoutMs = Date.now() - startedAt;
    await screenshot(page, artifactsDirPath, "03-checkout.png", result.screenshots);
    // HARD STOP: checkout information page reached. No fields are ever filled.
    return result;
  } catch (err) {
    result.blockers.push({
      stage,
      kind: "timeout",
      detail: `stage failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    });
    return result;
  } finally {
    await browser.close();
  }
}
