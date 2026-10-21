/**
 * `node_tags` — many-to-many tags.
 *
 * Kept as its own table (not a JSON column) because tags are cross-type and are
 * aggregated: archives, counts, and "related by tag" are plain SQL.
 */

import type { D1Database, D1PreparedStatement } from '$lib/server/db';
import { query } from '$lib/server/db';
import type { NodeVisibility } from '$lib/content/types';

interface RawTagRow {
	node_id: string;
	tag: string;
}

/** Loads tags for many nodes in one query, keyed by node id. */
export async function readTags(
	db: D1Database,
	nodeIds: string[]
): Promise<Map<string, string[]>> {
	const out = new Map<string, string[]>();
	if (nodeIds.length === 0) return out;

	const placeholders = nodeIds.map(() => '?').join(', ');
	const rows = await query<RawTagRow>(
		db,
		`SELECT node_id, tag FROM node_tags WHERE node_id IN (${placeholders}) ORDER BY node_id, tag`,
		nodeIds
	);

	for (const row of rows) {
		const bucket = out.get(row.node_id) ?? [];
		bucket.push(row.tag);
		out.set(row.node_id, bucket);
	}
	return out;
}

/** Delete-then-insert statements that replace a node's tags. */
export function tagStatements(
	db: D1Database,
	nodeId: string,
	tags: string[]
): D1PreparedStatement[] {
	const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
	const statements: D1PreparedStatement[] = [
		db.prepare('DELETE FROM node_tags WHERE node_id = ?').bind(nodeId)
	];
	for (const tag of unique) {
		statements.push(
			db.prepare('INSERT INTO node_tags (node_id, tag) VALUES (?, ?)').bind(nodeId, tag)
		);
	}
	return statements;
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
	if (opts.types.length === 0) return [];
	const placeholders = opts.types.map(() => '?').join(', ');
	const rows = await query<{ tag: string; n: number }>(
		db,
		`SELECT t.tag AS tag, count(*) AS n
		   FROM node_tags t
		   JOIN nodes n ON n.id = t.node_id
		  WHERE n.status = 'published'
		    AND n.lang = ?
		    AND n.visibility = ?
		    AND n.type IN (${placeholders})
		  GROUP BY t.tag
		  ORDER BY n DESC, t.tag ASC
		  LIMIT ?`,
		[opts.lang, opts.visibility ?? 'public', ...opts.types, opts.limit ?? 200]
	);
	return rows.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

/** Every tag row for the export, deterministically ordered. */
export async function exportTagRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<RawTagRow>(
		db,
		'SELECT node_id, tag FROM node_tags ORDER BY node_id, tag'
	);
	return rows.map((row) => ({ node_id: row.node_id, tag: row.tag }));
}
