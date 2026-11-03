/**
 * Zevprobe blogroll — read side.
 *
 * The `discovered_blogs` / `discovered_picks` tables are written exclusively by
 * `scripts/blogs-sync.mjs` (pull from the discovery service over the D1 HTTP
 * API). The app only reads them: no admin surface, no engine coupling, and the
 * whole capability disappears cleanly if the tables are absent (e.g. a site
 * that never ran the migration just gets a 404 on /blogroll).
 */

import type { D1Database } from '$lib/server/db';
import { query, first } from '$lib/server/db';

export interface DiscoveredPost {
	url: string;
	title: string | null;
	publishedAt: string | null;
}

export interface DiscoveredBlog {
	id: number;
	url: string;
	feedUrl: string | null;
	title: string | null;
	description: string | null;
	language: string | null;
	faviconUrl: string | null;
	lastPostAt: string | null;
	firstSeen: string | null;
	latestPosts: DiscoveredPost[];
	syncedAt: string;
}

export interface DiscoveredPick {
	pickDate: string;
	blog: DiscoveredBlog | null;
}

interface BlogRow {
	id: number;
	url: string;
	feed_url: string | null;
	title: string | null;
	description: string | null;
	language: string | null;
	favicon_url: string | null;
	last_post_at: string | null;
	first_seen: string | null;
	latest_posts: string;
	synced_at: string;
}

function toBlog(row: BlogRow): DiscoveredBlog {
	let posts: DiscoveredPost[] = [];
	try {
		posts = JSON.parse(row.latest_posts) as DiscoveredPost[];
	} catch {
		posts = [];
	}
	return {
		id: row.id,
		url: row.url,
		feedUrl: row.feed_url,
		title: row.title ?? row.url,
		description: row.description,
		language: row.language,
		faviconUrl: row.favicon_url,
		lastPostAt: row.last_post_at,
		firstSeen: row.first_seen,
		latestPosts: posts,
		syncedAt: row.synced_at
	};
}

/** Whether the blogroll tables exist (site opted into the capability). */
export async function hasBlogroll(db: D1Database): Promise<boolean> {
	const row = await first<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'discovered_blogs'`
	);
	return (row?.n ?? 0) > 0;
}

export async function listDiscoveredBlogs(db: D1Database, limit = 500): Promise<DiscoveredBlog[]> {
	const rows = await query<BlogRow>(
		db,
		`SELECT * FROM discovered_blogs ORDER BY last_post_at IS NULL, last_post_at DESC, id ASC LIMIT ?`,
		[limit]
	);
	return rows.map(toBlog);
}

export async function listDiscoveredPicks(
	db: D1Database,
	limit = 30
): Promise<DiscoveredPick[]> {
	// `b.*` flattens the blog columns into the row, so the pick date sits beside
	// them; a pick whose blog row is missing still yields `pick_date` with a
	// null id.
	const rows = await query<{ pick_date: string; id: number | null } & Partial<BlogRow>>(
		db,
		`SELECT p.pick_date, b.*
		 FROM discovered_picks p
		 LEFT JOIN discovered_blogs b ON b.id = p.blog_id
		 ORDER BY p.pick_date DESC LIMIT ?`,
		[limit]
	);
	return rows.map((r) => ({
		pickDate: r.pick_date,
		blog: r.id != null ? toBlog(r as BlogRow) : null
	}));
}

/** The most recent pick (used for the "today's discovery" highlight). */
export async function getLatestPick(db: D1Database): Promise<DiscoveredPick | null> {
	const picks = await listDiscoveredPicks(db, 1);
	return picks[0] ?? null;
}

/** Read the pull cursor (max synced Zevprobe blog id). */
export async function getSyncCursor(db: D1Database, key: string): Promise<number | null> {
	const row = await first<{ value: string }>(db, `SELECT value FROM sync_state WHERE key = ?`, [
		key
	]);
	if (!row) return null;
	const n = Number(row.value);
	return Number.isFinite(n) ? n : null;
}
