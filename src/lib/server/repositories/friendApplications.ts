/**
 * Friend-link applications: a moderation queue, not content.
 *
 * The public form writes here; the admin queue reads here. Only an approval
 * creates a `friends` asset (the published link). Rows keep the applicant's
 * contact email and a salted IP hash, which is why the table is deliberately
 * outside the export contract (docs/EXPORT-CONTRACT.md).
 */

import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { createAsset, uniqueSlug } from '$lib/server/repositories/assets';
import { slugify } from '$lib/reading';

export type FriendApplicationStatus = 'pending' | 'approved' | 'rejected' | 'spam';

/** Outcome of the reciprocal-link probe (the applicant linking back to us). */
export type ReciprocalState = 'ok' | 'missing' | 'unreachable' | 'skipped';

export interface FriendApplication {
	id: string;
	name: string;
	url: string;
	description: string | null;
	avatarUrl: string | null;
	feedUrl: string | null;
	linksPage: string | null;
	email: string | null;
	message: string | null;
	lang: string;
	status: FriendApplicationStatus;
	reciprocal: ReciprocalState | null;
	/** The published `friends` asset, once approved. */
	assetId: string | null;
	createdAt: string;
	reviewedAt: string | null;
	reviewedBy: string | null;
}

export interface NewFriendApplication {
	name: string;
	url: string;
	description?: string | null;
	avatarUrl?: string | null;
	feedUrl?: string | null;
	linksPage?: string | null;
	email?: string | null;
	message?: string | null;
	lang: string;
	reciprocal?: ReciprocalState | null;
	/** Salted IP hash; null when the address or the salt is unavailable. */
	sourceHash?: string | null;
}

interface ApplicationRow {
	id: string;
	name: string;
	url: string;
	description: string | null;
	avatar_url: string | null;
	feed_url: string | null;
	links_page: string | null;
	email: string | null;
	message: string | null;
	lang: string;
	status: FriendApplicationStatus;
	reciprocal: ReciprocalState | null;
	asset_id: string | null;
	created_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
}

function toApplication(row: ApplicationRow): FriendApplication {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		description: row.description,
		avatarUrl: row.avatar_url,
		feedUrl: row.feed_url,
		linksPage: row.links_page,
		email: row.email,
		message: row.message,
		lang: row.lang,
		status: row.status,
		reciprocal: row.reciprocal,
		assetId: row.asset_id,
		createdAt: row.created_at,
		reviewedAt: row.reviewed_at,
		reviewedBy: row.reviewed_by
	};
}

/** Whether the site opted into applications (the table exists). */
export async function hasFriendApplications(db: D1Database): Promise<boolean> {
	const row = await first<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'friend_applications'`
	);
	return (row?.n ?? 0) > 0;
}

/** How many requests this source hash made since `since` (rate limiting). */
export async function countApplicationsSince(
	db: D1Database,
	sourceHash: string,
	since: string
): Promise<number> {
	const row = await first<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM friend_applications WHERE source_hash = ? AND created_at >= ?',
		[sourceHash, since]
	);
	return row?.n ?? 0;
}

/** Whether this site already has a pending request (friendly duplicate answer). */
export async function hasPendingApplication(db: D1Database, url: string): Promise<boolean> {
	const row = await first<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM friend_applications WHERE url = ? AND status = 'pending'`,
		[url]
	);
	return (row?.n ?? 0) > 0;
}

