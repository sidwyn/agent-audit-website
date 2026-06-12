import { describe, expect, it } from "vitest";
import { escapeXml, hBarChart } from "../src/charts.js";

describe("hBarChart", () => {
  const bars = [
    { label: "human", value: 100, display: "100" },
    { label: "agent", value: 50, display: "50" },
  ];

  it("renders an svg with one filled bar per entry", () => {
    const svg = hBarChart(bars);
    expect(svg.startsWith("<svg")).toBe(true);
    const fills = svg.match(/<rect[^>]+fill="#312e81"/g) ?? [];
    expect(fills).toHaveLength(2);
  });

  it("scales bar widths proportionally to values", () => {
    const svg = hBarChart(bars);
    const widths = [...svg.matchAll(/<rect[^>]+width="(\d+)" height="20" rx="3" fill="#312e81"/g)].map(
      (m) => Number(m[1]),
    );
    expect(widths).toHaveLength(2);
    expect(widths[1]!).toBeCloseTo(widths[0]! / 2, -1);
  });

  it("escapes labels and guards zero-max", () => {
    const svg = hBarChart([{ label: "<script>", value: 0, display: "0 & none" }]);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("0 &amp; none");
    expect(svg).not.toContain("<script>");
    expect(escapeXml(`<a href="x">'`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;");
  });
});
