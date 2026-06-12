import { readFileSync } from "node:fs";

function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = (out << 8n) | BigInt(n);
  }
  return out;
}

function ipv6ToBigInt(ip: string): bigint | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 && fill < 0) return null;
  if (halves.length === 1 && head.length !== 8) return null;
  const groups = [...head, ...Array<string>(Math.max(fill, 0)).fill("0"), ...tail];
  let out = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    out = (out << 16n) | BigInt(parseInt(g, 16));
  }
  return out;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  if (!base || !bitsRaw) return false;
  const bits = Number(bitsRaw);
  const v4 = !base.includes(":");
  if (v4 !== !ip.includes(":")) return false;
  const size = v4 ? 32 : 128;
  if (!Number.isInteger(bits) || bits < 0 || bits > size) return false;
  const ipVal = v4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  const baseVal = v4 ? ipv4ToBigInt(base) : ipv6ToBigInt(base);
  if (ipVal === null || baseVal === null) return false;
  const shift = BigInt(size - bits);
  return ipVal >> shift === baseVal >> shift;
}

export function ipInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}

type DatacenterRanges = { aws: string[]; gcp: string[]; azure: string[] };

let cached: string[] | null = null;

export function loadDatacenterCidrs(): string[] {
  if (!cached) {
    const url = new URL("./data/datacenter-cidrs.json", import.meta.url);
    const parsed = JSON.parse(readFileSync(url, "utf8")) as DatacenterRanges;
    cached = [...parsed.aws, ...parsed.gcp, ...parsed.azure];
  }
  return cached;
}
