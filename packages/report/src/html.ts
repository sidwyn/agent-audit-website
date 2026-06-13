export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const pct = (n: number, digits = 1): string => `${(n * 100).toFixed(digits)}%`;

export const money = (n: number): string =>
  `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;

export function table(headers: string[], rows: string[][], className = ""): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("\n");
  return `<table class="${className}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Customer-facing relabel of raw audit problem strings. The HTTP fetch sees only
// server-rendered markup, so "no Product in ld+json" precisely means "not
// server-rendered" — accurate and still a real gap for non-JS agents.
export function relabelProblem(p: string): string {
  if (p.includes("no schema.org Product")) return "no server-rendered Product schema (JavaScript-only or absent)";
  return p;
}

// Sitemap-sourced URLs are occasionally malformed (relative, spaces); never let
// one crash a render.
export function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function section(id: string, title: string, body: string): string {
  return `<section id="${id}"><h2>${escapeHtml(title)}</h2>\n${body}\n</section>`;
}
