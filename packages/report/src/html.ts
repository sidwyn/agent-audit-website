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

export function section(id: string, title: string, body: string): string {
  return `<section id="${id}"><h2>${escapeHtml(title)}</h2>\n${body}\n</section>`;
}
