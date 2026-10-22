import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createAsset, listAssets, searchAssets } from '$lib/server/repositories/assets';
import { ensureOwner } from '$lib/server/repositories/people';
import { listTags } from '$lib/server/repositories/tags';
import { listViews } from '$lib/content/view';
import { loadNodeView } from '$lib/server/loadNode';
import { toMatchExpression } from '$lib/server/search';

describe('visibility', () => {
	it('public listings default to public assets only', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'slug'>} */
		const base = { type: 'post', lang: 'en', title: 't', bodyMd: 'x', status: 'published', authorId: owner.id };

		await createAsset(db, { ...base, slug: 'pub' });
		await createAsset(db, { ...base, slug: 'priv', visibility: 'private' });

		const views = await listViews(db, { types: ['post'], lang: 'en' });
		expect(views.map((v) => v.slug)).toEqual(['pub']);

		const both = await listViews(db, { types: ['post'], lang: 'en', visibility: 'private' });
		expect(both.map((v) => v.slug)).toEqual(['priv']);
	});

	it('tag counts ignore private assets', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'slug'>} */
		const base = { type: 'post', lang: 'en', title: 't', bodyMd: 'x', status: 'published', authorId: owner.id };

		await createAsset(db, { ...base, slug: 'a', tags: ['visible'] });
		await createAsset(db, { ...base, slug: 'b', visibility: 'private', tags: ['secret'] });

		expect((await listTags(db, { lang: 'en', types: ['post'] })).map((t) => t.tag)).toEqual(['visible']);
		expect(
			(await listTags(db, { lang: 'en', types: ['post'], visibility: 'private' })).map((t) => t.tag)
		).toEqual(['secret']);
	});

	it('search only returns public assets for anonymous readers', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'slug'>} */
		const base = { type: 'post', lang: 'en', title: 'Svelte', bodyMd: 'svelte kit', status: 'published', authorId: owner.id };

		await createAsset(db, { ...base, slug: 'pub' });
		await createAsset(db, { ...base, slug: 'priv', visibility: 'private' });

		const expression = toMatchExpression('svelte');
		const pub = await searchAssets(db, 'post', expression, { lang: 'en', visibility: 'public' });
		expect(pub.map((n) => n.slug)).toEqual(['pub']);

		const all = await searchAssets(db, 'post', expression, { lang: 'en' });
		expect(all.map((n) => n.slug).sort()).toEqual(['priv', 'pub']);
	});

	it('404s a private detail page unless the caller opts in', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		await createAsset(db, {
			type: 'post',
			slug: 'guard',
			lang: 'en',
			title: 'G',
			bodyMd: 'x',
			status: 'published',
			visibility: 'private',
			authorId: owner.id
		});

		// loadNodeView needs a platform; give it the test database binding.
		const platform = /** @type {App.Platform} */ ({ env: { DB: db } });
		await expect(loadNodeView(platform, 'post', 'guard', 'en')).rejects.toThrow();
		const view = await loadNodeView(platform, 'post', 'guard', 'en', { allowPrivate: true });
		expect(view.post.slug).toBe('guard');
	});

	it('lists assets across kinds when asked', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'type' | 'slug'>} */
		const base = { lang: 'en', bodyMd: 'x', status: 'published', authorId: owner.id };
		await createAsset(db, { ...base, type: 'post', slug: 'p', title: 'P' });
		await createAsset(db, { ...base, type: 'moment', slug: 'm' });

		const all = await listAssets(db, { types: ['post', 'moment'], lang: 'en' });
		expect(all).toHaveLength(2);
	});
});