export async function addApplication(
	db: D1Database,
	input: NewFriendApplication
): Promise<FriendApplication> {
	const id = ulid();
	const now = new Date().toISOString();
	await run(
		db,
		`INSERT INTO friend_applications
			(id, name, url, description, avatar_url, feed_url, links_page, email, message,
			 lang, status, reciprocal, source_hash, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
		[
			id,
			input.name,
			input.url,
			input.description ?? null,
			input.avatarUrl ?? null,
			input.feedUrl ?? null,
			input.linksPage ?? null,
			input.email ?? null,
			input.message ?? null,
			input.lang,
			input.reciprocal ?? null,
			input.sourceHash ?? null,
			now
		]
	);
	return {
		id,
		name: input.name,
		url: input.url,
		description: input.description ?? null,
		avatarUrl: input.avatarUrl ?? null,
		feedUrl: input.feedUrl ?? null,
		linksPage: input.linksPage ?? null,
		email: input.email ?? null,
		message: input.message ?? null,
		lang: input.lang,
		status: 'pending',
		reciprocal: input.reciprocal ?? null,
		assetId: null,
		createdAt: now,
		reviewedAt: null,
		reviewedBy: null
	};
}

export async function getApplication(
	db: D1Database,
	id: string
): Promise<FriendApplication | null> {
	const row = await first<ApplicationRow>(
		db,
		'SELECT * FROM friend_applications WHERE id = ?',
		[id]
	);
	return row ? toApplication(row) : null;
}

export async function listApplications(
	db: D1Database,
	opts: { status?: FriendApplicationStatus; limit?: number } = {}
): Promise<FriendApplication[]> {
	const where: string[] = [];
	const params: unknown[] = [];
	if (opts.status) {
		where.push('status = ?');
		params.push(opts.status);
	}
	params.push(opts.limit ?? 200);
	const rows = await query<ApplicationRow>(
		db,
		`SELECT * FROM friend_applications
		  ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		  ORDER BY created_at DESC
		  LIMIT ?`,
		params
	);
	return rows.map(toApplication);
}

/** Moves a request to any non-approved state (reject / spam). */
export async function setApplicationStatus(
	db: D1Database,
	id: string,
	status: Exclude<FriendApplicationStatus, 'approved'>,
	by: string | null
): Promise<void> {
	await run(
		db,
		`UPDATE friend_applications SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
		[status, new Date().toISOString(), by, id]
	);
}

/** Next curated position: after the last link, lowest first. */
async function nextFriendOrderIndex(db: D1Database): Promise<number> {
	const row = await first<{ n: number | null }>(
		db,
		'SELECT MAX(order_index) AS n FROM friends'
	);
	return (row?.n ?? 0) + 1;
}

/** A readable slug from the applicant's hostname (`blog.example.com` → `blog-example-com`). */
function slugFromUrl(url: string): string {
	try {
		return slugify(new URL(url).hostname.replace(/\./g, '-'));
	} catch {
		return '';
	}
}

/**
 * Approves a request: creates the published `friends` asset, then closes the
 * queue row in one step. The status update is conditional on `pending`, so two
 * concurrent approvals cannot publish the same site twice; the loser's asset is
 * removed again.
 */
export async function approveApplication(
	db: D1Database,
	id: string,
	by: string
): Promise<{ ok: true; assetId: string } | { ok: false; reason: 'not_found' | 'not_pending' }> {
	const application = await getApplication(db, id);
	if (!application) return { ok: false, reason: 'not_found' };
	if (application.status !== 'pending') return { ok: false, reason: 'not_pending' };

	const base = slugFromUrl(application.url) || slugify(application.name) || 'friend';
	const slug = await uniqueSlug(db, 'friend', application.lang, base);

	const node = await createAsset(db, {
		type: 'friend',
		slug,
		lang: application.lang,
		title: application.name,
		summary: application.description,
		bodyMd: '',
		status: 'published',
		visibility: 'public',
		authorId: by,
		fields: {
			url: application.url,
			avatar: application.avatarUrl,
			feed: application.feedUrl,
			order_index: await nextFriendOrderIndex(db)
		}
	});

	const now = new Date().toISOString();
	const result = await run(
		db,
		`UPDATE friend_applications
		    SET status = 'approved', asset_id = ?, reviewed_at = ?, reviewed_by = ?
		  WHERE id = ? AND status = 'pending'`,
		[node.id, now, by, id]
	);
	const changes = Number(
		(result.meta && typeof result.meta === 'object'
			? (result.meta as { changes?: number }).changes
			: 0) ?? 0
	);
	if (changes === 0) {
		// Someone else approved/rejected it first: do not leave a stray link.
		await run(db, 'DELETE FROM friends_fts WHERE id = ?', [node.id]);
		await run(db, 'DELETE FROM assets WHERE id = ?', [node.id]);
		return { ok: false, reason: 'not_pending' };
	}
	return { ok: true, assetId: node.id };
}
