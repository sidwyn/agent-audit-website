import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type LandingCopy = {
  hero: string;
  whatItStops: string;
  howItWorks: string;
  builtFor: string;
  pricing: string;
  whoBuiltIt: string;
  faq: string;
};

const SECTION_KEYS: { heading: string; key: keyof LandingCopy }[] = [
  { heading: "Hero", key: "hero" },
  { heading: "What it stops", key: "whatItStops" },
  { heading: "How it works", key: "howItWorks" },
  { heading: "Built for self-hosted Shopware", key: "builtFor" },
  { heading: "Pricing", key: "pricing" },
  { heading: "Who built it", key: "whoBuiltIt" },
  { heading: "FAQ", key: "faq" },
];

export function findMarketingFile(startDir = process.cwd()): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "agentarmor-marketing.md");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`agentarmor-marketing.md not found above ${startDir}`);
}

// All landing copy comes verbatim from the marketing markdown; components never
// hardcode marketing strings.
export function loadLandingCopy(mdPath = findMarketingFile()): LandingCopy {
  const md = readFileSync(mdPath, "utf8");

  const landingStart = md.indexOf("## Landing page copy");
  if (landingStart === -1) throw new Error(`missing "## Landing page copy" in ${mdPath}`);
  const rest = md.slice(landingStart + "## Landing page copy".length);
  const nextH2 = rest.search(/^## /m);
  const landing = nextH2 === -1 ? rest : rest.slice(0, nextH2);

  const out = {} as LandingCopy;
  for (const { heading, key } of SECTION_KEYS) {
    const re = new RegExp(`^### ${heading}\\s*$`, "m");
    const m = re.exec(landing);
    if (!m) throw new Error(`missing landing section "### ${heading}" in ${mdPath}`);
    const from = m.index + m[0].length;
    const tail = landing.slice(from);
    const end = tail.search(/^### |^---$/m);
    out[key] = (end === -1 ? tail : tail.slice(0, end)).trim();
  }
  return out;
}
