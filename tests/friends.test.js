import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createAsset } from '$lib/server/repositories/assets';
import { ensureOwner } from '$lib/server/repositories/people';
import { listFriendViews } from '$lib/content/view';
import {
	addApplication,
	approveApplication,
	hasFriendApplications,
	hasPendingApplication,
	listApplications,
	setApplicationStatus
} from '$lib/server/repositories/friendApplications';
import { normalizeSiteUrl } from '$lib/server/friends';
import { buildExport } from '$lib/server/export';

/**
 * @param {import('$lib/server/db').D1Database} db
 * @param {{ id: string }} owner
 * @param {any} [overrides]
 */
async function seedFriend(db, owner, overrides = {}) {
	return createAsset(db, {
		type: 'friend',
		lang: 'en',
		slug: 'friend',
		title: 'Friend',
		summary: 'A blog',
		bodyMd: '',
		status: 'published',
		visibility: 'public',
		authorId: owner.id,
		fields: { url: 'https://friend.example.com', order_index: 1 },
		...overrides
	});
}

describe('friend links', () => {
	it('lists published public links in curated order, across locales', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);

		await seedFriend(db, owner, { slug: 'second', title: 'Second', fields: { url: 'https://b.example.com', order_index: 2 } });
		await seedFriend(db, owner, { slug: 'first', title: 'First', fields: { url: 'https://a.example.com', order_index: 1 } });
		await seedFriend(db, owner, {
			slug: 'zh-link',
			lang: 'zh',
			title: '中文友链',
			fields: { url: 'https://c.example.com', order_index: 3 }
		});
		await seedFriend(db, owner, { slug: 'private', title: 'Private', visibility: 'private' });
		await seedFriend(db, owner, { slug: 'draft', title: 'Draft', status: 'draft' });

		const views = await listFriendViews(db);
		expect(views.map((v) => v.slug)).toEqual(['first', 'second', 'zh-link']);
		expect(views[0].url).toBe('https://a.example.com');
		// A non-default locale keeps its own detail URL.
		expect(views[2].detailUrl).toBe('zh/friends/zh-link');
	});

	it('stores applications in a queue and refuses a duplicate pending site', async () => {
		const { db } = createTestDb();
		expect(await hasFriendApplications(db)).toBe(true);

		const application = await addApplication(db, {
			name: 'Example',
			url: 'https://example.com',
			description: 'one line',
			email: 'a@example.com',
			lang: 'en',
			reciprocal: 'ok'
		});
		expect(application.status).toBe('pending');
		expect(await hasPendingApplication(db, 'https://example.com')).toBe(true);
		expect((await listApplications(db, { status: 'pending' })).map((a) => a.id)).toEqual([
			application.id
		]);
	});

	it('approval publishes a friend asset and links it back to the request', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);

		const application = await addApplication(db, {
			name: 'Example Blog',
			url: 'https://blog.example.com',
			description: 'notes and code',
			avatarUrl: 'https://blog.example.com/avatar.png',
			feedUrl: 'https://blog.example.com/feed.xml',
			lang: 'en',
			sourceHash: 'hash'
		});

		const result = await approveApplication(db, application.id, owner.id);
		expect(result.ok).toBe(true);

		const views = await listFriendViews(db);
		expect(views).toHaveLength(1);
		expect(views[0]).toMatchObject({
			title: 'Example Blog',
			description: 'notes and code',
			url: 'https://blog.example.com',
			avatar: 'https://blog.example.com/avatar.png',
			feed: 'https://blog.example.com/feed.xml'
		});

		const [closed] = await listApplications(db, { status: 'approved' });
		expect(closed.assetId).toBe(result.ok ? result.assetId : null);
		expect(closed.reviewedBy).toBe(owner.id);

		// The request is no longer pending: a second approval is a no-op.
		expect(await approveApplication(db, application.id, owner.id)).toEqual({
			ok: false,
			reason: 'not_pending'
		});
	});

	it('rejecting keeps the row for history without publishing anything', async () => {
		const { db } = createTestDb();
		const application = await addApplication(db, {
			name: 'Spam',
			url: 'https://spam.example.com',
			lang: 'en'
		});
		await setApplicationStatus(db, application.id, 'rejected', null);

		expect((await listApplications(db, { status: 'pending' })).length).toBe(0);
		expect((await listApplications(db, { status: 'rejected' }))[0].id).toBe(application.id);
		expect(await listFriendViews(db)).toHaveLength(0);
	});

	it('exports friend links but never the application queue', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		await seedFriend(db, owner);
		await addApplication(db, { name: 'X', url: 'https://x.example.com', lang: 'en' });

		const bundle = await buildExport(db);
		const paths = bundle.files.map((f) => f.path);
		expect(paths).toContain('friends.jsonl');
		expect(paths.some((p) => p.includes('friend_applications'))).toBe(false);
		expect(bundle.types).toContain('friend');
	});
});

describe('friend application URLs', () => {
	it('accepts http(s) URLs and normalizes them', () => {
		expect(normalizeSiteUrl('https://example.com/#top')).toBe('https://example.com/');
		expect(normalizeSiteUrl('http://blog.example.com/path?q=1')).toBe(
			'http://blog.example.com/path?q=1'
		);
	});

	it('refuses non-http schemes, credentials and local targets', () => {
		expect(normalizeSiteUrl('javascript:alert(1)')).toBeNull();
		expect(normalizeSiteUrl('ftp://example.com')).toBeNull();
		expect(normalizeSiteUrl('https://user:pass@example.com')).toBeNull();
		expect(normalizeSiteUrl('http://localhost:3000')).toBeNull();
		expect(normalizeSiteUrl('http://127.0.0.1')).toBeNull();
		expect(normalizeSiteUrl('http://192.168.1.10')).toBeNull();
		expect(normalizeSiteUrl('http://printer.local')).toBeNull();
		expect(normalizeSiteUrl('not a url')).toBeNull();
	});
});
