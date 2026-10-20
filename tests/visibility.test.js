import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createNode, listNodes, searchNodes } from '$lib/server/repositories/nodes';
import { listViews } from '$lib/content/view';
import { loadNodeView } from '$lib/server/loadNode';
import { toMatchExpression } from '$lib/server/search';

describe('node visibility', () => {
	it('defaults to public and can be private', async () => {
		const { db } = createTestDb();
		const pub = await createNode(db, { type: 'post', slug: 'pub', lang: 'en', bodyMd: 'a', status: 'published' });
		const priv = await createNode(db, {
			type: 'post',
			slug: 'priv',
			lang: 'en',
			bodyMd: 'b',
			status: 'published',
			visibility: 'private'
		});
		expect(pub.visibility).toBe('public');
		expect(priv.visibility).toBe('private');
	});

	it('public list views exclude private nodes by default', async () => {
		const { db } = createTestDb();
		await createNode(db, { type: 'post', slug: 'pub', lang: 'en', bodyMd: 'a', status: 'published' });
		await createNode(db, {
			type: 'post',
			slug: 'priv',
			lang: 'en',
			bodyMd: 'b',
			status: 'published',
			visibility: 'private'
		});
		const views = await listViews(db, { types: ['post'], lang: 'en' });
		expect(views.map((v) => v.slug)).toEqual(['pub']);
	});

	it('owner listings can include both visibilities', async () => {
		const { db } = createTestDb();
		await createNode(db, { type: 'post', slug: 'pub', lang: 'en', bodyMd: 'a', status: 'published' });
		await createNode(db, {
			type: 'post',
			slug: 'priv',
			lang: 'en',
			bodyMd: 'b',
			status: 'published',
			visibility: 'private'
		});
		const all = await listNodes(db, { types: ['post'], lang: 'en', status: 'all' });
		expect(all.length).toBe(2);
	});

	it('search honours the visibility filter', async () => {
		const { db } = createTestDb();
		await createNode(db, {
			type: 'post',
			slug: 'pub',
			lang: 'en',
			title: 'alpha',
			bodyMd: 'alpha body',
			status: 'published'
		});
		await createNode(db, {
			type: 'post',
			slug: 'priv',
			lang: 'en',
			title: 'alpha secret',
			bodyMd: 'alpha secret',
			status: 'published',
			visibility: 'private'
		});
		const expr = toMatchExpression('alpha');
		const publicHits = await searchNodes(db, expr, { lang: 'en', visibility: 'public' });
		expect(publicHits.map((n) => n.slug)).toEqual(['pub']);
		const allHits = await searchNodes(db, expr, { lang: 'en' });
		expect(allHits.map((n) => n.slug).sort()).toEqual(['priv', 'pub']);
	});

	it('404s a private detail page unless the caller opts in', async () => {
		const { db } = createTestDb();
		await createNode(db, {
			type: 'post',
			slug: 'p',
			lang: 'en',
			bodyMd: 'x',
			status: 'published',
			visibility: 'private'
		});
		const platform = /** @type {any} */ ({ env: { DB: db } });

		await expect(loadNodeView(platform, 'post', 'p', 'en')).rejects.toThrow();
		const ok = await loadNodeView(platform, 'post', 'p', 'en', { allowPrivate: true });
		expect(ok.post.slug).toBe('p');
	});
});
