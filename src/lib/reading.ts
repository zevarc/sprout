/**
 * Reading utilities for markdown content: strip frontmatter, estimate read
 * time, extract a plain-text excerpt, and slugify headings.
 *
 * `slugify` here is passed to markdown-it-anchor by `$lib/server/render.ts`;
 * heading extraction itself lives there too, so the table of contents and the
 * rendered anchors can never drift apart. This file stays dependency-free so
 * the client can import it.
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
 * Reimplemented here for historical reasons: it is what markdown-it-anchor
 * receives, so it must stay identical to the slug the renderer emits.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3400-\u9fff\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

