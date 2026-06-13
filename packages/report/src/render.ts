import { chromium } from "playwright";

export async function htmlToPdf(html: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    // Full-bleed: zero page margin so the dark background covers the whole page;
    // breathing room comes from body padding in the template CSS.
    await page.pdf({
      path: outPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
}
