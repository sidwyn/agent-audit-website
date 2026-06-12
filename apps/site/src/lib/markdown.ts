// Minimal markdown model for the constrained constructs the marketing copy
// uses: paragraphs, bold, ordered/unordered lists, and the **[CTA]** line.
// No dependency, fully unit-tested; copy renders verbatim.

export type Block =
  | { type: "p"; text: string }
  | { type: "cta"; label: string }
  | { type: "ol"; items: string[] }
  | { type: "ul"; items: string[] };

export type InlineSegment = { bold: boolean; text: string };

const CTA_RE = /^\*\*\[(.+)\]\*\*$/;

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ol" | "ul"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const cta = CTA_RE.exec(line);
    if (cta?.[1]) {
      flushParagraph();
      flushList();
      blocks.push({ type: "cta", label: cta[1] });
      continue;
    }
    const ul = line.match(/^-\s+(.*)$/);
    if (ul?.[1]) {
      flushParagraph();
      if (list?.type !== "ul") flushList();
      list = list ?? { type: "ul", items: [] };
      list.items.push(ul[1]);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol?.[1]) {
      flushParagraph();
      if (list?.type !== "ol") flushList();
      list = list ?? { type: "ol", items: [] };
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) segments.push({ bold: false, text: text.slice(last, m.index) });
    segments.push({ bold: true, text: m[1]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) segments.push({ bold: false, text: text.slice(last) });
  return segments;
}

export function stripBold(text: string): string {
  return parseInline(text)
    .map((s) => s.text)
    .join("");
}

export type FaqEntry = { q: string; a: string };

export function parseFaq(md: string): FaqEntry[] {
  return md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .flatMap((p) => {
      const m = p.match(/^\*\*(.+?)\*\*\s*([\s\S]+)$/);
      return m?.[1] && m[2] ? [{ q: m[1], a: m[2].replace(/\s+/g, " ").trim() }] : [];
    });
}
