/**
 * `assets` + one table per content kind (docs/DATA-MODEL.md §4.5–4.6).
 *
 * The shared row carries what code must filter or sort by without knowing the
 * kind; the kind's own table carries the content. Everything else — comments,
 * tags, media, reactions — points at `assets.id`.
 */

import type { ContentNode, MediaItem, NewAsset, AssetStatus, Visibility } from '$lib/content/types';
import type { D1Database, D1PreparedStatement } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';
import { getContentType } from '$lib/content/registry';
import { mediaForAssets } from '$lib/server/repositories/media';
import { readTags, replaceTagStatements } from '$lib/server/repositories/tags';
import { site } from '$lib/site';

/** Columns every kind table has, in insert order. */
const KIND_SPINE = ['lang', 'slug', 'title', 'summary', 'body_md', 'body_html'];

/**
 * A kind's table is its name plus `s` (`post` → `posts`). The kind's own columns
 * are exactly its declared `fields` — the declaration *is* the column list, which
 * is what keeps the admin form, the write boundary and the database in step.
 */
export function kindTable(type: string): string {
	const name = type.trim().toLowerCase();
	if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`invalid content kind "${type}"`);
	return `${name}s`;
}

/**
 * Kinds whose `title` column is `NOT NULL` (migrations/0001_init.sql): a row
 * without one cannot be stored, so an absent title falls back to the slug.
 * Kinds with an optional title store NULL and let the display fall back to the
 * summary — see `nodeToView`.
 */
const TITLE_REQUIRED = new Set(['post', 'project']);

/** A declared field key, as a column name. */
export function fieldColumn(key: string): string {
	const name = key.trim().replace(/[^A-Za-z0-9_]/g, '_');
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
		throw new Error(`declared field "${key}" is not a usable column name`);
	}
	return name;
}

/** The kind's columns: the shared spine, then its declared fields. */
export function kindColumns(type: string): string[] {
	const declared = (getContentType(type)?.fields ?? []).map((f) => fieldColumn(f.key));
	return [...KIND_SPINE, ...declared.filter((c) => !KIND_SPINE.includes(c))];
}

/** Rows returned by an assets+kind join: `k_`-prefixed kind columns. */
type JoinedRow = Record<string, unknown> & { id: string; type: string };

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function toNode(
	row: JoinedRow,
	tags: Map<string, string[]>,
	media: Map<string, MediaItem[]>
): ContentNode {
	const type = String(row.type);
	const fields: Record<string, unknown> = {};
	for (const field of getContentType(type)?.fields ?? []) {
		const value = row[`k_${fieldColumn(field.key)}`];
		if (value !== null && value !== undefined) fields[field.key] = value;
	}
	const items = media.get(row.id) ?? [];
	const cover = items.find((m) => m.role === 'cover');
	return {
		id: row.id,
		type,
		lang: String(row.lang),
		groupId: String(row.group_id),
		slug: str(row.k_slug),
		title: (row.k_title as string | null) ?? null,
		summary: (row.k_summary as string | null) ?? null,
		bodyMd: str(row.k_body_md),
		bodyHtml: (row.k_body_html as string | null) ?? null,
		status: row.status as AssetStatus,
		publishedAt: (row.published_at as string | null) ?? null,
		occurredAt: (row.occurred_at as string | null) ?? null,
		visibility: row.visibility === 'private' ? 'private' : 'public',
		authorId: String(row.author_id),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		fields,
		tags: tags.get(row.id) ?? [],
		media: items,
		coverMediaId: cover?.id ?? null
	};
}

/** Bulk-loads tags and media for a set of asset ids. */
async function loadRelated(
	db: D1Database,
	ids: string[]
): Promise<{ tags: Map<string, string[]>; media: Map<string, MediaItem[]> }> {
	const [tags, media] = await Promise.all([readTags(db, ids), mediaForAssets(db, ids)]);
	return { tags, media };
}

/**
 * `SELECT a.*, k.<column> AS k_<column> …` for one kind. `columns` is the union
 * across the kinds being listed, so a multi-kind UNION has the same shape and
 * columns a kind does not have become NULL.
 */
