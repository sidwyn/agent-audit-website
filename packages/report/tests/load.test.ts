import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadReportData } from "../src/load.js";
import { composeReport } from "../src/template.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/demo-store");

describe("loadReportData", () => {
  it("loads and validates the bundled demo fixtures end to end", async () => {
    const data = await loadReportData({
      dataDir: FIXTURES,
      metaPath: path.join(FIXTURES, "store.json"),
      generatedAt: "2026-06-12T00:00:00Z",
    });
    expect(data.meta.name).toBe("Meridian Supply Co.");
    expect(data.readiness.robots).toHaveLength(13);
    expect(data.classify.totals.orders).toBe(40);
    expect(data.manualRuns).toHaveLength(3);

    const html = composeReport(data);
    expect(html).toContain("Meridian Supply Co.");
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it("names the offending file on validation errors", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-load-"));
    await writeFile(path.join(dir, "readiness.json"), JSON.stringify({ store: 1 }));
    await expect(
      loadReportData({ dataDir: dir, metaPath: path.join(FIXTURES, "store.json") }),
    ).rejects.toThrow(/readiness\.json failed validation/);
  });

  it("names missing files clearly", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-load-"));
    await expect(
      loadReportData({ dataDir: dir, metaPath: path.join(FIXTURES, "store.json") }),
    ).rejects.toThrow(/missing input file/);
  });
});
