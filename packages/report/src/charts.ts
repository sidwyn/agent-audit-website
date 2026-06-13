export type Bar = { label: string; value: number; display: string };

export function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const LABEL_W = 190;
const VALUE_W = 78;
const BAR_H = 20;
const GAP = 10;

export function hBarChart(
  bars: Bar[],
  opts: { width?: number; accent?: string } = {},
): string {
  const width = opts.width ?? 640;
  const accent = opts.accent ?? "#312e81";
  const barArea = width - LABEL_W - VALUE_W - 16;
  const max = Math.max(...bars.map((b) => b.value), 0);
  const height = bars.length * (BAR_H + GAP) + GAP;

  const rows = bars
    .map((b, i) => {
      const y = GAP + i * (BAR_H + GAP);
      const w = max <= 0 ? 0 : Math.max(Math.round((b.value / max) * barArea), b.value > 0 ? 2 : 0);
      return [
        `<text x="0" y="${y + BAR_H - 6}" font-size="12" fill="#3f3f46">${escapeXml(b.label)}</text>`,
        `<rect x="${LABEL_W}" y="${y}" width="${w}" height="${BAR_H}" rx="3" fill="${accent}" />`,
        `<rect x="${LABEL_W}" y="${y}" width="${barArea}" height="${BAR_H}" rx="3" fill="none" stroke="#e4e4e7" />`,
        `<text x="${width}" y="${y + BAR_H - 6}" font-size="12" text-anchor="end" fill="#18181b" style="font-variant-numeric: tabular-nums">${escapeXml(b.display)}</text>`,
      ].join("");
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" font-family="inherit">\n${rows}\n</svg>`;
}

export type SparkPoint = { label: string; value: number };

// Small trend line for the agent-share trajectory. Plots points 0..1 (shares)
// with first/last markers; pure string builder, no charting dependency.
export function sparkline(
  points: SparkPoint[],
  opts: { width?: number; height?: number; accent?: string } = {},
): string {
  const width = opts.width ?? 360;
  const height = opts.height ?? 64;
  const accent = opts.accent ?? "#4f46e5";
  const pad = 8;
  if (points.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><text x="${pad}" y="${height / 2}" font-size="11" fill="#71717a">not enough data points</text></svg>`;
  }
  const max = Math.max(...points.map((p) => p.value), 0.0001);
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (p.value / max) * (height - pad * 2);
    return { x, y, p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const dots = [coords[0]!, coords[coords.length - 1]!]
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="${accent}" />`)
    .join("");
  const labels = `<text x="${pad}" y="${height - 1}" font-size="9" fill="#71717a">${escapeXml(points[0]!.label)}</text>` +
    `<text x="${width - pad}" y="${height - 1}" font-size="9" text-anchor="end" fill="#71717a">${escapeXml(points[points.length - 1]!.label)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" font-family="inherit"><path d="${path}" fill="none" stroke="${accent}" stroke-width="2" />${dots}${labels}</svg>`;
}