function selectKind(type: string, columns: string[] = kindColumns(type)): string {
	const declared = new Set(kindColumns(type));
	const projected = columns
		.map((c) => (declared.has(c) ? `k.${c} AS k_${c}` : `NULL AS k_${c}`))
		.join(', ');
	return `SELECT a.*, ${projected} FROM assets a JOIN ${kindTable(type)} k ON k.id = a.id`;
}

export interface FieldFilter {
	field: string;
	number?: number;
	min?: number;
	max?: number;
	text?: string;
	bool?: boolean;
}

export interface FieldOrder {
	field: string;
	direction?: 'asc' | 'desc';
}

export interface ListAssetsOptions {
	/** One kind, or several (`types`) — several means a UNION across kind tables. */
	type?: string;
	types?: string[];
	lang?: string;
	status?: AssetStatus | 'all';
	/** Only assets carrying this exact tag. */
	tag?: string;
	/** Filter by visibility. Omit to include both (owner listings). */
	visibility?: Visibility;
	/** Field filters require a single kind (the field belongs to one table). */
	filterFields?: FieldFilter[];
	/** Field ordering requires a single kind. */
	orderByField?: FieldOrder;
	/** Which timestamp orders the list. Defaults to publish time. */
	orderBy?: 'published' | 'occurred';
	limit?: number;
	offset?: number;
}

export async function listAssets(
	db: D1Database,
	opts: ListAssetsOptions = {}
): Promise<ContentNode[]> {
	const types = opts.type ? [opts.type] : (opts.types ?? []);
	if (types.length === 0) return [];

	const where: string[] = [];
	const params: unknown[] = [];

	if (types.length === 1) {
		where.push('type = ?');
		params.push(types[0]);
	} else {
		where.push(`type IN (${types.map(() => '?').join(', ')})`);
		params.push(...types);
	}
	if (opts.lang) {
		where.push('lang = ?');
		params.push(opts.lang);
	}
	if (opts.status !== 'all') {
		where.push('status = ?');
		params.push(opts.status ?? 'published');
	}
	if (opts.visibility) {
		where.push('visibility = ?');
		params.push(opts.visibility);
	}
	if (opts.tag) {
		// The outer query is the alias `matched` (the UNION wraps one kind's SELECT,
		// where `assets` itself is aliased `a`): filtering by tag must use the wrapper.
		where.push(
			'EXISTS (SELECT 1 FROM asset_tags at JOIN tags t ON t.id = at.tag_id WHERE at.asset_id = matched.id AND t.name = ?)'
		);
		params.push(opts.tag);
	}

	// Field filters and field ordering only make sense for one kind: the column
	// lives on that kind's table (hence the outer query sees it as `k_<field>`).
	const singleKind = types.length === 1 ? types[0] : null;
	if (singleKind) {
		for (const filter of opts.filterFields ?? []) {
			const column = `k_${fieldColumn(filter.field)}`;
			if (filter.text !== undefined) {
				where.push(`${column} = ?`);
				params.push(filter.text);
			}
			if (filter.bool !== undefined) {
				where.push(`${column} = ?`);
				params.push(filter.bool ? 1 : 0);
			}
			if (filter.number !== undefined) {
				where.push(`${column} = ?`);
				params.push(filter.number);
			}
			if (filter.min !== undefined) {
				where.push(`${column} >= ?`);
				params.push(filter.min);
			}
			if (filter.max !== undefined) {
				where.push(`${column} < ?`);
				params.push(filter.max);
			}
		}
	}

	// DESC already sorts NULLs last in SQLite, so no `IS NULL` wrapper is needed —
	// and leaving it out lets the index provide the order.
	let order = 'ORDER BY published_at DESC, created_at DESC';
	if (singleKind && opts.orderByField) {
		const column = `k_${fieldColumn(opts.orderByField.field)}`;
		const direction = opts.orderByField.direction === 'asc' ? 'ASC' : 'DESC';
		order = `ORDER BY (${column} IS NULL), ${column} ${direction}, published_at DESC, created_at DESC`;
	} else if (opts.orderBy === 'occurred') {
		order = 'ORDER BY occurred_at DESC, created_at DESC';
	}

	const columns = [...new Set(types.flatMap((t) => kindColumns(t)))];
	const union = types.map((t) => selectKind(t, columns)).join('\nUNION ALL\n');
	const sql = `SELECT * FROM (
		${union}
	) AS matched WHERE ${where.join(' AND ')}
	${order}
	LIMIT ? OFFSET ?`;

	const rows = await query<JoinedRow>(db, sql, [...params, opts.limit ?? 50, opts.offset ?? 0]);
	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toNode(r, related.tags, related.media));
}

