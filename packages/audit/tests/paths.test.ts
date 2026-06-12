import { describe, expect, it } from "vitest";
import { storeSlug } from "../src/paths.js";

describe("storeSlug", () => {
  it("normalizes URLs and domains to a filesystem-safe slug", () => {
    expect(storeSlug("https://Shop.Example.com/path?x=1")).toBe("shop.example.com");
    expect(storeSlug("shop.example.com")).toBe("shop.example.com");
    expect(storeSlug("my-store.myshopify.com")).toBe("my-store.myshopify.com");
  });
});
