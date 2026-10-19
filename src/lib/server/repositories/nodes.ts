import type { ContentNode, NewNode, NodeStatus } from '$lib/content/types';
import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';

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

	const sql = `SELECT * FROM nodes ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY (published_at IS NULL), published_at DESC, created_at DESC
		LIMIT ? OFFSET ?`;
	params.push(opts.limit ?? 50, opts.offset ?? 0);

	const rows = await query<NodeRow>(db, sql, params);
	return rows.map(toNode);
}

/** Published nodes explicitly marked `extra.featured = true`. */
export async function listFeatured(
	db: D1Database,
	opts: { types: string[]; lang: string; limit?: number }
): Promise<ContentNode[]> {
	const placeholders = opts.types.map(() => '?').join(', ');
	const rows = await query<NodeRow>(
		db,
		`SELECT * FROM nodes
		 WHERE type IN (${placeholders})
		   AND lang = ?
		   AND status = 'published'
		   AND json_extract(extra, '$.featured') = 1
		 ORDER BY (published_at IS NULL), published_at DESC, created_at DESC
		 LIMIT ?`,
		[...opts.types, opts.lang, opts.limit ?? 5]
	);
	return rows.map(toNode);
}

export interface TagCount {
	tag: string;
	count: number;
}

/** Distinct tags with how many published nodes carry each, most used first. */
export async function listTags(
	db: D1Database,
	opts: { lang: string; types: string[]; limit?: number }
): Promise<TagCount[]> {
	const placeholders = opts.types.map(() => '?').join(', ');
	const rows = await query<{ tag: string; n: number }>(
		db,
		`SELECT je.value AS tag, count(*) AS n
		 FROM nodes, json_each(nodes.extra, '$.tags') AS je
		 WHERE nodes.status = 'published'
		   AND nodes.lang = ?
		   AND nodes.type IN (${placeholders})
		 GROUP BY je.value
		 ORDER BY n DESC, je.value ASC
		 LIMIT ?`,
		[opts.lang, ...opts.types, opts.limit ?? 200]
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
	const lang = input.lang ?? 'en';
	const status = input.status ?? 'draft';
	const publishedAt =
		input.publishedAt ?? (status === 'published' ? now : null);
	const bodyHtml = await renderMarkdown(input.bodyMd);
	const groupId = input.groupId ?? `${input.type}:${input.slug}`;

	await run(
		db,
		`INSERT INTO nodes
			(id, type, slug, lang, group_id, title, summary, body_md, body_html, status, published_at, created_at, updated_at, extra)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
	extra?: Record<string, unknown>;
	publishedAt?: string | null;
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
	const extra = patch.extra !== undefined ? patch.extra : existing.extra;

	let publishedAt = patch.publishedAt !== undefined ? patch.publishedAt : existing.publishedAt;
	if (status === 'published' && !publishedAt) publishedAt = now;

	const bodyHtml = patch.bodyMd !== undefined ? await renderMarkdown(bodyMd) : existing.bodyHtml;

	await run(
		db,
		`UPDATE nodes SET title = ?, summary = ?, body_md = ?, body_html = ?, status = ?,
			slug = ?, lang = ?, published_at = ?, updated_at = ?, extra = ?
		 WHERE id = ?`,
		[
			title,
			summary,
			bodyMd,
			bodyHtml,
			status,
			slug,
			lang,
			publishedAt,
			now,
			JSON.stringify(extra ?? {}),
			id
		]
	);

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

/** Ids this node is linked to via a given relation (default: translation). */
export async function relatedIds(
	db: D1Database,
	id: string,
	rel = 'translation'
): Promise<string[]> {
	const rows = await query<{ to_id: string }>(
		db,
		'SELECT to_id FROM relations WHERE from_id = ? AND rel = ?',
		[id, rel]
	);
	return rows.map((r) => r.to_id);
}

export interface SearchOptions {
	type?: string;
	lang?: string;
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
