import { chromium } from 'playwright';

async function inspectCurrent() {
  console.log('Connecting to existing Chrome on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0]; // Use the ALREADY OPEN page

  if (!page) {
    console.error('No active page found in Chrome!');
    return;
  }

  console.log('Inspecting current page:', await page.title());
  
  const data = await page.evaluate(() => {
    const results: any = {};
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    results.jsonLd = scripts.map(s => {
        try { return JSON.parse(s.innerHTML)['@type']; } catch (e) { return 'Invalid'; }
    });
    
    // Look for swatches specifically
    const swatches = Array.from(document.querySelectorAll('button, div, label')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundImage.includes('url') || style.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    
    results.potentialSwatches = swatches.map(el => ({
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        id: el.id,
        text: (el as HTMLElement).innerText
    })).slice(0, 10);

    return results;
  });

  console.log('Data:', JSON.stringify(data, null, 2));
  await browser.close();
}

inspectCurrent().catch(console.error);
