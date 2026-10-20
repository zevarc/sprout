import type { ContentNode, NewNode, NodeStatus, NodeVisibility } from '$lib/content/types';
import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';
import { site } from '$lib/site';

interface NodeRow {
	id: string;
	type: string;
	slug: string;
	lang: string;
	group_id: string | null;
	title: string | null;
	summary: string | null;
	body_md: string;
	body_html: string | null;
	status: string;
	published_at: string | null;
	occurred_at: string | null;
	visibility: string;
	author_actor_id: string | null;
	created_at: string;
	updated_at: string;
	extra: string | null;
}

function toNode(row: NodeRow): ContentNode {
	let extra: Record<string, unknown> = {};
	if (row.extra) {
		try {
			extra = JSON.parse(row.extra);
		} catch {
			extra = {};
		}
	}
	return {
		id: row.id,
		type: row.type,
		slug: row.slug,
		lang: row.lang,
		groupId: row.group_id,
		title: row.title,
		summary: row.summary,
		bodyMd: row.body_md,
		bodyHtml: row.body_html,
		status: row.status as NodeStatus,
		publishedAt: row.published_at,
		occurredAt: row.occurred_at,
		visibility: row.visibility === 'private' ? 'private' : 'public',
		authorActorId: row.author_actor_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		extra
	};
}

export interface ListNodesOptions {
	type?: string;
	types?: string[];
	lang?: string;
	status?: NodeStatus | 'all';
	/** Only nodes whose `extra.tags` contains this exact tag. */
	tag?: string;
	/** Filter by visibility. Omit to include both (owner listings). */
	visibility?: NodeVisibility;
	/** Which timestamp orders the list. Defaults to publish time. */
	orderBy?: 'published' | 'occurred';
	limit?: number;
	offset?: number;
}

export async function listNodes(db: D1Database, opts: ListNodesOptions = {}): Promise<ContentNode[]> {
	const where: string[] = [];
	const params: unknown[] = [];

	if (opts.type) {
		where.push('type = ?');
		params.push(opts.type);
	} else if (opts.types && opts.types.length > 0) {
		where.push(`type IN (${opts.types.map(() => '?').join(', ')})`);
		params.push(...opts.types);
	}
	if (opts.lang) {
		where.push('lang = ?');
		params.push(opts.lang);
	}
	if (opts.status !== 'all') {
		where.push('status = ?');
		params.push(opts.status ?? 'published');
	}
	if (opts.tag) {
		// `extra.tags` is a JSON array; json_each gives one row per tag.
		where.push(
			`EXISTS (SELECT 1 FROM json_each(nodes.extra, '$.tags') AS je WHERE je.value = ?)`
		);
		params.push(opts.tag);
	}
	if (opts.visibility) {
		where.push('visibility = ?');
		params.push(opts.visibility);
	}

	// Timeline ordering keys off when things happened, not when they were written.
	const order =
		opts.orderBy === 'occurred'
			? 'ORDER BY (occurred_at IS NULL), occurred_at DESC, created_at DESC'
			: 'ORDER BY (published_at IS NULL), published_at DESC, created_at DESC';

	const sql = `SELECT * FROM nodes ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		${order}
		LIMIT ? OFFSET ?`;
	params.push(opts.limit ?? 50, opts.offset ?? 0);

	const rows = await query<NodeRow>(db, sql, params);
	return rows.map(toNode);
}

/**
 * Published nodes explicitly marked `extra.featured = true`.
 * Public by default — a featured flag must never surface private content.
 */
export async function listFeatured(
	db: D1Database,
	opts: { types: string[]; lang: string; visibility?: NodeVisibility; limit?: number }
): Promise<ContentNode[]> {
	const placeholders = opts.types.map(() => '?').join(', ');
	const rows = await query<NodeRow>(
		db,
		`SELECT * FROM nodes
		 WHERE type IN (${placeholders})
		   AND lang = ?
		   AND status = 'published'
		   AND visibility = ?
		   AND json_extract(extra, '$.featured') = 1
		 ORDER BY (published_at IS NULL), published_at DESC, created_at DESC
		 LIMIT ?`,
		[...opts.types, opts.lang, opts.visibility ?? 'public', opts.limit ?? 5]
	);
	return rows.map(toNode);
}

export interface TagCount {
	tag: string;
	count: number;
}

/**
 * Distinct tags with how many published nodes carry each, most used first.
 * Public by default — a tag that only exists on a private node must never be
 * advertised on a public archive or in the sitemap.
 */
