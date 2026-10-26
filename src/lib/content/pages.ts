/**
 * Commentable static pages.
 *
 * A site declares which of its hand-written pages accept comments (see
 * `commentablePages` in `sprout.config.js`). The page's copy stays in the
 * dictionaries where it belongs; the only thing the database holds is an anchor
 * asset, so the comment tables keep referencing `assets.id` like everything else
 * conversational does.
 *
 * The helpers here are pure and isomorphic: the comment component derives the
 * target it posts to, and the API derives the same id from the request.
 */

import { commentablePages } from '$lib/engine/registry';

export interface CommentablePage {
	/** Route of the page, e.g. `/about`. */
	path: string;
	/** Anchor title, per locale (falls back to the slug). */
	title?: Record<string, string | undefined>;
}

/** `/about/` → `about`; `/lab/notes` → `lab-notes`. */
export function pageSlug(path: string): string {
	const cleaned = path.replace(/^\/+|\/+$/g, '');
	return cleaned ? cleaned.replace(/\//g, '-') : 'home';
}

/** The anchor's asset id. Deterministic, so it survives export and restore. */
export function pageAssetId(path: string, lang: string): string {
	return `page:${pageSlug(path)}:${lang}`;
}

/** The declaration for a route, or null when the page takes no comments. */
export function findCommentablePage(path: string): CommentablePage | null {
	const wanted = path.replace(/\/+$/, '') || '/';
	const found = (commentablePages ?? []).find(
		(p) => (p.path.replace(/\/+$/, '') || '/') === wanted
	);
	return found ?? null;
}

/** True when the page takes comments. */
export function isCommentablePage(path: string): boolean {
	return findCommentablePage(path) !== null;
}

/** The anchor's display title for one locale. */
export function pageTitle(path: string, lang: string): string {
	const page = findCommentablePage(path);
	return page?.title?.[lang] ?? page?.title?.['en'] ?? pageSlug(path);
}
