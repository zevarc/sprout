#!/usr/bin/env node
/**
 * blogs-sync — pull Zevprobe's discovered blogs into sprout's D1 database.
 *
 * Two source modes:
 *
 *   1. HTTP (default)   — pull from a running Zevprobe API (VPS deployment).
 *   2. --from-file      — read a JSONL snapshot exported by `zevprobe export`
 *                         (GitHub Actions deployment: no server needed, the
 *                         snapshot is the data contract).
 *
 * Incremental in HTTP mode via the `sync_state['zevprobe_blogs']` cursor; the
 * file mode re-upserts the whole (small) snapshot idempotently.
 *
 *   ZEVPROBE_URL=http://127.0.0.1:8787 \
 *   CF_ACCOUNT_ID=... CF_DATABASE_ID=... CF_API_TOKEN=... \
 *   pnpm blogs:sync                          # HTTP mode
 *
 *   pnpm blogs:sync -- --from-file data/export-2026-11-04.jsonl
 *
 * The token only needs Account → D1 → Edit on this one database — the
 * discovery service never holds write credentials, the sync is pull-shaped.
 */

import { readFileSync } from 'node:fs';

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? '';
const DATABASE_ID = process.env.CF_DATABASE_ID ?? '';
const API_TOKEN = process.env.CF_API_TOKEN ?? '';

if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
	console.error('blogs-sync: CF_ACCOUNT_ID, CF_DATABASE_ID and CF_API_TOKEN are required.');
	console.error('Create the token with Account → D1 → Edit scoped to the sprout database only.');
	process.exit(1);
}

const fromFileIdx = process.argv.indexOf('--from-file');
const FROM_FILE = fromFileIdx >= 0 ? process.argv[fromFileIdx + 1] : null;
const ZEVPROBE_URL = (process.env.ZEVPROBE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

const CF_API =
	process.env.CF_API_URL ??
	`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const CURSOR_KEY = 'zevprobe_blogs';

/** One D1 statement per call; returns the first result's `results` array. */
async function d1(sql, params = []) {
	const res = await fetch(CF_API, {
		method: 'POST',
		headers: { authorization: `Bearer ${API_TOKEN}`, 'content-type': 'application/json' },
		body: JSON.stringify({ sql, params })
	});
	const body = await res.json();
	if (!res.ok || !body.success) {
		throw new Error(`D1 query failed: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
	}
	return body.result?.[0]?.results ?? [];
}

const UPSERT_BLOG = `
INSERT INTO discovered_blogs
  (id, url, feed_url, title, description, language, favicon_url,
   last_post_at, first_seen, latest_posts, synced_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  url = excluded.url,
  feed_url = COALESCE(excluded.feed_url, feed_url),
  title = COALESCE(excluded.title, title),
  description = COALESCE(excluded.description, description),
  language = COALESCE(excluded.language, language),
  favicon_url = COALESCE(excluded.favicon_url, favicon_url),
  last_post_at = COALESCE(excluded.last_post_at, last_post_at),
  first_seen = COALESCE(excluded.first_seen, first_seen),
  latest_posts = excluded.latest_posts,
  synced_at = excluded.synced_at`;

/** @returns {Promise<{items: Array<object>, picks: Array<object>}>} */
async function fromHttp() {
	const now = new Date().toISOString();
	const cursorRows = await d1(`SELECT value FROM sync_state WHERE key = ?`, [CURSOR_KEY]);
	const since = Number(cursorRows[0]?.value ?? 0);
	console.log(`[blogs-sync] http mode, cursor: ${since}`);

	const items = [];
	let cursor = since;
	for (;;) {
		const res = await fetch(`${ZEVPROBE_URL}/api/blogs?since=${cursor}&limit=500`);
		if (!res.ok) throw new Error(`Zevprobe /api/blogs failed: ${res.status} ${await res.text()}`);
		const page = await res.json();
		if (!page.items?.length) break;
		items.push(...page.items);
		console.log(`[blogs-sync] pulled ${page.items.length} blogs (cursor ${cursor} -> ${page.nextCursor ?? 'end'})`);
		if (!page.nextCursor) break;
		cursor = page.nextCursor;
	}

	const picksRes = await fetch(`${ZEVPROBE_URL}/api/picks?limit=100`);
	const picks = picksRes.ok ? (await picksRes.json()).items ?? [] : [];
	if (!picksRes.ok) console.warn(`[blogs-sync] /api/picks failed: ${picksRes.status} (continuing)`);

	return { items, picks: picks.map((p) => ({ date: p.date, blog: p.blog, now })) };
}

