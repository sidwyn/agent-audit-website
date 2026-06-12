import path from "node:path";

export function storeSlug(input: string): string {
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  const host = new URL(withScheme).hostname.toLowerCase();
  return host.replace(/[^a-z0-9.-]/g, "-");
}

export function dataDir(store: string): string {
  return path.join(process.cwd(), "data", storeSlug(store));
}

export function artifactsDir(store: string): string {
  return path.join(process.cwd(), "artifacts", storeSlug(store));
}
