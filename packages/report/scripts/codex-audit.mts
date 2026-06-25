import { chromium } from 'playwright';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

async function runAudit() {
  const inbox = '/Users/sidwyn/Personal Projects/interviewing/agent-commerce-audit/inbox/ridge.com';
  if (!existsSync(inbox)) mkdirSync(inbox, { recursive: true });

  const startTime = Date.now();
  let timeToCart = 'none';

  console.log('Connecting to Chrome on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  
  await page.setViewportSize({ width: 1280, height: 900 });

  async function snap(name: string) {
    await page.waitForTimeout(2000);
    // Dismiss popups
    await page.evaluate(() => {
      const selectors = ['#smile-ui-container', '.needsclick', '[aria-label="Close"]', '.modal-close', '.klaviyo-form'];
      selectors.forEach(s => {
        const els = document.querySelectorAll(s);
        els.forEach(el => (el as HTMLElement).style.display = 'none');
      });
    }).catch(() => {});
    await page.screenshot({ path: path.join(inbox, name) });
    console.log(`Captured ${name}`);
  }

  try {
    // 1. Homepage
    console.log('1. Homepage');
    await page.goto('https://ridge.com', { waitUntil: 'load' });
    await snap('codex-1-homepage.png');

    // 2. Search
    console.log('2. Search');
    await page.goto('https://ridge.com/search?q=ridge+wallet', { waitUntil: 'load' });
    await snap('codex-2-search.png');

    // 3. Collection
    console.log('3. Collection');
    await page.goto('https://ridge.com/collections/wallets', { waitUntil: 'load' });
    await snap('codex-3-collection.png');

    // 4. Product
    console.log('4. Product');
    await page.goto('https://ridge.com/products/aluminum-black', { waitUntil: 'load' });
    await snap('codex-4-product.png');

    // 5. Variant
    console.log('5. Variant');
    // Attempt to select a variant if possible, or just snap
    await page.evaluate(() => {
       const swatches = document.querySelectorAll('.swatch-element, [data-value]');
       if (swatches.length > 1) (swatches[1] as HTMLElement).click();
    }).catch(() => {});
    await snap('codex-5-variant.png');

    // 6. Add to Cart
    console.log('6. Add to Cart');
    const atc = page.locator('button[name="add"], button:has-text("Add to Cart"), .add-to-cart').first();
    if (await atc.isVisible()) {
        await atc.click();
        timeToCart = String(Math.round((Date.now() - startTime) / 1000));
    }
    await snap('codex-6-add_to_cart.png');

    // 7. Cart
    console.log('7. Cart');
    // Usually side cart opens, if not go to /cart
    await page.waitForTimeout(2000);
    if (!page.url().includes('cart') && !(await page.locator('.cart-drawer, #CartDrawer').isVisible())) {
        await page.goto('https://ridge.com/cart');
    }
    await snap('codex-7-cart.png');

    // 8. Checkout Info
    console.log('8. Checkout Info');
    const checkoutBtn = page.locator('button[name="checkout"], .checkout-btn, a[href*="checkout"]').first();
    if (await checkoutBtn.isVisible()) {
        await checkoutBtn.click();
    } else {
        await page.goto('https://ridge.com/checkout');
    }
    await page.waitForURL(/checkout/, { timeout: 15000 });
    await page.waitForTimeout(5000);
    await snap('codex-8-checkout_info.png');

    // 9. Shipping
    console.log('9. Shipping');
    // Fill fake info to reach shipping
    await page.evaluate(() => {
        const fill = (sel: string, val: string) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        fill('input[name="email"]', 'test-codex@example.com');
        fill('input[name="firstName"]', 'Codex');
        fill('input[name="lastName"]', 'Agent');
        fill('input[name="address1"]', '123 AI Lane');
        fill('input[name="city"]', 'San Francisco');
        fill('input[name="postalCode"]', '94105');
    }).catch(() => {});
    
    // Click continue
    const continueBtn = page.locator('button:has-text("Continue to shipping"), #continue_button').first();
    if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(5000);
    }
    await snap('codex-9-shipping.png');

    // 10. Payment Boundary
    console.log('10. Payment Boundary');
    const continuePay = page.locator('button:has-text("Continue to payment"), #continue_button').first();
    if (await continuePay.isVisible()) {
        await continuePay.click();
        await page.waitForTimeout(5000);
    }
    await snap('codex-10-payment_boundary.png');

    // 11. Confirmation
    console.log('11. Confirmation');
    await snap('codex-11-confirmation.png');

    console.log('Audit complete.');
    console.log(`TIME_TO_CART: ${timeToCart}`);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await browser.close();
  }
}

runAudit();
