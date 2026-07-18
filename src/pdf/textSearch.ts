import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PATTERNS, CUSTOM_PATTERN_ID, customTermRegex } from "./patterns.ts";
import type { Rect, Suggestion } from "./types.ts";

interface PlacedItem {
  str: string;
  rect: Rect; // viewport scale-1, top-left origin
}

interface Line {
  text: string;
  // For each char of `text`, which PlacedItem it came from (index), or -1 for
  // synthetic joining spaces.
  charSource: number[];
  items: PlacedItem[];
  // Char offset within the source item for each char of `text` (for
  // proportional trimming of partial-item matches).
  charOffset: number[];
}

let nextId = 0;
const genId = () => `s${nextId++}`;

function placeItems(page: PDFPageProxy, items: TextItem[]): PlacedItem[] {
  const viewport = page.getViewport({ scale: 1 });
  const placed: PlacedItem[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const tx = it.transform;
    const x = tx[4];
    const y = tx[5];
    const h = Math.hypot(tx[2], tx[3]) || Math.abs(tx[3]) || 10;
    // PDF user space is bottom-left origin; convert the baseline box.
    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
      x,
      y - h * 0.2,
      x + it.width,
      y + h,
    ]);
    placed.push({
      str: it.str,
      rect: {
        x: Math.min(vx1, vx2),
        y: Math.min(vy1, vy2),
        w: Math.abs(vx2 - vx1),
        h: Math.abs(vy2 - vy1),
      },
    });
  }
  return placed;
}

// Group placed items into visual lines so matches can span multiple items
// (e.g. "555-" and "0123" as separate text runs).
function buildLines(placed: PlacedItem[]): Line[] {
  const sorted = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.rect.y - b.p.rect.y || a.p.rect.x - b.p.rect.x);

  const lines: Line[] = [];
  let current: { entries: { p: PlacedItem }[]; yMid: number } | null = null;
  const flush = () => {
    if (!current) return;
    const entries = current.entries.sort((a, b) => a.p.rect.x - b.p.rect.x);
    const line: Line = { text: "", charSource: [], charOffset: [], items: [] };
    let prevRight: number | null = null;
    for (const { p } of entries) {
      const itemIdx = line.items.length;
      line.items.push(p);
      // Insert a synthetic space when there's a visible gap between runs.
      if (prevRight !== null && p.rect.x - prevRight > 1.5) {
        line.text += " ";
        line.charSource.push(-1);
        line.charOffset.push(0);
      }
      for (let c = 0; c < p.str.length; c++) {
        line.text += p.str[c];
        line.charSource.push(itemIdx);
        line.charOffset.push(c);
      }
      prevRight = p.rect.x + p.rect.w;
    }
    lines.push(line);
    current = null;
  };

  for (const { p } of sorted) {
    const yMid = p.rect.y + p.rect.h / 2;
    if (current && Math.abs(yMid - current.yMid) <= Math.max(3, p.rect.h * 0.5)) {
      current.entries.push({ p });
    } else {
      flush();
      current = { entries: [{ p }], yMid };
    }
  }
  flush();
  return lines;
}

// Approximate per-character advance widths (em units, Helvetica-ish) so that
// partial-item boxes land on the right characters even when the surrounding
// text mixes narrow ("il: ") and wide ("W41") glyphs. Uniform char-count
// slicing was observed to leave leading characters of a match exposed.
function charWidth(c: string): number {
  if (/[iljtf!.,:;'|]/.test(c)) return 0.28;
  if (c === " ") return 0.278;
  if (/[mwMW@]/.test(c)) return 0.85;
  if (/[A-Z]/.test(c)) return 0.7;
  if (/[0-9]/.test(c)) return 0.556;
  if (/[()\-[\]"]/.test(c)) return 0.33;
  return 0.5;
}

function sliceX(item: PlacedItem, c0: number, c1: number): { x: number; w: number } {
  let before = 0;
  let inside = 0;
  let total = 0;
  for (let i = 0; i < item.str.length; i++) {
    const w = charWidth(item.str[i]);
    total += w;
    if (i < c0) before += w;
    else if (i < c1) inside += w;
  }
  if (total === 0) return { x: item.rect.x, w: item.rect.w };
  const scale = item.rect.w / total;
  // Half-a-character safety margin on both sides: over-redacting a sliver of
  // a neighboring glyph is fine; exposing a sliver of the match is not.
  const margin = 0.5 * (total / (item.str.length || 1)) * scale;
  return {
    x: item.rect.x + before * scale - margin,
    w: inside * scale + margin * 2,
  };
}

// Convert a [start, end) char range of a line into one rect per touched item,
// trimming the first/last item by estimated character position.
function rangeToRects(line: Line, start: number, end: number): Rect[] {
  const rects: Rect[] = [];
  let i = start;
  while (i < end) {
    const src = line.charSource[i];
    if (src === -1) {
      i++;
      continue;
    }
    let j = i;
    while (j < end && line.charSource[j] === src) j++;
    const item = line.items[src];
    const c0 = line.charOffset[i];
    const c1 = line.charOffset[j - 1] + 1;
    const { x, w } = sliceX(item, c0, c1);
    rects.push({ x, y: item.rect.y, w, h: item.rect.h });
    i = j;
  }
  return rects;
}

function mergeRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const PAD = 1.5;
  return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 };
}

export async function findSuggestions(
  page: PDFPageProxy,
  pageIndex: number,
  customTerms: string[] = [],
): Promise<Suggestion[]> {
  const content = await page.getTextContent();
  const items = content.items.filter((i): i is TextItem => "str" in i);
  const lines = buildLines(placeItems(page, items));

  const searches = [
    ...PATTERNS.map((p) => ({ id: p.id, regex: p.regex })),
    ...customTerms
      .filter((t) => t.trim().length >= 2)
      .map((t) => ({ id: CUSTOM_PATTERN_ID, regex: customTermRegex(t) })),
  ];

  const out: Suggestion[] = [];
  for (const line of lines) {
    // Chars already claimed by an earlier (more specific) pattern.
    const claimed = new Array<boolean>(line.text.length).fill(false);
    for (const { id, regex } of searches) {
      regex.lastIndex = 0;
      for (const m of line.text.matchAll(regex)) {
        const start = m.index;
        const end = start + m[0].length;
        if (m[0].length === 0) continue;
        let overlap = false;
        for (let c = start; c < end; c++) if (claimed[c]) overlap = true;
        if (overlap) continue;
        const rect = mergeRects(rangeToRects(line, start, end));
        if (!rect) continue;
        for (let c = start; c < end; c++) claimed[c] = true;
        out.push({
          id: genId(),
          pageIndex,
          rect,
          categoryId: id,
          text: m[0],
          accepted: false,
        });
      }
    }
  }
  return out;
}
