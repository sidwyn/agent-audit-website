/**
 * Refresh the vendored datacenter CIDR lists.
 *
 * AWS and GCP publish stable JSON endpoints and are fetched automatically.
 * Azure Service Tags JSON has no stable URL: download it manually from
 * https://www.microsoft.com/en-us/download/details.aspx?id=56519 and pass
 * the file via --azure <path>. Without it, existing azure entries are kept.
 *
 * Run from packages/audit: pnpm exec tsx scripts/update-cidrs.ts [--azure <file>]
 */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/classify/data/datacenter-cidrs.json",
);

type AwsRanges = { prefixes?: { ip_prefix?: string }[]; ipv6_prefixes?: { ipv6_prefix?: string }[] };
type GcpRanges = { prefixes?: { ipv4Prefix?: string; ipv6Prefix?: string }[] };
type AzureServiceTags = { values?: { name?: string; properties?: { addressPrefixes?: string[] } }[] };
type Output = { updatedAt: string; aws: string[]; gcp: string[]; azure: string[] };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function dedupe(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

async function main(): Promise<void> {
  const azureArgIdx = process.argv.indexOf("--azure");
  const azureFile = azureArgIdx > -1 ? process.argv[azureArgIdx + 1] : undefined;

  const aws = await fetchJson<AwsRanges>("https://ip-ranges.amazonaws.com/ip-ranges.json");
  const gcp = await fetchJson<GcpRanges>("https://www.gstatic.com/ipranges/cloud.json");

  let azure: string[];
  if (azureFile) {
    const tags = JSON.parse(readFileSync(azureFile, "utf8")) as AzureServiceTags;
    // The "AzureCloud" service tag is the deduplicated union of all Azure public
    // ranges; prefer it over flattening every per-service/region tag.
    const cloud = (tags.values ?? []).find((v) => v.name === "AzureCloud");
    azure = cloud
      ? dedupe(cloud.properties?.addressPrefixes ?? [])
      : dedupe((tags.values ?? []).flatMap((v) => v.properties?.addressPrefixes ?? []));
  } else {
    try {
      const existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as Output;
      azure = existing.azure;
      console.log("azure: kept existing entries (pass --azure <file> to refresh)");
    } catch {
      // Well-known Azure core blocks as a seed until a Service Tags file is supplied.
      azure = [
        "13.64.0.0/11",
        "20.33.0.0/16",
        "20.34.0.0/15",
        "20.36.0.0/14",
        "20.40.0.0/13",
        "20.48.0.0/12",
        "20.64.0.0/10",
        "40.64.0.0/13",
        "40.74.0.0/15",
        "40.76.0.0/14",
        "40.112.0.0/13",
        "40.120.0.0/14",
        "52.96.0.0/12",
        "52.112.0.0/14",
        "52.224.0.0/11",
        "104.40.0.0/13",
        "104.208.0.0/13",
        "137.116.0.0/16",
        "168.61.0.0/16",
        "191.232.0.0/13",
      ];
      console.log("azure: seeded well-known core blocks (pass --azure <file> for the full list)");
    }
  }

  const out: Output = {
    updatedAt: new Date().toISOString(),
    aws: dedupe([
      ...(aws.prefixes ?? []).map((p) => p.ip_prefix),
      ...(aws.ipv6_prefixes ?? []).map((p) => p.ipv6_prefix),
    ]),
    gcp: dedupe((gcp.prefixes ?? []).map((p) => p.ipv4Prefix ?? p.ipv6Prefix)),
    azure,
  };

  await writeFile(OUT_PATH, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT_PATH}: aws=${out.aws.length} gcp=${out.gcp.length} azure=${out.azure.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
