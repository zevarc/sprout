import type {
	ContentNode,
	MediaItem,
	NewNode,
	NodeStatus,
	NodeVisibility
} from '$lib/content/types';
import type { D1Database, D1PreparedStatement } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';
import { fieldStatements, readFields } from '$lib/server/repositories/fields';
import { readTags, tagStatements } from '$lib/server/repositories/tags';
import { mediaForNodes } from '$lib/server/repositories/media';
import { site } from '$lib/site';

interface NodeRow {
	id: string;
	type: string;
	slug: string;
	lang: string;
	group_id: string;
	title: string | null;
	summary: string | null;
	body_md: string;
	body_html: string | null;
	status: string;
	published_at: string | null;
	occurred_at: string | null;
	visibility: string;
	featured: number;
	cover_media_id: string | null;
	author_actor_id: string | null;
	created_at: string;
	updated_at: string;
}

interface Related {
	fields: Map<string, Record<string, unknown>>;
	tags: Map<string, string[]>;
	media: Map<string, MediaItem[]>;
}

/** Bulk-loads the three child relations for a set of node ids. */
async function loadRelated(db: D1Database, ids: string[]): Promise<Related> {
	if (ids.length === 0) {
		return { fields: new Map(), tags: new Map(), media: new Map() };
	}
	const [fields, tags, media] = await Promise.all([
		readFields(db, ids),
		readTags(db, ids),
		mediaForNodes(db, ids)
	]);
	return { fields, tags, media };
}

function toNode(row: NodeRow, related: Related): ContentNode {
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
		featured: row.featured === 1,
		coverMediaId: row.cover_media_id,
		authorActorId: row.author_actor_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		fields: related.fields.get(row.id) ?? {},
		tags: related.tags.get(row.id) ?? [],
		media: related.media.get(row.id) ?? []
	};
}

/** One numeric/text condition on a declared field. */
export interface FieldFilter {
	field: string;
	/** Numeric equality (`value_number = ?`). */
	number?: number;
	/** Numeric range: `value_number >= min` and `< max`. */
	min?: number;
	max?: number;
	/** Text equality (`value_text = ?`). */
	text?: string;
	/** Boolean equality (`value_bool = ?`). */
	bool?: boolean;
}

/** Orders a list by a declared field (indexed on `(field, value_*)`). */
export interface FieldOrder {
	field: string;
	numeric?: boolean;
	direction?: 'asc' | 'desc';
}

export interface ListNodesOptions {
	type?: string;
	types?: string[];
	lang?: string;
	status?: NodeStatus | 'all';
	/** Only nodes carrying this exact tag. */
	tag?: string;
	/** Filter by visibility. Omit to include both (owner listings). */
	visibility?: NodeVisibility;
	/** Filter by declared field values (SQL, not in-memory). */
	filterFields?: FieldFilter[];
	/** Order by a declared field (SQL). */
	orderByField?: FieldOrder;
	/** Which timestamp orders the list. Defaults to publish time. */
	orderBy?: 'published' | 'occurred';
	limit?: number;
	offset?: number;
}

