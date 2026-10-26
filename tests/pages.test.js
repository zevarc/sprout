import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { pageAssetId, pageSlug, isCommentablePage, pageTitle } from '$lib/content/pages';
import { commentablePages } from '$lib/engine/registry';
import { ensurePageAsset } from '$lib/server/repositories/pages';
import { addComment, setCommentStatus, listComments } from '$lib/server/repositories/comments';
import { ensureOwner } from '$lib/server/repositories/people';
import { buildExport } from '$lib/server/export';
import { restoreFromBundle } from '$lib/server/restore';
import { site } from '$lib/site';

/** The site's own declaration — these tests must pass in any site. */
const declared = commentablePages ?? [];
const page = declared[0];
const defaultLang = site.defaultLocale;
/** A second language: the page's own if it declares a non-default one, else any. */
const otherLang =
	Object.keys(page?.title ?? {}).find((l) => l !== defaultLang) ??
	(defaultLang === 'en' ? 'zh' : 'en');
const langs = [defaultLang, otherLang];
/** A route no site declares. */
const undeclared =
	['/search', '/nowhere', '/not-a-declared-page'].find((p) => !isCommentablePage(p)) ??
	'/not-a-declared-page';

describe('comment anchors for static pages', () => {
	it('derives a stable, per-locale id from the route', () => {
		expect(pageSlug('/about')).toBe('about');
		expect(pageSlug('/lab/notes/')).toBe('lab-notes');
		expect(pageSlug('/')).toBe('home');
		expect(pageAssetId('/about', 'zh')).toBe('page:about:zh');
		expect(pageAssetId('/about', 'en')).toBe('page:about:en');
	});

	it.skipIf(!page)('knows which pages take comments, and their titles', () => {
		expect(isCommentablePage(page.path)).toBe(true);
		expect(isCommentablePage(`${page.path}/`)).toBe(true);
		expect(isCommentablePage(undeclared)).toBe(false);
		for (const [lang, title] of Object.entries(page.title ?? {})) {
			expect(pageTitle(page.path, lang)).toBe(title);
		}
		// A locale the declaration does not cover falls back to `en`, then the slug.
		expect(pageTitle(page.path, 'not-a-declared-locale')).toBe(
			page.title?.en ?? pageSlug(page.path)
		);
	});

	it.skipIf(!page)('creates the anchor once, with the owner as author', async () => {
		const { db, sqlite } = createTestDb();
		const owner = await ensureOwner(db);
		const [first, second] = langs;

		const anchor = await ensurePageAsset(db, { path: page.path, lang: first });
		expect(anchor).toBe(pageAssetId(page.path, first));
		// Second call, same page and locale: no second row.
		expect(await ensurePageAsset(db, { path: page.path, lang: first })).toBe(anchor);

		const other = await ensurePageAsset(db, { path: page.path, lang: second });
		expect(other).toBe(pageAssetId(page.path, second));

		const rows = /** @type {any[]} */ (sqlite.prepare('SELECT * FROM pages ORDER BY id').all());
		const expected = langs
			.map((lang) => [
				pageAssetId(page.path, lang),
				lang,
				pageSlug(page.path),
				pageTitle(page.path, lang)
			])
			.sort();
		expect(rows.map((r) => [r.id, r.lang, r.slug, r.title])).toEqual(expected);

		const asset = /** @type {any} */ (
			sqlite
				.prepare('SELECT type, status, visibility, author_id FROM assets WHERE id = ?')
				.get(anchor)
		);
		expect(asset).toEqual({
			type: 'page',
			status: 'published',
			visibility: 'public',
			author_id: owner.id
		});
	});

	it('refuses a page the site never declared', async () => {
		const { db } = createTestDb();
		await expect(ensurePageAsset(db, { path: undeclared, lang: defaultLang })).rejects.toThrow(
			/commentablePages/
		);
	});

	it.skipIf(!page)('holds comments like any other asset', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const anchor = await ensurePageAsset(db, { path: page.path, lang: defaultLang });

		const comment = await addComment(db, {
			assetId: anchor,
			authorId: owner.id,
			bodyMd: '第一条留言'
		});
		await setCommentStatus(db, comment.id, 'approved', owner.id);

		const approved = await listComments(db, { assetId: anchor, status: 'approved' });
		expect(approved.map((c) => c.bodyMd)).toEqual(['第一条留言']);
	});

	it.skipIf(!page)('round-trips through export → restore like any other kind', async () => {
		const source = createTestDb();
		const owner = await ensureOwner(source.db);
		const anchor = await ensurePageAsset(source.db, { path: page.path, lang: defaultLang });
		const comment = await addComment(source.db, {
			assetId: anchor,
			authorId: owner.id,
			bodyMd: 'hello'
		});
		await setCommentStatus(source.db, comment.id, 'approved', owner.id);

		const bundle = await buildExport(source.db);
		expect(bundle.types).toContain('page');
		expect(bundle.files.map((f) => f.path)).toContain('pages.jsonl');

		const target = createTestDb();
		await restoreFromBundle(target.db, bundle.files);

		const pages = /** @type {any[]} */ (target.sqlite.prepare('SELECT * FROM pages').all());
		expect(pages.map((r) => [r.id, r.lang, r.slug, r.title])).toEqual([
			[
				pageAssetId(page.path, defaultLang),
				defaultLang,
				pageSlug(page.path),
				pageTitle(page.path, defaultLang)
			]
		]);
		const comments = /** @type {any[]} */ (
			target.sqlite.prepare('SELECT asset_id, body_md, status FROM comments').all()
		);
		expect(comments).toEqual([{ asset_id: anchor, body_md: 'hello', status: 'approved' }]);
	});
});
