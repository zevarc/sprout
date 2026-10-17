/**
 * Reading utilities for markdown content: strip frontmatter, estimate read
 * time, extract a plain-text excerpt, and build the table of contents.
 *
 * `slugify` here must stay in sync with the heading anchors produced by
 * `$lib/server/render.ts` (markdown-it-anchor), or TOC links break.
 */

const CJK_RANGE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WORD_RANGE = /[a-zA-Z0-9]+(?:['\u2019-][a-zA-Z0-9]+)*/g;

/** Strips the leading YAML frontmatter block from raw markdown. */
export function stripFrontmatter(text: string): string {
  return text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
}

/**
 * Estimates reading time in minutes.
 * CJK characters ~400 chars/min, latin words ~220 words/min (bilingual aware).
 */
export function calcReadTime(text: string): number {
  const body = stripFrontmatter(text);
  const noCode = body.replace(/```[\s\S]*?```/g, ' ');
  const cjk = (noCode.match(CJK_RANGE) || []).length;
  const words = (noCode.replace(CJK_RANGE, ' ').match(WORD_RANGE) || []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

/**
 * Extracts a short plain-text excerpt from raw markdown.
 * Falls back to the provided description when the body yields nothing.
 */
export function extractExcerpt(text: string, fallback = ''): string {
  const body = stripFrontmatter(text);
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, ' ')
    .replace(/[*_~`>#|-]/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return fallback;
  if (plain.length <= 160) return plain;

  const cut = plain.slice(0, 160);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * MUST stay in sync with the anchor slugify in `$lib/server/render.ts`,
 * otherwise TOC anchor ids won't match rendered heading ids.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3400-\u9fff\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Extracts a table of contents (h2-h4) from raw markdown.
 * Duplicate headings get `-1`, `-2` suffixes, matching rehypeSlug.
 */
export function extractHeadings(text: string): TocItem[] {
  const body = stripFrontmatter(text);
  const seen = new Map<string, number>();
  const toc: TocItem[] = [];

  for (const line of body.split('\n')) {
    const match = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const level = match[1].length;
    const rawText = match[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim();
    if (!rawText) continue;

    let id = slugify(rawText) || 'section';
    const count = seen.get(id) || 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;

    toc.push({ id, text: rawText, level });
  }

  return toc;
}