export async function listTags(
	db: D1Database,
	opts: { lang: string; types: string[]; visibility?: NodeVisibility; limit?: number }
): Promise<TagCount[]> {
	const placeholders = opts.types.map(() => '?').join(', ');
	const rows = await query<{ tag: string; n: number }>(
		db,
		`SELECT je.value AS tag, count(*) AS n
		 FROM nodes, json_each(nodes.extra, '$.tags') AS je
		 WHERE nodes.status = 'published'
		   AND nodes.lang = ?
		   AND nodes.visibility = ?
		   AND nodes.type IN (${placeholders})
		 GROUP BY je.value
		 ORDER BY n DESC, je.value ASC
		 LIMIT ?`,
		[opts.lang, opts.visibility ?? 'public', ...opts.types, opts.limit ?? 200]
	);
	return rows.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

export async function getNode(db: D1Database, id: string): Promise<ContentNode | null> {
	const row = await first<NodeRow>(db, 'SELECT * FROM nodes WHERE id = ?', [id]);
	return row ? toNode(row) : null;
}

export async function getNodeBySlug(
	db: D1Database,
	type: string,
	slug: string,
	lang: string
): Promise<ContentNode | null> {
	const row = await first<NodeRow>(
		db,
		'SELECT * FROM nodes WHERE type = ? AND slug = ? AND lang = ?',
		[type, slug, lang]
	);
	return row ? toNode(row) : null;
}

async function indexNode(db: D1Database, node: ContentNode): Promise<void> {
	await run(db, 'DELETE FROM nodes_fts WHERE id = ?', [node.id]);
	await run(
		db,
		'INSERT INTO nodes_fts (id, title, summary, body) VALUES (?, ?, ?, ?)',
		[
			node.id,
			buildSearchText([node.title]),
			buildSearchText([node.summary]),
			buildSearchText([node.bodyMd])
		]
	);
}

export async function createNode(db: D1Database, input: NewNode): Promise<ContentNode> {
	const now = new Date().toISOString();
	const id = input.id ?? ulid();
	const lang = input.lang ?? site.defaultLocale;
	const status = input.status ?? 'draft';
	const publishedAt =
		input.publishedAt ?? (status === 'published' ? now : null);
	const visibility = input.visibility ?? 'public';
	const bodyHtml = await renderMarkdown(input.bodyMd);
	// A node is its own group of one unless it shares one (translations/series).
	const groupId = input.groupId ?? id;

	await run(
		db,
		`INSERT INTO nodes
			(id, type, slug, lang, group_id, title, summary, body_md, body_html, status, published_at,
			 occurred_at, visibility, author_actor_id, created_at, updated_at, extra)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.type,
			input.slug,
			lang,
			groupId,
			input.title ?? null,
			input.summary ?? null,
			input.bodyMd,
			bodyHtml,
			status,
			publishedAt,
			input.occurredAt ?? null,
			visibility,
			input.authorActorId ?? null,
			now,
			now,
			JSON.stringify(input.extra ?? {})
		]
	);

	const node = (await getNode(db, id))!;
	await indexNode(db, node);
	return node;
}

export interface NodePatch {
	title?: string | null;
	summary?: string | null;
	bodyMd?: string;
	status?: NodeStatus;
	slug?: string;
	lang?: string;
	groupId?: string | null;
	extra?: Record<string, unknown>;
	publishedAt?: string | null;
	occurredAt?: string | null;
	visibility?: NodeVisibility;
	authorActorId?: string | null;
}

export async function updateNode(
	db: D1Database,
	id: string,
	patch: NodePatch
): Promise<ContentNode | null> {
	const existing = await getNode(db, id);
	if (!existing) return null;

	const now = new Date().toISOString();
	const title = patch.title !== undefined ? patch.title : existing.title;
	const summary = patch.summary !== undefined ? patch.summary : existing.summary;
	const bodyMd = patch.bodyMd !== undefined ? patch.bodyMd : existing.bodyMd;
	const status = patch.status ?? existing.status;
	const slug = patch.slug ?? existing.slug;
	const lang = patch.lang ?? existing.lang;
	const groupId = patch.groupId !== undefined ? patch.groupId : existing.groupId;
	const extra = patch.extra !== undefined ? patch.extra : existing.extra;

	let publishedAt = patch.publishedAt !== undefined ? patch.publishedAt : existing.publishedAt;
	if (status === 'published' && !publishedAt) publishedAt = now;

	const occurredAt = patch.occurredAt !== undefined ? patch.occurredAt : existing.occurredAt;
	const visibility = patch.visibility ?? existing.visibility;
	const authorActorId =
		patch.authorActorId !== undefined ? patch.authorActorId : existing.authorActorId;

	const bodyHtml = patch.bodyMd !== undefined ? await renderMarkdown(bodyMd) : existing.bodyHtml;

	await run(
		db,
		`UPDATE nodes SET title = ?, summary = ?, body_md = ?, body_html = ?, status = ?,
			slug = ?, lang = ?, group_id = ?, published_at = ?, occurred_at = ?, visibility = ?,
			author_actor_id = ?, updated_at = ?, extra = ?
		 WHERE id = ?`,
		[
			title,
			summary,
			bodyMd,
			bodyHtml,
			status,
			slug,
			lang,
			groupId,
			publishedAt,
			occurredAt,
			visibility,
			authorActorId,
			now,
			JSON.stringify(extra ?? {}),
			id
		]
	);

	// Media inherits its node's readability; there is no per-media visibility.

	const node = (await getNode(db, id))!;
	await indexNode(db, node);
	return node;
}

export async function deleteNode(db: D1Database, id: string): Promise<void> {
	await run(db, 'DELETE FROM nodes WHERE id = ?', [id]);
	await run(db, 'DELETE FROM nodes_fts WHERE id = ?', [id]);
	await run(db, 'DELETE FROM media WHERE node_id = ?', [id]);
	await run(db, 'DELETE FROM relations WHERE from_id = ? OR to_id = ?', [id, id]);
}

/**
 * Ids of the nodes grouped with this one — i.e. its translations (same group,
 * different `lang`) and, in a series, its siblings. Derived entirely from
 * `group_id`; there is no separate translation edge.
 */
export async function relatedIds(db: D1Database, id: string): Promise<string[]> {
	const node = await getNode(db, id);
	if (!node) return [];
	const rows = await query<{ id: string }>(
		db,
		'SELECT id FROM nodes WHERE group_id = ? AND id <> ?',
		[node.groupId, id]
	);
	return rows.map((r) => r.id);
}

/** Writes the derived HTML cache for one node (used by the rebuild path). */
export async function setBodyHtml(db: D1Database, id: string, html: string): Promise<void> {
	await run(db, 'UPDATE nodes SET body_html = ? WHERE id = ?', [html, id]);
}

/** Puts the given nodes into one group (translations/series). */
export async function setGroup(db: D1Database, ids: string[], groupId: string): Promise<void> {
	if (ids.length === 0) return;
	const placeholders = ids.map(() => '?').join(', ');
	await run(db, `UPDATE nodes SET group_id = ? WHERE id IN (${placeholders})`, [groupId, ...ids]);
}

/** Gives each node its own group again (undoing a pairing). */
export async function ungroup(db: D1Database, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const placeholders = ids.map(() => '?').join(', ');
	await run(db, `UPDATE nodes SET group_id = id WHERE id IN (${placeholders})`, ids);
}

export interface SearchOptions {
	type?: string;
	lang?: string;
	/** Filter by visibility. Omit to search everything (owner search). */
	visibility?: NodeVisibility;
	limit?: number;
}

/** Full-text search over published nodes via FTS5 (bigram-tokenized). */
export async function searchNodes(
	db: D1Database,
	matchExpression: string,
	opts: SearchOptions = {}
): Promise<ContentNode[]> {
	if (!matchExpression) return [];
	const where = ['n.status = ?'];
	const params: unknown[] = ['published'];
	if (opts.type) {
		where.push('n.type = ?');
		params.push(opts.type);
	}
	if (opts.lang) {
		where.push('n.lang = ?');
		params.push(opts.lang);
	}
	if (opts.visibility) {
		where.push('n.visibility = ?');
		params.push(opts.visibility);
	}
	params.push(matchExpression, opts.limit ?? 30);

	const rows = await query<NodeRow & { rank: number }>(
		db,
		`SELECT n.*, bm25(nodes_fts) AS rank
		 FROM nodes_fts
		 JOIN nodes n ON n.id = nodes_fts.id
		 WHERE ${where.join(' AND ')} AND nodes_fts MATCH ?
		 ORDER BY rank
		 LIMIT ?`,
		params
	);
	return rows.map(toNode);
}
