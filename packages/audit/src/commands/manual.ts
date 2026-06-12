import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { ZodError } from "zod";
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

export function formatManualSummary(parsed: ManualRunsFile): string {
  return parsed.runs
    .map((r) =>
      r.outcome === "success"
        ? `${r.agent.padEnd(10)} success`
        : `${r.agent.padEnd(10)} abandoned at ${r.failure_stage}`,
    )
    .join("\n");
}
