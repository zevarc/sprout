import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { pageAssetId, pageSlug, isCommentablePage, pageTitle } from '$lib/content/pages';
import { ensurePageAsset } from '$lib/server/repositories/pages';
import { addComment, setCommentStatus, listComments } from '$lib/server/repositories/comments';
import { ensureOwner } from '$lib/server/repositories/people';
import { buildExport } from '$lib/server/export';
import { restoreFromBundle } from '$lib/server/restore';

describe('comment anchors for static pages', () => {
	it('derives a stable, per-locale id from the route', () => {
		expect(pageSlug('/about')).toBe('about');
		expect(pageSlug('/lab/notes/')).toBe('lab-notes');
		expect(pageSlug('/')).toBe('home');
		expect(pageAssetId('/about', 'zh')).toBe('page:about:zh');
		expect(pageAssetId('/about', 'en')).toBe('page:about:en');
	});

	it('knows which pages take comments, and their titles', () => {
		expect(isCommentablePage('/about')).toBe(true);
		expect(isCommentablePage('/about/')).toBe(true);
		expect(isCommentablePage('/search')).toBe(false);
		expect(pageTitle('/about', 'zh')).toBe('关于');
		expect(pageTitle('/about', 'fr')).toBe('About'); // dictionary-less → default locale
	});

	it('creates the anchor once, with the owner as author', async () => {
		const { db, sqlite } = createTestDb();
		const owner = await ensureOwner(db);

		const zh = await ensurePageAsset(db, { path: '/about', lang: 'zh' });
		expect(zh).toBe('page:about:zh');
		// Second call, same page and locale: no second row.
		expect(await ensurePageAsset(db, { path: '/about', lang: 'zh' })).toBe(zh);

		const en = await ensurePageAsset(db, { path: '/about', lang: 'en' });
		expect(en).toBe('page:about:en');

		const rows = /** @type {any[]} */ (sqlite.prepare('SELECT * FROM pages ORDER BY id').all());
		expect(rows.map((r) => [r.id, r.lang, r.slug, r.title])).toEqual([
			['page:about:en', 'en', 'about', 'About'],
			['page:about:zh', 'zh', 'about', '关于']
		]);

		const asset = /** @type {any} */ (
			sqlite.prepare('SELECT type, status, visibility, author_id FROM assets WHERE id = ?').get(zh)
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
		await expect(ensurePageAsset(db, { path: '/search', lang: 'en' })).rejects.toThrow(
			/commentablePages/
		);
	});

	it('holds comments like any other asset', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const page = await ensurePageAsset(db, { path: '/about', lang: 'zh' });

		const comment = await addComment(db, {
			assetId: page,
			authorId: owner.id,
			bodyMd: '第一条留言'
		});
		await setCommentStatus(db, comment.id, 'approved', owner.id);

		const approved = await listComments(db, { assetId: page, status: 'approved' });
		expect(approved.map((c) => c.bodyMd)).toEqual(['第一条留言']);
	});

	it('round-trips through export → restore like any other kind', async () => {
		const source = createTestDb();
		const owner = await ensureOwner(source.db);
		const page = await ensurePageAsset(source.db, { path: '/about', lang: 'zh' });
		const comment = await addComment(source.db, {
			assetId: page,
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
			['page:about:zh', 'zh', 'about', '关于']
		]);
		const comments = /** @type {any[]} */ (
			target.sqlite.prepare('SELECT asset_id, body_md, status FROM comments').all()
		);
		expect(comments).toEqual([{ asset_id: page, body_md: 'hello', status: 'approved' }]);
	});
});