function fromFile(path) {
	const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
	const items = [];
	const picks = [];
	for (const line of lines) {
		const rec = JSON.parse(line);
		if (rec.type === 'blog') items.push(rec);
		else if (rec.type === 'pick') picks.push({ date: rec.pickDate, blog: { id: rec.blogId } });
	}
	console.log(`[blogs-sync] file mode: ${path} -> ${items.length} blogs, ${picks.length} picks`);
	return { items, picks };
}

async function main() {
	const now = new Date().toISOString();
	const { items, picks } = FROM_FILE ? fromFile(FROM_FILE) : await fromHttp();

	// 1. Upsert blogs in chunks (a single statement per chunk keeps D1 params
	//    well under limits: 11 columns × 40 rows = 440 params).
	for (let i = 0; i < items.length; i += 40) {
		const slice = items.slice(i, i + 40);
		const placeholders = slice.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
		const params = slice.flatMap((b) => [
			b.id,
			b.url,
			b.feedUrl,
			b.title,
			b.description,
			b.language,
			b.faviconUrl,
			b.lastPostAt,
			b.firstSeen,
			JSON.stringify(b.latestPosts ?? []),
			now
		]);
		await d1(UPSERT_BLOG.replace('VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', `VALUES ${placeholders}`), params);
	}
	console.log(`[blogs-sync] upserted ${items.length} blogs`);

	// 2. Picks. A pick may reference a blog absent from this batch (fresh DB in
	//    HTTP mode) — backfill that single blog before inserting so the foreign
	//    key always resolves.
	const synced = new Set(picks.map((p) => p.date));
	for (const p of picks) {
		if (!p.blog?.id || !p.date) continue;
		if (!FROM_FILE && items.every((b) => b.id !== p.blog.id)) {
			const r = await fetch(`${ZEVPROBE_URL}/api/blogs?since=${p.blog.id - 1}&limit=1`);
			const { items: backfill } = await r.json();
			const b = backfill?.[0];
			if (b?.id !== p.blog.id) {
				console.warn(`[blogs-sync] pick ${p.date}: blog #${p.blog.id} unavailable, skipped`);
				continue;
			}
			await d1(UPSERT_BLOG, [
				b.id, b.url, b.feedUrl, b.title, b.description, b.language,
				b.faviconUrl, b.lastPostAt, b.firstSeen, JSON.stringify(b.latestPosts ?? []), now
			]);
		}
		await d1(
			`INSERT INTO discovered_picks (pick_date, blog_id, synced_at) VALUES (?, ?, ?)
			 ON CONFLICT(pick_date) DO UPDATE SET blog_id = excluded.blog_id, synced_at = excluded.synced_at`,
			[p.date, p.blog.id, now]
		);
	}
	console.log(`[blogs-sync] picks synced: ${synced.size}`);

	// 3. Advance cursor (HTTP mode only — file mode is snapshot-based).
	if (!FROM_FILE && items.length > 0) {
		const maxId = Math.max(...items.map((b) => b.id));
		await d1(
			`INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
			[CURSOR_KEY, String(maxId), now]
		);
	}
	console.log(`[blogs-sync] done`);
}

main().catch((err) => {
	console.error(`[blogs-sync] fatal: ${err.message}`);
	process.exit(1);
});