export async function listNodes(db: D1Database, opts: ListNodesOptions = {}): Promise<ContentNode[]> {
	const where: string[] = [];
	const params: unknown[] = [];
	const joins: string[] = [];
	const joinParams: unknown[] = [];

	if (opts.type) {
		where.push('n.type = ?');
		params.push(opts.type);
	} else if (opts.types && opts.types.length > 0) {
		where.push(`n.type IN (${opts.types.map(() => '?').join(', ')})`);
		params.push(...opts.types);
	}
	if (opts.lang) {
		where.push('n.lang = ?');
		params.push(opts.lang);
	}
	if (opts.status !== 'all') {
		where.push('n.status = ?');
		params.push(opts.status ?? 'published');
	}
	if (opts.tag) {
		where.push(
			'EXISTS (SELECT 1 FROM node_tags t WHERE t.node_id = n.id AND t.tag = ?)'
		);
		params.push(opts.tag);
	}
	if (opts.visibility) {
		where.push('n.visibility = ?');
		params.push(opts.visibility);
	}

	for (const filter of opts.filterFields ?? []) {
		if (filter.text !== undefined) {
			where.push(
				'EXISTS (SELECT 1 FROM node_fields f WHERE f.node_id = n.id AND f.field = ? AND f.value_text = ?)'
			);
			params.push(filter.field, filter.text);
		}
		if (filter.bool !== undefined) {
			where.push(
				'EXISTS (SELECT 1 FROM node_fields f WHERE f.node_id = n.id AND f.field = ? AND f.value_bool = ?)'
			);
			params.push(filter.field, filter.bool ? 1 : 0);
		}
		if (filter.number !== undefined) {
			where.push(
				'EXISTS (SELECT 1 FROM node_fields f WHERE f.node_id = n.id AND f.field = ? AND f.value_number = ?)'
			);
			params.push(filter.field, filter.number);
		}
		if (filter.min !== undefined || filter.max !== undefined) {
			const range: string[] = [];
			const rangeParams: unknown[] = [filter.field];
			if (filter.min !== undefined) {
				range.push('f.value_number >= ?');
				rangeParams.push(filter.min);
			}
			if (filter.max !== undefined) {
				range.push('f.value_number < ?');
				rangeParams.push(filter.max);
			}
			where.push(
				`EXISTS (SELECT 1 FROM node_fields f WHERE f.node_id = n.id AND f.field = ? AND ${range.join(' AND ')})`
			);
			params.push(...rangeParams);
		}
	}

	let order = 'ORDER BY (n.published_at IS NULL), n.published_at DESC, n.created_at DESC';
	if (opts.orderByField) {
		joins.push('LEFT JOIN node_fields of ON of.node_id = n.id AND of.field = ?');
		joinParams.push(opts.orderByField.field);
		const column = opts.orderByField.numeric ? 'of.value_number' : 'of.value_text';
		const direction = opts.orderByField.direction === 'asc' ? 'ASC' : 'DESC';
		// NULLs last, then the field, then a stable tiebreak.
		order = `ORDER BY (${column} IS NULL), ${column} ${direction}, n.published_at DESC, n.created_at DESC`;
	} else if (opts.orderBy === 'occurred') {
		order = 'ORDER BY (n.occurred_at IS NULL), n.occurred_at DESC, n.created_at DESC';
	}

	const sql = `SELECT n.* FROM nodes n
		${joins.join('\n')}
		${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		${order}
		LIMIT ? OFFSET ?`;

	const rows = await query<NodeRow>(db, sql, [
		...joinParams,
		...params,
		opts.limit ?? 50,
		opts.offset ?? 0
	]);

	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toNode(r, related));
}

/**
 * Published nodes explicitly marked `featured`. Public by default — a featured
 * flag must never surface private content.
 */
export async function listFeatured(
	db: D1Database,
	opts: {
		types: string[];
		lang: string;
		visibility?: NodeVisibility;
		limit?: number;
		orderByField?: FieldOrder;
	}
): Promise<ContentNode[]> {
	if (opts.types.length === 0) return [];
	const placeholders = opts.types.map(() => '?').join(', ');
	const joinParams: unknown[] = [];
	let join = '';
	let order = 'ORDER BY (n.published_at IS NULL), n.published_at DESC, n.created_at DESC';

	if (opts.orderByField) {
		join = 'LEFT JOIN node_fields of ON of.node_id = n.id AND of.field = ?';
		joinParams.push(opts.orderByField.field);
		const column = opts.orderByField.numeric ? 'of.value_number' : 'of.value_text';
		const direction = opts.orderByField.direction === 'asc' ? 'ASC' : 'DESC';
		order = `ORDER BY (${column} IS NULL), ${column} ${direction}, n.published_at DESC, n.created_at DESC`;
	}

	const rows = await query<NodeRow>(
		db,
		`SELECT n.* FROM nodes n ${join}
		  WHERE n.type IN (${placeholders})
		    AND n.lang = ?
		    AND n.status = 'published'
		    AND n.visibility = ?
		    AND n.featured = 1
		  ${order}
		  LIMIT ?`,
		[...joinParams, ...opts.types, opts.lang, opts.visibility ?? 'public', opts.limit ?? 5]
	);
	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toNode(r, related));
}

