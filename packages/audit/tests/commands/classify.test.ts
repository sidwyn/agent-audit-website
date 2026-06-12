import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatClassifySummary, runClassify } from "../../src/commands/classify.js";
import type { ClassifyOutput } from "../../src/classify/types.js";

const fixtures = path.dirname(fileURLToPath(new URL("../fixtures/orders.csv", import.meta.url)));

describe("runClassify (csv mode)", () => {
  it("classifies the sample csv and writes classify.json", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentaudit-"));
    const outPath = path.join(dir, "classify.json");

    const { output, disputesAvailable } = await runClassify({
      orders: path.join(fixtures, "orders.csv"),
      disputes: path.join(fixtures, "disputes.csv"),
      store: "demo-store.example",
      out: outPath,
      now: new Date("2026-06-12T00:00:00Z"),
    });

    const onDisk = JSON.parse(await readFile(outPath, "utf8")) as ClassifyOutput;
    expect(onDisk.store).toBe("demo-store.example");
    expect(onDisk.totals.orders).toBe(40);
    expect(onDisk.byClass.human.orders).toBeGreaterThan(20);
    expect(onDisk.byClass.high_confidence_agent.orders).toBeGreaterThanOrEqual(5);
    expect(onDisk.byClass.heuristic_agent.orders).toBeGreaterThanOrEqual(2);
    expect(onDisk.byClass.confirmed_channel.orders).toBeGreaterThanOrEqual(2);
    expect(onDisk.totals.disputes).toBe(3);
    expect(disputesAvailable).toBe(true);

    const summary = formatClassifySummary(output, disputesAvailable);
    expect(summary).toContain("vamp:");
    expect(summary).toContain("demo-store.example");
  });

  it("errors without store label or input source", async () => {
    await expect(runClassify({})).rejects.toThrow(/--store/);
    await expect(runClassify({ store: "x" })).rejects.toThrow(/--shop\/--token or --orders/);
  });

  it("errors clearly when the token env var is missing", async () => {
    await expect(
      runClassify({ shop: "s.myshopify.com", token: "AGENTAUDIT_TEST_TOKEN_UNSET" }),
    ).rejects.toThrow(/AGENTAUDIT_TEST_TOKEN_UNSET is not set/);
  });
});
