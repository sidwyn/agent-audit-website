import { describe, expect, it } from "vitest";
import { detectCaptcha, detectLoginWall, detectPasswordPage } from "../../src/readiness/detect.js";

describe("detectCaptcha", () => {
  it("flags common captcha markers case-insensitively", () => {
    expect(detectCaptcha('<iframe src="https://www.google.com/recaptcha/api2/anchor">')).toBe(true);
    expect(detectCaptcha('<div class="cf-turnstile">')).toBe(true);
    expect(detectCaptcha('<script src="https://challenges.cloudflare.com/x.js">')).toBe(true);
    expect(detectCaptcha("<html><body>plain product page</body></html>")).toBe(false);
  });
});

describe("detectPasswordPage", () => {
  it("detects the shopify password gate by url or form action", () => {
    expect(detectPasswordPage("https://shop.test/password", "<html></html>")).toBe(true);
    expect(detectPasswordPage("https://shop.test/", '<form action="/password" method="post">')).toBe(true);
    expect(detectPasswordPage("https://shop.test/products/x", "<html></html>")).toBe(false);
  });
});

describe("detectLoginWall", () => {
  it("detects account login redirects", () => {
    expect(detectLoginWall("https://shop.test/account/login?return_url=%2Fcart")).toBe(true);
    expect(detectLoginWall("https://shop.test/cart")).toBe(false);
    expect(detectLoginWall("::bad::")).toBe(false);
  });
});