export async function getNode(db: D1Database, id: string): Promise<ContentNode | null> {
	const row = await first<NodeRow>(db, 'SELECT * FROM nodes WHERE id = ?', [id]);
	if (!row) return null;
	return toNode(row, await loadRelated(db, [row.id]));
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
	if (!row) return null;
	return toNode(row, await loadRelated(db, [row.id]));
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
	const publishedAt = input.publishedAt ?? (status === 'published' ? now : null);
	const visibility = input.visibility ?? 'public';
	const bodyHtml = await renderMarkdown(input.bodyMd);
	// A node is its own group of one unless it shares one (translations/series).
	const groupId = input.groupId ?? id;

	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`INSERT INTO nodes
					(id, type, slug, lang, group_id, title, summary, body_md, body_html, status,
					 published_at, occurred_at, visibility, featured, cover_media_id, author_actor_id,
					 created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
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
				input.featured ? 1 : 0,
				input.coverMediaId ?? null,
				input.authorActorId ?? null,
				now,
				now
			),
		...fieldStatements(db, id, input.fields ?? {}),
		...tagStatements(db, id, input.tags ?? [])
	];

	await db.batch(statements);

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
	publishedAt?: string | null;
	occurredAt?: string | null;
	visibility?: NodeVisibility;
	featured?: boolean;
	coverMediaId?: string | null;
	authorActorId?: string | null;
	/** Replace all declared fields (omit to leave them untouched). */
	fields?: Record<string, unknown>;
	/** Replace all tags (omit to leave them untouched). */
	tags?: string[];
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
	const groupId =
		patch.groupId !== undefined ? (patch.groupId ?? existing.id) : existing.groupId;

	let publishedAt = patch.publishedAt !== undefined ? patch.publishedAt : existing.publishedAt;
	if (status === 'published' && !publishedAt) publishedAt = now;

	const occurredAt = patch.occurredAt !== undefined ? patch.occurredAt : existing.occurredAt;
	const visibility = patch.visibility ?? existing.visibility;
	const featured = patch.featured !== undefined ? patch.featured : existing.featured;
	const coverMediaId =
		patch.coverMediaId !== undefined ? patch.coverMediaId : existing.coverMediaId;
	const authorActorId =
		patch.authorActorId !== undefined ? patch.authorActorId : existing.authorActorId;

	const bodyHtml = patch.bodyMd !== undefined ? await renderMarkdown(bodyMd) : existing.bodyHtml;

	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`UPDATE nodes SET title = ?, summary = ?, body_md = ?, body_html = ?, status = ?,
					slug = ?, lang = ?, group_id = ?, published_at = ?, occurred_at = ?,
					visibility = ?, featured = ?, cover_media_id = ?, author_actor_id = ?,
					updated_at = ?
				 WHERE id = ?`
			)
			.bind(
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
				featured ? 1 : 0,
				coverMediaId,
				authorActorId,
				now,
				id
			)
	];

	if (patch.fields !== undefined) {
		statements.push(...fieldStatements(db, id, patch.fields));
	}
	if (patch.tags !== undefined) {
		statements.push(...tagStatements(db, id, patch.tags));
	}

	await db.batch(statements);

	const node = (await getNode(db, id))!;
	await indexNode(db, node);
	return node;
}

export async function deleteNode(db: D1Database, id: string): Promise<void> {
	// Children cascade via foreign keys; the explicit deletes keep behaviour
	// identical when a host does not enforce them.
	await run(db, 'DELETE FROM nodes WHERE id = ?', [id]);
	await run(db, 'DELETE FROM nodes_fts WHERE id = ?', [id]);
	await run(db, 'DELETE FROM media WHERE node_id = ?', [id]);
	await run(db, 'DELETE FROM node_fields WHERE node_id = ?', [id]);
	await run(db, 'DELETE FROM node_tags WHERE node_id = ?', [id]);
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
	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toNode(r, related));
}
