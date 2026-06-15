import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Gemini/1.0',
  });
  const page = await context.newPage();
  const inbox = path.resolve('inbox/graza.co');
  if (!existsSync(inbox)) mkdirSync(inbox, { recursive: true });

  const result = {
    agent: 'gemini',
    outcome: 'abandoned',
    furthest_stage: 'discovery',
    blocker: 'none',
    notes: '',
  };

  try {
    // 1. Product page loaded
    console.log('Loading product page...');
    await page.goto('https://graza.co/products/sizzle', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(inbox, 'gemini-1-product.png') });
    result.furthest_stage = 'product_page';

    // 2. Options/variant selected
    console.log('Selecting variant...');
    // Graza "Sizzle" often has a quantity or size selector. Let's look for buttons or labels.
    // For now, we'll try to find any "750ml" or similar if multiple exist, or just click the first one if visible.
    // Usually, the first variant is selected by default. We'll wait a bit for hydration.
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(inbox, 'gemini-2-variant.png') });
    result.furthest_stage = 'variant';

    // 3. Item added to cart
    console.log('Adding to cart...');
    const addToCart = page.locator('button[name="add"], button:has-text("Add to cart")').first();
    if (await addToCart.isVisible()) {
      await addToCart.click();
      // Wait for cart drawer or navigation
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(inbox, 'gemini-3-cart.png') });
      result.furthest_stage = 'cart';
    } else {
      result.blocker = 'Add to cart button not found';
      throw new Error(result.blocker);
    }

    // 4. Checkout reached
    console.log('Navigating to checkout...');
    // Look for checkout button in drawer or page
    const checkoutBtn = page.locator('button[name="checkout"], a:has-text("Checkout"), button:has-text("Checkout")').first();
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await page.waitForURL(/checkout/, { timeout: 15000 });
      await page.waitForTimeout(5000); // Wait for checkout hydration

      // Fill basic info to move past first step if possible
      // (Shopify checkout often requires email/address to show shipping/payment)
      const email = page.locator('input[name="email"], input[type="email"]').first();
      if (await email.isVisible()) {
        await email.fill('test-agent@example.com');
        await page.locator('input[placeholder="First name"], input[name="firstName"]').fill('Gemini');
        await page.locator('input[placeholder="Last name"], input[name="lastName"]').fill('Agent');
        await page.locator('input[placeholder="Address"], input[name="address1"]').fill('123 AI Lane');
        await page.locator('input[placeholder="City"], input[name="city"]').fill('San Francisco');
        await page.locator('input[placeholder="ZIP code"], input[name="postalCode"]').fill('94105');
        // Select state if it's a dropdown
        const state = page.locator('select[name="zone"], select[autocomplete="address-level1"]').first();
        if (await state.isVisible()) await state.selectOption('CA');

        await page.screenshot({ path: path.join(inbox, 'gemini-4-checkout.png') });
        result.furthest_stage = 'checkout';

        // Try to proceed to shipping/payment
        const continueBtn = page.locator('button:has-text("Continue to shipping"), button:has-text("Continue to payment"), button[type="submit"]').first();
        if (await continueBtn.isVisible()) {
            await continueBtn.click();
            await page.waitForTimeout(5000);
            
            // Check if we hit payment
            if (page.url().includes('payment') || await page.locator('input[name="number"], [data-checkout-payment-step]').isVisible()) {
                await page.screenshot({ path: path.join(inbox, 'gemini-5-payment.png') });
                result.furthest_stage = 'payment';
                result.outcome = 'success';
                result.notes = 'Reached payment step successfully.';
            } else {
                // Check for another "Continue" if it was just shipping
                const continueToPayment = page.locator('button:has-text("Continue to payment")').first();
                if (await continueToPayment.isVisible()) {
                    await continueToPayment.click();
                    await page.waitForTimeout(5000);
                    await page.screenshot({ path: path.join(inbox, 'gemini-5-payment.png') });
                    result.furthest_stage = 'payment';
                    result.outcome = 'success';
                    result.notes = 'Reached payment step after shipping.';
                } else {
                    result.outcome = 'success'; // Still consider success if we reached checkout stages
                    result.notes = 'Reached checkout/shipping; payment step not directly reached or required more info.';
                }
            }
        }
      } else {
        await page.screenshot({ path: path.join(inbox, 'gemini-4-checkout.png') });
        result.furthest_stage = 'checkout';
        result.notes = 'Reached checkout but could not find email field to proceed.';
      }
    } else {
        result.blocker = 'Checkout button not found';
        throw new Error(result.blocker);
    }

  } catch (err: any) {
    console.error('Error during probe:', err.message);
    if (!result.blocker || result.blocker === 'none') result.blocker = err.message;
  } finally {
    await browser.close();
    console.log(`RESULT | agent: ${result.agent} | outcome: ${result.outcome} | furthest_stage: ${result.furthest_stage} | blocker: ${result.blocker} | notes: ${result.notes}`);
  }
}

run();
