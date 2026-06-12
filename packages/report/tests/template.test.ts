import { describe, expect, it } from "vitest";
import { composeReport } from "../src/template.js";
import { makeReportData } from "./helpers.js";

describe("composeReport", () => {
  const html = composeReport(makeReportData());

  it("renders the scorecard with store name and score out of 100", () => {
    expect(html).toContain("Meridian Supply Co.");
    expect(html).toMatch(/<span class="score-num">\d+<\/span><span class="score-denom">\/ 100/);
  });

  it("contains every spec section", () => {
    for (const heading of [
      "Executive summary",
      "Discovery layer",
      "Transaction layer",
      "Order classification",
      "Dispute exposure",
      "Fix list",
      "Methodology",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("shows the vamp math and inline svg charts", () => {
    expect(html).toContain("3 disputes ÷ 412 orders = <strong>0.73%</strong>");
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("renders one transaction row per manual run plus the probe", () => {
    expect(html).toContain("Automated probe");
    expect(html).toContain("ChatGPT");
    expect(html).toContain("abandoned at variant");
    expect(html).toContain("abandoned at checkout");
  });

  it("never leaks undefined or NaN into the document", () => {
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
