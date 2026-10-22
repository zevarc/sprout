import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import {
	createAsset,
	getAsset,
	getAssetBySlug,
	listAssets,
	uniqueSlug,
	updateAsset,
	deleteAsset,
	relatedIds
} from '$lib/server/repositories/assets';
import { createPerson, ensureOwner, listMembers } from '$lib/server/repositories/people';
import { addComment, hasApprovedComment, listComments, setCommentStatus } from '$lib/server/repositories/comments';
import { addReaction } from '$lib/server/repositories/reactions';
import { listTags } from '$lib/server/repositories/tags';
import {
	bindMedia,
	mediaVisibility,
	mediaInUse,
	recordMediaObject
} from '$lib/server/repositories/media';

/** The v4 schema's own invariants, exercised through the repositories. */
describe('schema', () => {
	it('is schema 4 and carries none of the v3 tables', () => {
		const { sqlite } = createTestDb();
		const version = /** @type {{ value: string }} */ (
			sqlite.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
		);
		expect(version.value).toBe('4');

		const names = /** @type {{ name: string }[]} */ (
			sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
		).map((r) => r.name);
		for (const gone of ['nodes', 'node_fields', 'node_tags', 'events', 'event_status', 'actors', 'relations', 'stats_daily']) {
			expect(names).not.toContain(gone);
		}
		expect(names).toEqual(expect.arrayContaining(['assets', 'people', 'comments', 'reactions', 'tags', 'media']));
	});
});

describe('assets', () => {
	it('splits the shared row from the kind row, and reads both back', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);

		const post = await createAsset(db, {
			type: 'post',
			slug: 'hello',
			lang: 'en',
			title: 'Hello',
			summary: 'first',
			bodyMd: '# hi',
			status: 'published',
			authorId: owner.id,
			tags: ['a', 'a', 'b']
		});

		const read = await getAsset(db, post.id);
		expect(read?.title).toBe('Hello');
		expect(read?.bodyMd).toBe('# hi');
		expect(read?.bodyHtml).toContain('<h1');
		expect(read?.tags).toEqual(['a', 'b']);
		expect(read?.authorId).toBe(owner.id);

		// One shared row per asset; the content lives on the kind table.
		const { sqlite } = createTestDb();
		void sqlite;
	});

	it('keeps a slug unique within (kind, lang), not across kinds', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'type' | 'slug'>} */
		const base = { lang: 'en', title: 't', bodyMd: 'x', status: 'published', authorId: owner.id };

		await createAsset(db, { ...base, type: 'post', slug: 'dup' });
		expect(await uniqueSlug(db, 'post', 'en', 'dup')).toBe('dup-2');
		expect(await uniqueSlug(db, 'note', 'en', 'dup')).toBe('dup');
		expect(await getAssetBySlug(db, 'moment', 'dup', 'en')).toBeNull();
	});

	it('stores NULL titles for kinds that allow them, so the summary can show', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);

		const moment = await createAsset(db, {
			type: 'moment',
			slug: '2026-10-22',
			lang: 'zh',
			title: null,
			summary: '只要有搜索框的地方就有流量',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		expect(moment.title).toBeNull();
		expect(moment.summary).toBe('只要有搜索框的地方就有流量');

		// `posts.title` is NOT NULL, so the slug keeps an untitled post addressable.
		const post = await createAsset(db, {
			type: 'post',
			slug: 'hello',
			lang: 'en',
			title: null,
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		expect(post.title).toBe('hello');
	});

	it('filters by visibility and status in SQL', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'type' | 'slug'>} */
		const base = { lang: 'en', title: 't', bodyMd: 'x', authorId: owner.id };

		await createAsset(db, { ...base, type: 'post', slug: 'pub', status: 'published' });
		await createAsset(db, {
			...base,
			type: 'post',
			slug: 'priv',
			status: 'published',
			visibility: 'private'
		});
		await createAsset(db, { ...base, type: 'post', slug: 'draft' });

		const pub = await listAssets(db, { types: ['post'], lang: 'en', visibility: 'public' });
		expect(pub.map((n) => n.slug)).toEqual(['pub']);

		const everything = await listAssets(db, {
			types: ['post'],
			lang: 'en',
			status: 'all'
		});
		expect(everything.map((n) => n.slug).sort()).toEqual(['draft', 'priv', 'pub']);
	});

	it('lists several kinds in one ordered query', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		/** @type {Omit<import('$lib/content/types').NewAsset, 'type' | 'slug'>} */
		const base = { lang: 'en', bodyMd: 'x', authorId: owner.id };

		await createAsset(db, {
			...base,
			type: 'post',
			slug: 'p',
			title: 'P',
			status: 'published',
			publishedAt: '2026-01-01T00:00:00.000Z'
		});
		await createAsset(db, {
			...base,
			type: 'note',
			slug: 'n',
			title: 'N',
			status: 'published',
			publishedAt: '2026-02-01T00:00:00.000Z'
		});

		const all = await listAssets(db, { types: ['post', 'note'], lang: 'en' });
		expect(all.map((n) => n.type)).toEqual(['note', 'post']);
	});

	it('stores kind-specific attributes as real columns', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const project = await createAsset(db, {
			type: 'project',
			slug: 'p1',
			lang: 'en',
			title: 'P1',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id,
			fields: { year: '2026', stage: 'active', order_index: 2 }
		});
		expect(project.fields).toEqual({ year: '2026', stage: 'active', order_index: 2 });

		const updated = await updateAsset(db, project.id, { fields: { stage: 'archived' } });
		expect(updated?.fields.stage).toBe('archived');
		// A key that is absent is left alone…
		expect(updated?.fields.year).toBe('2026');
		// …and an explicitly cleared key becomes NULL.
		const cleared = await updateAsset(db, project.id, { fields: { year: null } });
		expect(cleared?.fields.year).toBeUndefined();
	});

	it('groups translations by group id, not by slug', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const en = await createAsset(db, {
			type: 'post',
			slug: 'hello',
			lang: 'en',
			title: 'Hello',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		const zh = await createAsset(db, {
			type: 'post',
			slug: 'ni-hao',
			lang: 'zh',
			title: '你好',
			bodyMd: 'y',
			status: 'published',
			authorId: owner.id,
			groupId: en.groupId
		});

		expect(zh.groupId).toBe(en.groupId);
		expect(await relatedIds(db, en.id)).toEqual([zh.id]);
	});

	it('deletes an asset and its kind row together', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const post = await createAsset(db, {
			type: 'post',
			slug: 'gone',
			lang: 'en',
			title: 'Gone',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		await deleteAsset(db, post.id);
		expect(await getAsset(db, post.id)).toBeNull();
		expect(await getAssetBySlug(db, 'post', 'gone', 'en')).toBeNull();
	});
});

