import { chromium } from 'playwright';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

async function capture() {
  // Use absolute path to project root inbox
  const inbox = '/Users/sidwyn/Personal Projects/interviewing/agent-commerce-audit/inbox/ridge.com';
  if (!existsSync(inbox)) mkdirSync(inbox, { recursive: true });

  console.log('Connecting to existing Chrome on port 9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    // Ensure viewport is reasonable
    await page.setViewportSize({ width: 1280, height: 800 });

    const stages = [
      { url: 'https://ridge.com', file: 'chatgpt-1-homepage.png', wait: 8000 },
      { url: 'https://ridge.com/search?q=ridge+wallet', file: 'chatgpt-2-search.png', wait: 8000 },
      { url: 'https://ridge.com/collections/wallets', file: 'chatgpt-3-collection.png', wait: 8000 },
      { url: 'https://ridge.com/products/aluminum-black', file: 'chatgpt-4-product.png', wait: 8000 },
      { url: null, file: 'chatgpt-5-variant.png', wait: 3000 },
      { url: null, file: 'chatgpt-6-add_to_cart.png', wait: 3000 },
      { url: 'https://ridge.com/cart', file: 'chatgpt-7-cart.png', wait: 8000 },
      { url: 'https://ridge.com/checkout', file: 'chatgpt-8-checkout_info.png', wait: 12000 },
      { url: null, file: 'chatgpt-9-shipping.png', wait: 6000 },
      { url: null, file: 'chatgpt-10-payment_boundary.png', wait: 6000 },
      { url: null, file: 'chatgpt-11-confirmation.png', wait: 3000 },
    ];

    for (const stage of stages) {
      if (stage.url) {
        console.log(`Navigating to ${stage.url}...`);
        await page.goto(stage.url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(stage.wait);
      } else {
        console.log(`Waiting ${stage.wait}ms for stage ${stage.file}...`);
        await page.waitForTimeout(stage.wait);
      }

      // Close popups
      await page.evaluate(() => {
        const selectors = ['#smile-ui-container', '.needsclick', '[aria-label="Close"]', '.modal-close', '.klaviyo-form'];
        selectors.forEach(s => {
          const els = document.querySelectorAll(s);
          els.forEach(el => (el as HTMLElement).style.display = 'none');
        });
      }).catch(() => {});

      const screenshotPath = path.join(inbox, stage.file);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Captured ${stage.file}`);
    }

    await browser.close();
  } catch (err) {
    console.error('Error connecting to Chrome:', err);
  }
}

capture().catch(console.error);
