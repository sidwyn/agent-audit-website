import { describe, expect, it } from "vitest";
import { ipInAnyCidr, ipInCidr, loadDatacenterCidrs } from "../../src/classify/cidr.js";

describe("ipInCidr", () => {
  it("matches IPv4 in CIDR", () => {
    expect(ipInCidr("3.5.140.10", "3.5.140.0/22")).toBe(true);
    expect(ipInCidr("3.5.144.1", "3.5.140.0/22")).toBe(false);
    expect(ipInCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
    expect(ipInCidr("11.0.0.1", "10.0.0.0/8")).toBe(false);
  });

  it("matches IPv6 in CIDR", () => {
    expect(ipInCidr("2600:1f13::1", "2600:1f13::/36")).toBe(true);
    expect(ipInCidr("2001:db8::1", "2600:1f13::/36")).toBe(false);
  });

  it("returns false for malformed input and mixed families", () => {
    expect(ipInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
    expect(ipInCidr("10.0.0.1", "not-a-cidr")).toBe(false);
    expect(ipInCidr("10.0.0.1", "2600::/12")).toBe(false);
    expect(ipInCidr("999.0.0.1", "10.0.0.0/8")).toBe(false);
    expect(ipInCidr("10.0.0.1", "10.0.0.0/64")).toBe(false);
  });
});

describe("ipInAnyCidr", () => {
  it("scans a list", () => {
    expect(ipInAnyCidr("3.5.140.10", ["1.2.3.0/24", "3.5.140.0/22"])).toBe(true);
    expect(ipInAnyCidr("8.8.8.8", ["1.2.3.0/24", "3.5.140.0/22"])).toBe(false);
  });
});

describe("loadDatacenterCidrs", () => {
  it("loads a non-empty vendored list covering aws, gcp and azure", () => {
    const cidrs = loadDatacenterCidrs();
    expect(cidrs.length).toBeGreaterThan(10000); // real AWS + GCP + Azure ranges
    expect(ipInAnyCidr("3.5.140.9", cidrs)).toBe(true); // AWS us-east range
    expect(ipInAnyCidr("102.133.5.5", cidrs)).toBe(true); // Azure (102.133.0.0/19) — where ChatGPT/OpenAI egress
  });
});
