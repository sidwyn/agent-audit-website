import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "/Users/sidwyn/Personal Projects/interviewing/agent-commerce-audit/packages/audit/inbox/ridge.com/";

async function takeScreenshot(page: Page, filename: string) {
  const filePath = path.join(OUT_DIR, filename);
  console.log(`[Screenshot] Saving to: ${filePath}`);
  await page.screenshot({ path: filePath, fullPage: false });
}

async function closePopups(page: Page) {
  console.log("[Popups] Checking for popups or overlays...");
  // Try to close common email/sms popups or cookie banners
  const closeSelectors = [
    'button[aria-label*="close" i]',
    'button[class*="close" i]',
    'a[class*="close" i]',
    '[data-testid*="close" i]',
    '#shopify-pc__banner [class*="close" i]',
    '.needsclick.kl-private-reset-css-keep-this button',
    '[class*="newsletter" i] [class*="close" i]',
  ];

  for (const selector of closeSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[Popups] Found visible close element with selector: ${selector}. Clicking...`);
        await el.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // ignore
    }
  }

  // Press Escape to dismiss generic modals
  await page.keyboard.press("Escape").catch(() => {});
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("[Init] Launching local Google Chrome browser (headful)...");
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // Catch unhandled errors/console logs
  page.on("pageerror", (err) => console.error(`[Page Error] ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Page Console Error] ${msg.text()}`);
    }
  });

  try {
    // ----------------------------------------------------
    // STAGE 1: Homepage
    // ----------------------------------------------------
    console.log("\n--- STAGE 1: Homepage ---");
    console.log("[Navigation] Going to https://ridge.com/ ...");
    await page.goto("https://ridge.com/", { waitUntil: "domcontentloaded" });
    
    console.log("[Navigation] Waiting for homepage content to load (please solve the Cloudflare verification challenge in the browser if it appears)...");
    await page.waitForSelector('header, a[href="/search"], button[aria-label*="search" i], [id*="shopify-section-header"]', { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);
    await closePopups(page);
    await takeScreenshot(page, "gemini-1-homepage.png");

    // ----------------------------------------------------
    // STAGE 2: Search
    // ----------------------------------------------------
    console.log("\n--- STAGE 2: Search ---");
    // Let's locate the search button / search icon.
    // We can try to look for header search element
    console.log("[Search] Locating search button or input...");
    let searchOpened = false;
    const searchSelectors = [
      'a[href="/search"]',
      'button[aria-label*="search" i]',
      '[data-testid*="search" i]',
      'header input[type="search"]',
      'header input[name="q"]',
      'summary[aria-label*="Search" i]',
    ];

    for (const sel of searchSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        console.log(`[Search] Clicking search element: ${sel}`);
        await el.click();
        searchOpened = true;
        await page.waitForTimeout(1000);
        break;
      }
    }

    if (!searchOpened) {
      console.log("[Search] Could not find header search trigger, navigating directly to /search");
      await page.goto("https://ridge.com/search", { waitUntil: "domcontentloaded" });
    }

    // Now type "wallet" into the search input
    console.log("[Search] Typing 'wallet' into search input...");
    const inputSelectors = [
      'input[type="search"]',
      'input[name="q"]',
      'input[placeholder*="Search" i]',
    ];
    let typed = false;
    for (const sel of inputSelectors) {
      const input = page.locator(sel).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill("wallet");
        await input.press("Enter");
        typed = true;
        console.log(`[Search] Search query submitted via: ${sel}`);
        break;
      }
    }

    if (!typed) {
      console.log("[Search] Could not find search input to type, navigating directly to search results");
      await page.goto("https://ridge.com/search?q=wallet", { waitUntil: "domcontentloaded" });
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "gemini-2-search.png");

    // ----------------------------------------------------
    // STAGE 3: Collection
    // ----------------------------------------------------
    console.log("\n--- STAGE 3: Collection ---");
    console.log("[Collection] Navigating to https://ridge.com/collections/wallets ...");
    await page.goto("https://ridge.com/collections/wallets", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await closePopups(page);
    await takeScreenshot(page, "gemini-3-collection.png");

    // ----------------------------------------------------
    // STAGE 4: Product (Start Time)
    // ----------------------------------------------------
    console.log("\n--- STAGE 4: Product ---");
    const startTime = Date.now();
    console.log(`[Product] Opening product page... Start time: ${new Date(startTime).toISOString()}`);
    await page.goto("https://ridge.com/products/ridge-wallet", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await closePopups(page);
    await takeScreenshot(page, "gemini-4-product.png");

    // ----------------------------------------------------
    // STAGE 5: Variant
    // ----------------------------------------------------
    console.log("\n--- STAGE 5: Variant ---");
    console.log("[Variant] Selecting Royal Black / Matte Black color option...");
    // Let's try to click on a variant swatch. Let's see what variant swatches exist or if default is ok.
    // The Ridge Wallet page has various swatches. Let's look for colors.
    // We can try to click on one of the swatches, e.g. "matte-black" or "Royal Black" or select first button in options.
    const colorSwatches = [
      'button[aria-label*="matte black" i]',
      'button[aria-label*="Royal Black" i]',
      '[data-value*="Matte Black" i]',
      '[aria-label*="Color" i] button',
      '.product-form__input input[type="radio"] + label',
    ];

    let swatchClicked = false;
    for (const sel of colorSwatches) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        console.log(`[Variant] Clicking swatch: ${sel}`);
        await el.click();
        swatchClicked = true;
        await page.waitForTimeout(1000);
        break;
      }
    }

    if (!swatchClicked) {
      console.log("[Variant] Swatch click not executed, proceeding with default selected variant");
    }

    await takeScreenshot(page, "gemini-5-variant.png");

    // ----------------------------------------------------
    // STAGE 6: Add to Cart (End Time)
    // ----------------------------------------------------
    console.log("\n--- STAGE 6: Add to Cart ---");
    console.log("[ATC] Locating add to cart button...");
    const atcSelectors = [
      'button[name="add"]',
      'button[id*="AddToCart"]',
      'button:has-text("Add To Cart")',
      'button:has-text("Add to cart")',
      '[data-add-to-cart]',
      '.product-form__submit',
    ];

    let atcClicked = false;
    for (const sel of atcSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false) && !(await el.isDisabled().catch(() => false))) {
        console.log(`[ATC] Clicking Add to Cart button: ${sel}`);
        await el.click();
        atcClicked = true;
        break;
      }
    }

    if (!atcClicked) {
      throw new Error("Could not find or click Add to Cart button");
    }

    // Wait for cart drawer/pop-up/success notification to show
    console.log("[ATC] Waiting for cart confirmation or drawer...");
    await page.waitForTimeout(2000);
    const endTime = Date.now();
    const timeToCartSeconds = Math.round((endTime - startTime) / 1000);
    console.log(`[ATC] Item added to cart! End time: ${new Date(endTime).toISOString()}`);
    console.log(`[ATC] TIME TO CART: ${timeToCartSeconds} seconds`);

    await takeScreenshot(page, "gemini-6-add_to_cart.png");

    // ----------------------------------------------------
    // STAGE 7: Cart
    // ----------------------------------------------------
    console.log("\n--- STAGE 7: Cart ---");
    // Make sure cart drawer or cart page is visible.
    // Let's navigate to /cart if the drawer is not visible or just go there to be sure
    console.log("[Cart] Navigating to https://ridge.com/cart to ensure cart page is loaded...");
    await page.goto("https://ridge.com/cart", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await closePopups(page);
    await takeScreenshot(page, "gemini-7-cart.png");

    // ----------------------------------------------------
    // STAGE 8: Checkout Info
    // ----------------------------------------------------
    console.log("\n--- STAGE 8: Checkout Info ---");
    console.log("[Checkout] Locating checkout button...");
    const checkoutSelectors = [
      'button[name="checkout"]',
      'input[name="checkout"]',
      'a[href*="/checkout"]',
      'button:has-text("Checkout")',
      'a:has-text("Checkout")',
      '.cart__checkout-button',
    ];

    let checkoutClicked = false;
    for (const sel of checkoutSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        console.log(`[Checkout] Clicking checkout button: ${sel}`);
        await el.click();
        checkoutClicked = true;
        break;
      }
    }

    if (!checkoutClicked) {
      throw new Error("Could not find or click Checkout button");
    }

    console.log("[Checkout] Waiting for checkout page to load...");
    // Shopify checkout path usually contains /checkouts/ or /checkout
    await page.waitForURL(/checkout|\/checkouts\//, { timeout: 15000 }).catch(() => {
      console.log(`[Checkout] URL after checkout click: ${page.url()}`);
    });
    await page.waitForTimeout(4000);

    // Fill contact details
    console.log("[Checkout] Filling customer information (fake data)...");
    
    // Shopify checkout fields are usually email, shipping address elements.
    // Standard selectors for email:
    const emailSelector = 'input[type="email"], input[id="email"], input[name="email"]';
    if (await page.locator(emailSelector).first().isVisible().catch(() => false)) {
      await page.locator(emailSelector).first().fill("john.doe.test.buyer@example.com");
      console.log("[Checkout] Email filled.");
    }

    // Shipping address selectors
    const firstNameSelector = 'input[name="firstName"], input[id="TextField0"], input[placeholder*="First name" i]';
    const lastNameSelector = 'input[name="lastName"], input[id="TextField1"], input[placeholder*="Last name" i]';
    const addressSelector = 'input[name="address1"], input[id="shipping-address1"], input[placeholder*="Address" i]';
    const citySelector = 'input[name="city"], input[placeholder*="City" i]';
    const stateSelector = 'select[name="zone"], select[name="province"], select[name*="state" i]';
    const stateInputSelector = 'input[placeholder*="State" i]';
    const zipSelector = 'input[name="postalCode"], input[placeholder*="ZIP" i], input[placeholder*="Postal code" i]';
    const phoneSelector = 'input[name="phone"], input[type="tel"]';

    if (await page.locator(firstNameSelector).first().isVisible().catch(() => false)) {
      await page.locator(firstNameSelector).first().fill("John");
    }
    if (await page.locator(lastNameSelector).first().isVisible().catch(() => false)) {
      await page.locator(lastNameSelector).first().fill("Doe");
    }
    if (await page.locator(addressSelector).first().isVisible().catch(() => false)) {
      await page.locator(addressSelector).first().fill("123 Main St");
      await page.waitForTimeout(500);
      // Press escape in case autocomplete overlay opens
      await page.keyboard.press("Escape").catch(() => {});
    }
    if (await page.locator(citySelector).first().isVisible().catch(() => false)) {
      await page.locator(citySelector).first().fill("New York");
    }
    if (await page.locator(stateSelector).first().isVisible().catch(() => false)) {
      await page.locator(stateSelector).first().selectOption("NY");
    } else if (await page.locator(stateInputSelector).first().isVisible().catch(() => false)) {
      await page.locator(stateInputSelector).first().fill("NY");
    }
    if (await page.locator(zipSelector).first().isVisible().catch(() => false)) {
      await page.locator(zipSelector).first().fill("10001");
    }
    if (await page.locator(phoneSelector).first().isVisible().catch(() => false)) {
      await page.locator(phoneSelector).first().fill("2125550199");
    }

    await page.waitForTimeout(2000);
    await takeScreenshot(page, "gemini-8-checkout_info.png");

    // ----------------------------------------------------
    // STAGE 9: Shipping
    // ----------------------------------------------------
    console.log("\n--- STAGE 9: Shipping ---");
    console.log("[Shipping] Submitting contact details to go to shipping...");
    const continueToShippingSelectors = [
      'button:has-text("Continue to shipping")',
      'button[type="submit"]:has-text("Continue")',
      'button[type="submit"]',
    ];

    let shippingContinueClicked = false;
    for (const sel of continueToShippingSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        console.log(`[Shipping] Clicking continue to shipping button: ${sel}`);
        await el.click();
        shippingContinueClicked = true;
        break;
      }
    }

    if (!shippingContinueClicked) {
      throw new Error("Could not find or click continue to shipping button");
    }

    await page.waitForTimeout(4000);
    console.log(`[Shipping] Current URL: ${page.url()}`);
    await takeScreenshot(page, "gemini-9-shipping.png");

    // ----------------------------------------------------
    // STAGE 10: Payment Boundary
    // ----------------------------------------------------
    console.log("\n--- STAGE 10: Payment Boundary ---");
    console.log("[Payment] Submitting shipping option to go to payment...");
    const continueToPaymentSelectors = [
      'button:has-text("Continue to payment")',
      'button[type="submit"]:has-text("Continue")',
      'button[type="submit"]',
    ];

    let paymentContinueClicked = false;
    for (const sel of continueToPaymentSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        console.log(`[Payment] Clicking continue to payment button: ${sel}`);
        await el.click();
        paymentContinueClicked = true;
        break;
      }
    }

    if (!paymentContinueClicked) {
      throw new Error("Could not find or click continue to payment button");
    }

    await page.waitForTimeout(4000);
    console.log(`[Payment] Current URL: ${page.url()}`);
    await takeScreenshot(page, "gemini-10-payment_boundary.png");

    // Check if card iframe or details exist
    const paymentFormExists = await page.locator('iframe[title*="Secure card" i], iframe[name*="private-iframe" i], [id*="payment" i]').first().isVisible().catch(() => false);
    console.log(`[Payment] Payment forms/iframes visible: ${paymentFormExists}`);
    console.log("[Payment] STOPPING SAFELY NOW. We will not enter payment details or place order.");

    // ----------------------------------------------------
    // STAGE 11: Confirmation
    // ----------------------------------------------------
    console.log("\n--- STAGE 11: Confirmation ---");
    // Duplicate screenshot for 11 since we stop at payment boundary
    await takeScreenshot(page, "gemini-11-confirmation.png");

  } catch (err) {
    console.error(`[Error] Execution failed: ${err instanceof Error ? err.message : String(err)}`);
    // Capture error screen if possible
    await page.screenshot({ path: path.join(OUT_DIR, "error-capture.png") }).catch(() => {});
  } finally {
    console.log("[Cleanup] Closing browser...");
    await browser.close();
  }
}

run();
