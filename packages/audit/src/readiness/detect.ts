export const CAPTCHA_MARKERS = [
  "recaptcha",
  "hcaptcha",
  "cf-turnstile",
  "challenges.cloudflare.com",
  "arkoselabs",
  "px-captcha",
] as const;

// Detection only — we record CAPTCHA presence and never attempt to solve or bypass.
export function detectCaptcha(html: string): boolean {
  const low = html.toLowerCase();
  return CAPTCHA_MARKERS.some((m) => low.includes(m));
}

export function detectPasswordPage(url: string, html: string): boolean {
  try {
    if (new URL(url).pathname.replace(/\/$/, "") === "/password") return true;
  } catch {
    // fall through to html check
  }
  return /<form[^>]+action=["'][^"']*\/password["']/i.test(html);
}

export function detectLoginWall(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/account/login");
  } catch {
    return false;
  }
}

export const POPUP_DIALOG_SELECTORS = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  ".modal.is-open",
  "#shopify-pc__banner",
] as const;

export const CLOSE_BUTTON_SELECTORS = [
  '[aria-label*="close" i]',
  'button[class*="close" i]',
  '[data-testid*="close" i]',
] as const;
