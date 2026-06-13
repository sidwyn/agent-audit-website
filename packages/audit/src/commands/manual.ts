import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import { ZodError } from "zod";
import { parseReplies } from "../manual/prompts.js";
import { manualRunsFileSchema, type ManualRunsFile } from "../manual/schema.js";
import { dataDir } from "../paths.js";

export async function runManual(opts: {
  store: string;
  file: string;
}): Promise<{ outPath: string; parsed: ManualRunsFile }> {
  const raw = await readFile(opts.file, "utf8");
  let parsed: ManualRunsFile;
  try {
    parsed = manualRunsFileSchema.parse(parse(raw));
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`${opts.file} failed validation:\n${details}`);
    }
    throw err;
  }

  const dir = dataDir(opts.store);
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, "manual-runs.json");
  await writeFile(outPath, JSON.stringify(parsed, null, 2));
  await copyFile(opts.file, path.join(dir, "manual-runs.yaml"));
  return { outPath, parsed };
}

// Tier-2: turn pasted agent replies (with RESULT lines) into a validated
// manual-runs.yaml + .json for the store, ready for the report to consume.
export async function runManualFromReplies(opts: {
  store: string;
  file: string;
  task?: string;
  out?: string;
}): Promise<{ outPath: string; yamlPath: string; parsed: ManualRunsFile }> {
  const raw = await readFile(opts.file, "utf8");
  const runs = parseReplies(raw, { task: opts.task });
  if (runs.length === 0) {
    throw new Error(`no RESULT lines found in ${opts.file} — paste the agents' replies (each ending in a RESULT line)`);
  }
  const parsed = manualRunsFileSchema.parse({ store: opts.store, runs });
  const dir = opts.out ?? dataDir(opts.store);
  await mkdir(dir, { recursive: true });
  const yamlPath = path.join(dir, "manual-runs.yaml");
  const outPath = path.join(dir, "manual-runs.json");
  await writeFile(yamlPath, stringify(parsed));
  await writeFile(outPath, JSON.stringify(parsed, null, 2));
  return { outPath, yamlPath, parsed };
}

export function formatManualSummary(parsed: ManualRunsFile): string {
  return parsed.runs
    .map((r) =>
      r.outcome === "success"
        ? `${r.agent.padEnd(10)} success`
        : `${r.agent.padEnd(10)} abandoned at ${r.failure_stage}`,
    )
    .join("\n");
}