export async function getAsset(db: D1Database, id: string): Promise<ContentNode | null> {
	const kind = await first<{ type: string }>(db, 'SELECT type FROM assets WHERE id = ?', [id]);
	if (!kind) return null;
	const row = await first<JoinedRow>(db, `${selectKind(kind.type)} WHERE a.id = ?`, [id]);
	if (!row) return null;
	const related = await loadRelated(db, [id]);
	return toNode(row, related.tags, related.media);
}

export async function getAssetBySlug(
	db: D1Database,
	type: string,
	slug: string,
	lang: string
): Promise<ContentNode | null> {
	const row = await first<JoinedRow>(
		db,
		`${selectKind(type)} WHERE k.lang = ? AND k.slug = ?`,
		[lang, slug]
	);
	if (!row) return null;
	const related = await loadRelated(db, [row.id]);
	return toNode(row, related.tags, related.media);
}

/**
 * Make `base` unique within (kind, lang) by suffixing `-2`, `-3`, …. A writer may
 * leave the slug empty: filling in a URL identifier by hand is a typing tax.
 */
export async function uniqueSlug(
	db: D1Database,
	type: string,
	lang: string,
	base: string
): Promise<string> {
	let slug = base;
	let n = 1;
	while (await getAssetBySlug(db, type, slug, lang)) {
		n += 1;
		slug = `${base}-${n}`;
	}
	return slug;
}

/** Fields → the kind table's own column values (empty strings are omitted). */
function fieldValues(type: string, fields: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of getContentType(type)?.fields ?? []) {
		const value = fields[field.key];
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		out[fieldColumn(field.key)] =
			field.type === 'boolean' ? (value ? 1 : 0) : value;
	}
	return out;
}

/**
 * Fields → columns for a PATCH: a key that is present is written (an empty value
 * becomes NULL, so a field can be cleared); a key that is absent is left alone.
 */
function fieldPatchValues(type: string, fields: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of getContentType(type)?.fields ?? []) {
		if (!(field.key in fields)) continue;
		const value = fields[field.key];
		const empty =
			value === undefined ||
			value === null ||
			(typeof value === 'string' && value.trim() === '');
		out[fieldColumn(field.key)] = empty ? null : field.type === 'boolean' ? (value ? 1 : 0) : value;
	}
	return out;
}

async function indexAsset(db: D1Database, node: ContentNode): Promise<void> {
	const table = `${kindTable(node.type)}_fts`;
	await run(db, `DELETE FROM ${table} WHERE id = ?`, [node.id]);
	await run(db, `INSERT INTO ${table} (id, lang, title, summary, body) VALUES (?, ?, ?, ?, ?)`, [
		node.id,
		node.lang,
		buildSearchText([node.title]),
		buildSearchText([node.summary]),
		buildSearchText([node.bodyMd])
	]);
}