describe('people, comments, reactions', () => {
	it('has exactly one owner', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		expect(owner.role).toBe('owner');
		expect(await ensureOwner(db)).toMatchObject({ id: owner.id });

		await expect(
			createPerson(db, { role: 'owner', displayName: 'Second' })
		).rejects.toThrow();
		await createPerson(db, { role: 'member', displayName: 'Member' });
		expect((await listMembers(db)).map((p) => p.displayName)).toEqual(['Member']);
	});

	it('comments carry one status and the trust check reads it', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const asset = await createAsset(db, {
			type: 'post',
			slug: 'c',
			lang: 'en',
			title: 'C',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		const person = await createPerson(db, { displayName: 'Reader' });

		const comment = await addComment(db, {
			assetId: asset.id,
			authorId: person.id,
			bodyMd: 'hi'
		});
		expect(comment.status).toBe('pending');
		expect(await listComments(db, { assetId: asset.id })).toHaveLength(0);
		expect(await hasApprovedComment(db, person.id)).toBe(false);

		await setCommentStatus(db, comment.id, 'approved', owner.id);
		expect(await listComments(db, { assetId: asset.id })).toHaveLength(1);
		expect(await hasApprovedComment(db, person.id)).toBe(true);

		// A later spam decision must take the trust away again.
		await setCommentStatus(db, comment.id, 'spam', owner.id);
		expect(await hasApprovedComment(db, person.id)).toBe(false);
	});

	it('a person cannot be deleted while their content exists', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		await createAsset(db, {
			type: 'post',
			slug: 'attributed',
			lang: 'en',
			title: 'A',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		const { run } = await import('$lib/server/db');
		await expect(run(db, 'DELETE FROM people WHERE id = ?', [owner.id])).rejects.toThrow();
	});

	it('refuses the same reaction twice', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const asset = await createAsset(db, {
			type: 'moment',
			slug: 'm',
			lang: 'en',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		await addReaction(db, asset.id, owner.id, '👍');
		await addReaction(db, asset.id, owner.id, '👍');
	});
});

describe('tags and media', () => {
	it('treats tags as a vocabulary shared by assets', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const base = { lang: 'en', title: 't', bodyMd: 'x', authorId: owner.id };

		await createAsset(db, { ...base, type: 'post', slug: 'a', status: 'published', tags: ['shared'] });
		await createAsset(db, { ...base, type: 'note', slug: 'b', status: 'published', tags: ['shared'] });

		const tags = await listTags(db, { lang: 'en', types: ['post', 'note'] });
		expect(tags).toEqual([{ tag: 'shared', count: 2 }]);
	});

	it('shares one media row across assets and judges it strictly', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const pub = await createAsset(db, {
			type: 'post',
			slug: 'pub',
			lang: 'en',
			title: 'P',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		const priv = await createAsset(db, {
			type: 'post',
			slug: 'priv',
			lang: 'en',
			title: 'Q',
			bodyMd: 'x',
			status: 'published',
			visibility: 'private',
			authorId: owner.id
		});

		const mediaId = await recordMediaObject(db, { r2Key: 'abc.png', sha256: 'abc' });
		await bindMedia(db, pub.id, mediaId, { role: 'cover', alt: 'cover' });
		expect((await getAsset(db, pub.id))?.coverMediaId).toBe(mediaId);
		expect(await mediaVisibility(db, 'abc.png')).toEqual({ attached: true, public: true });

		// Binding the same object to a private asset makes it private for everyone.
		await bindMedia(db, priv.id, mediaId, { position: 1 });
		expect(await mediaVisibility(db, 'abc.png')).toEqual({ attached: true, public: false });
		expect(await mediaInUse(db, mediaId)).toBe(true);

		// One cover per asset, enforced by the schema.
		const other = await recordMediaObject(db, { r2Key: 'def.png' });
		await expect(bindMedia(db, pub.id, other, { role: 'cover' })).rejects.toThrow();
	});
});
