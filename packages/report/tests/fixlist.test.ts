import { describe, expect, it } from "vitest";
import { buildFixList } from "../src/fixlist.js";
import { makeReadiness, makeReportData } from "./helpers.js";

describe("buildFixList", () => {
  it("ranks high-impact low-effort items first and covers each failed check once", () => {
    const base = makeReadiness();
    const data = makeReportData({
      readiness: makeReadiness({
        robots: base.robots.map((r, i) => ({ ...r, allowed: i > 0 })),
        feeds: { ...base.feeds, llmsTxt: { pass: false, status: 404, notes: "" } },
      }),
    });
    const items = buildFixList(data);
    const ids = items.map((i) => i.id);

    expect(ids).toContain("robots");
    expect(ids).toContain("llms-txt");
    expect(ids).toContain("variant"); // perplexity manual run abandoned at variant
    expect(ids.indexOf("robots")).toBeLessThan(ids.indexOf("llms-txt"));
    expect(new Set(ids).size).toBe(ids.length);
    expect(items[0]!.rank).toBe(1);
    expect(items.every((i) => i.impact >= 1 && i.impact <= 5 && i.effort >= 1 && i.effort <= 5)).toBe(true);
  });

  it("returns an empty list when everything passes", () => {
    const data = makeReportData({
      manualRuns: makeReportData().manualRuns.map((r) => ({
        ...r,
        outcome: "success" as const,
        failure_stage: undefined,
      })),
    });
    expect(buildFixList(data)).toEqual([]);
  });
});