export async function createAsset(db: D1Database, input: NewAsset): Promise<ContentNode> {
	const now = new Date().toISOString();
	const id = input.id ?? ulid();
	const lang = input.lang ?? site.defaultLocale;
	const status = input.status ?? 'draft';
	const publishedAt = input.publishedAt ?? (status === 'published' ? now : null);
	const visibility = input.visibility ?? 'public';
	const bodyHtml = await renderMarkdown(input.bodyMd);
	const groupId = input.groupId ?? id;

	const kindValues = fieldValues(input.type, input.fields ?? {});
	const kindCols = Object.keys(kindValues);
	const table = kindTable(input.type);

	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`INSERT INTO assets
					(id, type, lang, group_id, status, visibility, published_at, occurred_at,
					 author_id, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				input.type,
				lang,
				groupId,
				status,
				visibility,
				publishedAt,
				input.occurredAt ?? null,
				input.authorId,
				now,
				now
			),
		db
			.prepare(
				`INSERT INTO ${table} (id, lang, slug, title, summary, body_md, body_html${
					kindCols.length ? ', ' + kindCols.join(', ') : ''
				}) VALUES (?, ?, ?, ?, ?, ?, ?${kindCols.length ? ', ' + kindCols.map(() => '?').join(', ') : ''})`
			)
			.bind(
				id,
				lang,
				input.slug,
				input.title?.trim() || (TITLE_REQUIRED.has(input.type) ? input.slug : null),
				input.summary ?? null,
				input.bodyMd,
				bodyHtml,
				...kindCols.map((c) => kindValues[c])
			),
		...replaceTagStatements(db, id, input.tags ?? [])
	];

	await db.batch(statements);

	const node = (await getAsset(db, id))!;
	await indexAsset(db, node);
	return node;
}

export interface AssetPatch {
	slug?: string;
	lang?: string;
	title?: string | null;
	summary?: string | null;
	bodyMd?: string;
	status?: AssetStatus;
	groupId?: string | null;
	publishedAt?: string | null;
	occurredAt?: string | null;
	visibility?: Visibility;
	authorId?: string;
	/** Replace the kind's declared fields (omit to leave them untouched). */
	fields?: Record<string, unknown>;
	/** Replace all tags (omit to leave them untouched). */
	tags?: string[];
}

export async function updateAsset(
	db: D1Database,
	id: string,
	patch: AssetPatch
): Promise<ContentNode | null> {
	const existing = await getAsset(db, id);
	if (!existing) return null;

	const now = new Date().toISOString();
	const status = patch.status ?? existing.status;
	let publishedAt = patch.publishedAt !== undefined ? patch.publishedAt : existing.publishedAt;
	if (status === 'published' && !publishedAt) publishedAt = now;

	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`UPDATE assets SET status = ?, visibility = ?, published_at = ?, occurred_at = ?,
					author_id = ?, group_id = ?, updated_at = ?
				 WHERE id = ?`
			)
			.bind(
				status,
				patch.visibility ?? existing.visibility,
				publishedAt,
				patch.occurredAt !== undefined ? patch.occurredAt : existing.occurredAt,
				patch.authorId ?? existing.authorId,
				patch.groupId !== undefined ? (patch.groupId ?? existing.id) : existing.groupId,
				now,
				id
			)
	];

	const slug = patch.slug ?? existing.slug;
	const lang = patch.lang ?? existing.lang;
	const title = patch.title !== undefined ? patch.title : existing.title;
	const summary = patch.summary !== undefined ? patch.summary : existing.summary;
	const bodyMd = patch.bodyMd !== undefined ? patch.bodyMd : existing.bodyMd;
	const bodyHtml =
		patch.bodyMd !== undefined ? await renderMarkdown(bodyMd) : existing.bodyHtml;

	const kindValues = patch.fields !== undefined ? fieldPatchValues(existing.type, patch.fields) : null;
	const sets = ['lang = ?', 'slug = ?', 'title = ?', 'summary = ?', 'body_md = ?', 'body_html = ?'];
	const params: unknown[] = [lang, slug, title, summary, bodyMd, bodyHtml];
	for (const [column, value] of Object.entries(kindValues ?? {})) {
		sets.push(`${column} = ?`);
		params.push(value);
	}
	params.push(id);
	statements.push(
		db.prepare(`UPDATE ${kindTable(existing.type)} SET ${sets.join(', ')} WHERE id = ?`).bind(...params)
	);

	if (patch.tags !== undefined) {
		statements.push(...replaceTagStatements(db, id, patch.tags));
	}

	await db.batch(statements);

	const node = (await getAsset(db, id))!;
	await indexAsset(db, node);
	return node;
}

export async function deleteAsset(db: D1Database, id: string): Promise<void> {
	const node = await getAsset(db, id);
	// Everything else cascades or is refused by the schema:
	//   · the kind row, comments, reactions and bindings cascade from `assets`;
	//   · `asset_media` refuses while an object is in use, so objects are collected
	//     separately (see `collectUnusedMedia`).
	if (!node) return;
	await run(db, `DELETE FROM ${kindTable(node.type)}_fts WHERE id = ?`, [id]);
	await run(db, 'DELETE FROM assets WHERE id = ?', [id]);
	await run(db, 'DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM asset_tags)');
}

/** Ids of the assets grouped with this one (translations / series siblings). */
export async function relatedIds(db: D1Database, id: string): Promise<string[]> {
	const node = await getAsset(db, id);
	if (!node) return [];
	const rows = await query<{ id: string }>(
		db,
		'SELECT id FROM assets WHERE group_id = ? AND id <> ?',
		[node.groupId, id]
	);
	return rows.map((r) => r.id);
}

/** Every asset sharing a group, the asset itself included. */
export async function listGroupNodes(db: D1Database, groupId: string): Promise<ContentNode[]> {
	const rows = await query<{ id: string; type: string }>(
		db,
		'SELECT id, type FROM assets WHERE group_id = ?',
		[groupId]
	);
	if (rows.length === 0) return [];
	const byType = new Map<string, string[]>();
	for (const row of rows) {
		byType.set(row.type, [...(byType.get(row.type) ?? []), row.id]);
	}
	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	const out: ContentNode[] = [];
	for (const [type, ids] of byType) {
		const joined = await query<JoinedRow>(
			db,
			`${selectKind(type)} WHERE a.id IN (${ids.map(() => '?').join(', ')})`,
			ids
		);
		for (const row of joined) out.push(toNode(row, related.tags, related.media));
	}
	return out;
}

/** Writes the derived HTML cache for one asset (used by the rebuild path). */
export async function setBodyHtml(
	db: D1Database,
	type: string,
	id: string,
	html: string
): Promise<void> {
	await run(db, `UPDATE ${kindTable(type)} SET body_html = ? WHERE id = ?`, [html, id]);
}

/** Puts the given assets into one group (translations/series). */
export async function setGroup(db: D1Database, ids: string[], groupId: string): Promise<void> {
	if (ids.length === 0) return;
	await run(db, `UPDATE assets SET group_id = ? WHERE id IN (${ids.map(() => '?').join(', ')})`, [
		groupId,
		...ids
	]);
}

/** Gives each asset its own group again (undoing a pairing). */
export async function ungroup(db: D1Database, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await run(
		db,
		`UPDATE assets SET group_id = id WHERE id IN (${ids.map(() => '?').join(', ')})`,
		ids
	);
}

export interface SearchOptions {
	lang?: string;
	visibility?: Visibility;
	limit?: number;
}

/** Full-text search within one kind (each kind has its own index). */
export async function searchAssets(
	db: D1Database,
	type: string,
	matchExpression: string,
	opts: SearchOptions = {}
): Promise<ContentNode[]> {
	if (!matchExpression) return [];
	const table = `${kindTable(type)}_fts`;
	const where = ["a.status = 'published'"];
	const params: unknown[] = [];
	if (opts.lang) {
		where.push('a.lang = ?');
		params.push(opts.lang);
	}
	if (opts.visibility) {
		where.push('a.visibility = ?');
		params.push(opts.visibility);
	}
	const sqlParams = [matchExpression, ...params, opts.limit ?? 30];
	const rows = await query<JoinedRow>(
		db,
		`${selectKind(type)}
		 JOIN (SELECT id, bm25(${table}) AS rank FROM ${table} WHERE ${table} MATCH ?) f ON f.id = a.id
		 WHERE ${where.join(' AND ')}
		 ORDER BY f.rank
		 LIMIT ?`,
		sqlParams
	);
	const related = await loadRelated(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toNode(r, related.tags, related.media));
}
