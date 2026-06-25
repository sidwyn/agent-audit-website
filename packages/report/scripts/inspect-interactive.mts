import { chromium } from 'playwright';

async function inspectInteractive() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  console.log('Navigating to Aluminum Black product...');
  await page.goto('https://ridge.com/products/aluminum-black');
  await page.waitForTimeout(5000);

  console.log('--- Accessibility Snapshot (Focusing on Swatches/ATC) ---');
  const ax = await page.accessibility.snapshot();
  
  // Find swatches and button in the tree
  function findNodes(node: any, query: string, results: any[] = []) {
    if (node.name && node.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({ name: node.name, role: node.role, description: node.description });
    }
    if (node.children) {
        for (const child of node.children) findNodes(child, query, results);
    }
    return results;
  }

  const atcButtons = findNodes(ax, 'Add to Cart');
  const variants = findNodes(ax, 'Color'); // Or other common swatch terms
  
  console.log('ATC Buttons found:', JSON.stringify(atcButtons, null, 2));
  console.log('Variant-related nodes found:', JSON.stringify(variants, null, 2));

  // Check if swatches have aria-labels or clear names
  const swatches = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll('.swatch-element, [data-value]').forEach(el => {
        list.push({
            tag: el.tagName,
            class: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            dataValue: el.getAttribute('data-value'),
            innerText: (el as HTMLElement).innerText.trim()
        });
    });
    return list;
  });

  console.log('--- DOM Swatch Analysis ---');
  console.log(JSON.stringify(swatches.slice(0, 5), null, 2));

  await browser.close();
}

inspectInteractive().catch(console.error);
