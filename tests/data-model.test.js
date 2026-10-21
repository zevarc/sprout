import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import {
	createNode,
	updateNode,
	getNodeBySlug,
	listFeatured,
	listGroupNodes,
	uniqueSlug,
	relatedIds
} from '$lib/server/repositories/nodes';
import { translationLinks } from '$lib/content/view';
import { site } from '$lib/site';
import { renderComment } from '$lib/server/render';

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('data model invariants', () => {
	it('node id is an opaque ULID, independent of slug and lang', async () => {
		const { db } = createTestDb();
		const node = await createNode(db, {
			type: 'post',
			slug: 'a',
			lang: 'en',
			bodyMd: 'x',
			status: 'published'
		});
		expect(node.id).toMatch(ULID);
		expect(node.id).not.toContain('post');

		const renamed = await updateNode(db, node.id, { slug: 'b' });
		expect(renamed?.id).toBe(node.id);
		expect((await getNodeBySlug(db, 'post', 'b', 'en'))?.id).toBe(node.id);
	});

	it('is a group of one by default; a shared group makes translations (no relations rows)', async () => {
		const { db, sqlite } = createTestDb();
		const en = await createNode(db, { type: 'post', slug: 'hello', lang: 'en', bodyMd: 'x', status: 'published' });
		expect(en.groupId).toBe(en.id);

		const zh = await createNode(db, {
			type: 'post',
			slug: 'hello',
			lang: 'zh',
			bodyMd: 'y',
			status: 'published',
			groupId: en.groupId
		});
		expect(zh.groupId).toBe(en.groupId);
		expect(await relatedIds(db, en.id)).toEqual([zh.id]);
		expect(await relatedIds(db, zh.id)).toEqual([en.id]);

		const row = /** @type {{ n: number }} */ (
			sqlite.prepare('SELECT COUNT(*) AS n FROM relations').get()
		);
		expect(Number(row.n)).toBe(0);
	});

	it('rendered comment HTML is derived and escaped, never stored', async () => {
		const html = await renderComment('**hi** <script>alert(1)</script>');
		expect(html).toContain('<strong>');
		expect(html).not.toContain('<script>');
	});

	it('CHECK constraints reject closed-enum violations', async () => {
		const { db } = createTestDb();
		await expect(
			createNode(db, {
				type: 'post',
				slug: 's1',
				lang: 'en',
				bodyMd: 'x',
				status: /** @type {any} */ ('weird')
			})
		).rejects.toThrow();

		await expect(
			createNode(db, {
				type: 'post',
				slug: 's2',
				lang: 'en',
				bodyMd: 'x',
				status: 'published',
				visibility: /** @type {any} */ ('secret')
			})
		).rejects.toThrow();
	});

	it('records the schema version in meta', () => {
		const { sqlite } = createTestDb();
		const row = /** @type {{ value: string }} */ (
			sqlite.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
		);
		expect(row.value).toBe('3');
	});
});

describe('declarative ordering', () => {
	it('orders by a declared numeric field, NULLs last', async () => {
		const { db } = createTestDb();
		/** @param {string} slug @param {number | null} order */
		const mk = (slug, order) =>
			createNode(db, {
				type: 'project',
				slug,
				lang: 'en',
				bodyMd: 'x',
				status: 'published',
				featured: true,
				fields: order === null ? {} : { order }
			});

		await mk('second', 2);
		await mk('first', 1);
		await mk('third', 3);
		await mk('unranked', null);

		const featured = await listFeatured(db, {
			types: ['project'],
			lang: 'en',
			orderByField: { field: 'order', numeric: true, direction: 'asc' }
		});

		expect(featured.map((n) => n.slug)).toEqual(['first', 'second', 'third', 'unranked']);
	});
});

describe('translation alternates', () => {
	it('resolves each language from group members, using its own slug', async () => {
		const { db } = createTestDb();
		const en = await createNode(db, {
			type: 'post',
			slug: 'hello-world',
			lang: 'en',
			title: 'Hello',
			bodyMd: 'x',
			status: 'published'
		});
		await createNode(db, {
			type: 'post',
			slug: 'ni-hao',
			lang: 'zh',
			title: '你好',
			bodyMd: 'y',
			status: 'published',
			groupId: en.groupId
		});

		const links = translationLinks(await listGroupNodes(db, en.groupId));
		expect(Object.fromEntries(links.map((l) => [l.lang, l.url]))).toEqual({
			en: 'posts/hello-world',
			zh: 'zh/posts/ni-hao'
		});
		expect(links.map((l) => l.lang)).toEqual(site.locales.map((l) => l.code));
	});

	it('omits a translation that is not published', async () => {
		const { db } = createTestDb();
		const en = await createNode(db, {
			type: 'post',
			slug: 'a',
			lang: 'en',
			bodyMd: 'x',
			status: 'published'
		});
		await createNode(db, {
			type: 'post',
			slug: 'b',
			lang: 'zh',
			bodyMd: 'y',
			status: 'draft',
			groupId: en.groupId
		});

		const links = translationLinks(await listGroupNodes(db, en.groupId));
		expect(links).toEqual([{ lang: 'en', url: 'posts/a' }]);
	});
});

describe('slug generation', () => {
	it('derives a unique slug within (type, lang)', async () => {
		const { db } = createTestDb();
		await createNode(db, {
			type: 'moment',
			slug: '2026-10-21',
			lang: 'en',
			bodyMd: 'a',
			status: 'published'
		});
		expect(await uniqueSlug(db, 'moment', 'en', '2026-10-21')).toBe('2026-10-21-2');
		expect(await uniqueSlug(db, 'moment', 'zh', '2026-10-21')).toBe('2026-10-21');
	});
});
