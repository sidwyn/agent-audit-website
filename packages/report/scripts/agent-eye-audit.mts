import { chromium } from 'playwright';

async function agentAudit() {
  console.log('Connecting to existing Chrome on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  console.log('--- Analyzing Product Page: Aluminum Black ---');
  await page.goto('https://ridge.com/products/aluminum-black');
  await page.waitForTimeout(5000);

  const data = await page.evaluate(() => {
    const results: any = {};

    // 1. JSON-LD Check
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    results.jsonLd = scripts.map(s => {
        try {
            const parsed = JSON.parse(s.innerHTML);
            return { type: parsed['@type'], hasProduct: JSON.stringify(parsed).includes('"Product"') };
        } catch (e) {
            return { error: 'Invalid JSON' };
        }
    });

    // 2. Swatch Analysis
    const swatches = Array.from(document.querySelectorAll('.variant-input, .swatch-element, [data-value]'));
    results.swatches = swatches.map(el => ({
        tag: el.tagName,
        classes: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        dataValue: el.getAttribute('data-value'),
        text: (el as HTMLElement).innerText.trim(),
    })).slice(0, 5);

    // 3. Add to Cart Button (Native selectors only)
    const atc = document.querySelector('button[name="add"], .add-to-cart, [data-add-to-cart]');
    results.atcButton = atc ? {
        tag: atc.tagName,
        name: atc.getAttribute('name'),
        text: (atc as HTMLElement).innerText.trim(),
        classes: atc.className
    } : 'Not found';

    // 4. Shopify Window Objects
    results.shopifyFeatures = {
        hasProductObject: !!(window as any).Shopify?.Product,
        hasVariants: !!(window as any).productVariants || !!(window as any).meta?.product?.variants
    };
    
    return results;
  });

  console.log('JSON-LD Analysis:', JSON.stringify(data.jsonLd, null, 2));
  console.log('SAMPLE SWATCHES:', JSON.stringify(data.swatches, null, 2));
  console.log('ATC BUTTON:', JSON.stringify(data.atcButton, null, 2));
  console.log('SHOPIFY OBJECTS:', JSON.stringify(data.shopifyFeatures, null, 2));

  await browser.close();
}

agentAudit().catch(console.error);
