import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { manualRunsFileSchema } from "../../src/manual/schema.js";

const fixture = readFileSync(new URL("../fixtures/manual-runs.yaml", import.meta.url), "utf8");

describe("manualRunsFileSchema", () => {
  it("parses the fixture yaml", () => {
    const parsed = manualRunsFileSchema.parse(parse(fixture));
    expect(parsed.store).toBe("demo-store.example");
    expect(parsed.runs).toHaveLength(3);
    expect(parsed.runs[0]!.outcome).toBe("success");
    expect(parsed.runs[1]!.failure_stage).toBe("variant");
    expect(parsed.runs[2]!.screenshots).toHaveLength(2);
  });

  it("requires failure_stage when outcome is abandoned", () => {
    const bad = {
      store: "s",
      runs: [{ agent: "chatgpt", task: "t", steps: ["a"], outcome: "abandoned" }],
    };
    const result = manualRunsFileSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0]!;
      expect(issue.path).toEqual(["runs", 0, "failure_stage"]);
      expect(issue.message).toMatch(/failure_stage is required/);
    }
  });

  it("rejects unknown agents and stages with readable errors", () => {
    const bad = {
      store: "s",
      runs: [{ agent: "copilot", task: "t", steps: ["a"], outcome: "success" }],
    };
    const result = manualRunsFileSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
