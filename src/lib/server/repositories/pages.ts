/**
 * Comment anchors for static pages.
 *
 * `ensurePageAsset` is the only writer: the anchor appears the first time
 * somebody comments on a declared page, never on a read. Everything else in the
 * engine (lists, feeds, sitemap, search, tags) iterates declared content types,
 * so a page anchor is invisible to all of them.
 */

import type { D1Database } from '$lib/server/db';
import { first, run } from '$lib/server/db';
import { ensureOwner } from '$lib/server/repositories/people';
import { findCommentablePage, pageAssetId, pageSlug, pageTitle } from '$lib/content/pages';
import { site } from '$lib/site';

/** The type every page anchor carries. */
export const PAGE_KIND = 'page';

/**
 * Returns the page's anchor asset id, creating the row when it is missing.
 * Idempotent: the id is derived from the route and the locale, so two
 * simultaneous first comments converge on one anchor.
 */
export async function ensurePageAsset(
	db: D1Database,
	input: { path: string; lang?: string }
): Promise<string> {
	const page = findCommentablePage(input.path);
	if (!page) throw new Error(`"${input.path}" is not declared in commentablePages`);
	const lang = input.lang ?? site.defaultLocale;
	const id = pageAssetId(page.path, lang);

	const existing = await first<{ id: string }>(db, 'SELECT id FROM pages WHERE id = ?', [id]);
	if (existing) return id;

	const owner = await ensureOwner(db);
	const now = new Date().toISOString();
	const title = pageTitle(page.path, lang);

	await run(
		db,
		`INSERT INTO assets
			(id, type, lang, group_id, status, visibility, published_at, occurred_at,
			 author_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 'published', 'public', ?, NULL, ?, ?, ?)
		 ON CONFLICT(id) DO NOTHING`,
		[id, PAGE_KIND, lang, id, now, owner.id, now, now]
	);
	await run(
		db,
		`INSERT INTO pages (id, lang, slug, title, summary, body_md, body_html)
		 VALUES (?, ?, ?, ?, NULL, '', NULL)
		 ON CONFLICT(id) DO NOTHING`,
		[id, lang, pageSlug(page.path), title]
	);
	return id;
}

/** True when the asset exists — used by the comment API before it writes. */
export async function pageAssetExists(db: D1Database, id: string): Promise<boolean> {
	return Boolean(await first<{ id: string }>(db, 'SELECT id FROM pages WHERE id = ?', [id]));
}
