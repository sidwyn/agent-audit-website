/**
 * Watch an inbox folder and auto-regenerate per-store reports as agents drop results.
 *
 * Layout: <inbox>/<store-slug>/  containing
 *   - any *.txt / *.md / *.json with a "RESULT | agent: ... | ..." line per agent
 *   - any *.png screenshots
 * On change, the matching <cohort>/<slug> report is rebuilt (manual-runs.yaml updated,
 * screenshots copied into live-session/, report.pdf re-rendered). Each regenerated store
 * prints a line (so it surfaces as a notification when watched).
 *
 * Usage: pnpm exec tsx scripts/watch-inbox.mts <inboxDir> <cohortDir> [benchmarkStats.json]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { manualRunsFileSchema, parseReplies, type ManualRun } from "@agentaudit/audit";
import { parse as parseYaml, stringify as yamlStringify } from "yaml";
import { loadCohort } from "../src/benchmark.js";
import { htmlToPdf } from "../src/render.js";
import { composeReport } from "../src/template.js";

const inboxDir = path.resolve(process.argv[2] ?? "inbox");
const cohortDir = path.resolve(process.argv[3] ?? "cohort");
const benchmarkPath = process.argv[4];
const POLL_MS = 3000;

function sig(dir: string): string {
  try {
    return readdirSync(dir)
      .map((f) => {
        try {
          return `${f}:${statSync(path.join(dir, f)).mtimeMs}`;
        } catch {
          return f;
        }
      })
      .sort()
      .join("|");
  } catch {
    return "";
  }
}

function dataUri(p: string): string | undefined {
  return existsSync(p) ? `data:image/png;base64,${readFileSync(p).toString("base64")}` : undefined;
}

async function regen(slug: string): Promise<void> {
  const inSub = path.join(inboxDir, slug);
  const storeDir = path.join(cohortDir, slug);
  if (!existsSync(path.join(storeDir, "readiness.json")) || !existsSync(path.join(storeDir, "store.json"))) {
    console.log(`skip ${slug}: no readiness.json/store.json under ${cohortDir}`);
    return;
  }
  const files = readdirSync(inSub);
  const text = files
    .filter((f) => /\.(txt|md|json)$/i.test(f))
    .map((f) => readFileSync(path.join(inSub, f), "utf8"))
    .join("\n");
  const liveDir = path.join(storeDir, "live-session");
  mkdirSync(liveDir, { recursive: true });
  const shotPaths: string[] = [];
  for (const s of files.filter((f) => /\.png$/i.test(f))) {
    copyFileSync(path.join(inSub, s), path.join(liveDir, s));
    shotPaths.push(path.relative(process.cwd(), path.join(liveDir, s)));
  }

  const yamlPath = path.join(storeDir, "manual-runs.yaml");
  let manualRuns: ManualRun[] = existsSync(yamlPath)
    ? manualRunsFileSchema.parse(parseYaml(readFileSync(yamlPath, "utf8"))).runs
    : [];

  const inboxRuns = parseReplies(text);
  if (inboxRuns.length > 0) {
    if (shotPaths.length) inboxRuns.forEach((r) => (r.screenshots = shotPaths));
    // merge by agent: an inbox run replaces an existing run for the same agent,
    // and preserves other agents' (possibly hand-written, richer) runs.
    const byAgent = new Map(manualRuns.map((r) => [r.agent, r]));
    for (const r of inboxRuns) byAgent.set(r.agent, r);
    manualRuns = [...byAgent.values()];
    const parsed = manualRunsFileSchema.parse({ store: slug, runs: manualRuns });
    writeFileSync(yamlPath, yamlStringify(parsed));
    writeFileSync(path.join(storeDir, "manual-runs.json"), JSON.stringify(parsed, null, 2));
  }

  const readiness = JSON.parse(readFileSync(path.join(storeDir, "readiness.json"), "utf8"));
  const meta = JSON.parse(readFileSync(path.join(storeDir, "store.json"), "utf8"));
  const branding = {
    screenshot: dataUri(path.join(storeDir, "branding/screenshot.png")),
    logo: dataUri(path.join(storeDir, "branding/favicon.png")),
  };
  const cohort = benchmarkPath ? loadCohort(benchmarkPath) : null;
  const html = composeReport({ meta, branding, readiness, manualRuns, generatedAt: "2026-06-13T00:00:00Z" }, { cohort });
  await htmlToPdf(html, path.join(storeDir, "report.pdf"));
  console.log(`updated ${slug}: ${manualRuns.length} agent run(s), ${shotPaths.length} screenshot(s) -> report.pdf`);
}

async function main(): Promise<void> {
  mkdirSync(inboxDir, { recursive: true });
  const seen = new Map<string, string>();
  console.log(`watching ${inboxDir} -> ${cohortDir} (poll ${POLL_MS}ms). Drop <slug>/result.txt + screenshots.`);
  for (;;) {
    for (const slug of readdirSync(inboxDir)) {
      const sub = path.join(inboxDir, slug);
      try {
        if (!statSync(sub).isDirectory()) continue;
      } catch {
        continue;
      }
      const s = sig(sub);
      if (s && s !== seen.get(slug)) {
        seen.set(slug, s);
        await regen(slug).catch((e: unknown) => console.log(`ERR ${slug}: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
