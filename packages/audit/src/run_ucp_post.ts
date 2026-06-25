import { chromium } from "playwright";

async function run() {
  console.log("[UCP] Connecting to local Chrome instance on port 9223...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error("No active context found.");
  }

  const page = await context.newPage();

  try {
    // Navigate to ridge.com first to set the correct origin and cookies
    console.log("[UCP] Navigating to https://ridge.com/ ...");
    await page.goto("https://ridge.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Fetch the products JSON inside the browser context to get a valid variant ID
    console.log("[UCP] Fetching products list from browser context...");
    const productInfo = await page.evaluate(async () => {
      const res = await fetch("/collections/wallets/products.json");
      const data = (await res.json()) as any;
      const firstProduct = data.products[0];
      return {
        title: firstProduct.title,
        handle: firstProduct.handle,
        variantId: firstProduct.variants[0].id
      };
    });

    console.log(`[UCP] Found active product: "${productInfo.title}" (variant ID: ${productInfo.variantId})`);

    // Perform the UCP POST request inside the browser context
    console.log("[UCP] Sending create_checkout POST request to UCP MCP endpoint...");
    const ucpResponse = await page.evaluate(async (varId) => {
      const ucpEndpoint = "https://ridge-wallet.myshopify.com/api/ucp/mcp";
      const payload = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "create_checkout",
          arguments: {
            meta: { "ucp-agent": { "profile": "https://agentaudit-two.vercel.app/agent-profile.json" } },
            checkout: { "line_items": [ { "item": { "id": `gid://shopify/ProductVariant/${varId}` }, "quantity": 1 } ] }
          }
        },
        id: 1
      };

      const res = await fetch(ucpEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
    }, productInfo.variantId);

    console.log("[UCP] UCP MCP Checkout Response:");
    console.log(JSON.stringify(ucpResponse, null, 2));

  } catch (e) {
    console.error("[UCP Error]", e);
  } finally {
    await page.close();
  }
}

run();
