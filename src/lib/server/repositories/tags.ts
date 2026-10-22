/**
 * `tags` (a vocabulary) + `asset_tags` (usage). A vocabulary table means renaming
 * a tag is one UPDATE and per-kind counts stay a single GROUP BY over `assets`.
 */

import type { D1Database, D1PreparedStatement } from '$lib/server/db';
import { query } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import type { Visibility } from '$lib/content/types';

interface RawTagRow {
	asset_id: string;
	tag: string;
}

/** Loads tag names for many assets in one query, keyed by asset id. */
export async function readTags(
	db: D1Database,
	assetIds: string[]
): Promise<Map<string, string[]>> {
	const out = new Map<string, string[]>();
	if (assetIds.length === 0) return out;

	const rows = await query<RawTagRow>(
		db,
		`SELECT at.asset_id AS asset_id, t.name AS tag
		   FROM asset_tags at JOIN tags t ON t.id = at.tag_id
		  WHERE at.asset_id IN (${assetIds.map(() => '?').join(', ')})
		  ORDER BY at.asset_id, t.name`,
		assetIds
	);
	for (const row of rows) {
		const bucket = out.get(row.asset_id) ?? [];
		bucket.push(row.tag);
		out.set(row.asset_id, bucket);
	}
	return out;
}

/**
 * Statements that replace one asset's tags: clear its bindings, make sure every
 * name exists in the vocabulary, then bind. All three run in the caller's batch,
 * so an asset never ends up half-tagged.
 */
export function replaceTagStatements(
	db: D1Database,
	assetId: string,
	tags: string[]
): D1PreparedStatement[] {
	const names = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
	const statements: D1PreparedStatement[] = [
		db.prepare('DELETE FROM asset_tags WHERE asset_id = ?').bind(assetId)
	];
	for (const name of names) {
		statements.push(
			db.prepare('INSERT INTO tags (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING').bind(ulid(), name),
			db
				.prepare(
					'INSERT INTO asset_tags (asset_id, tag_id) SELECT ?, id FROM tags WHERE name = ? ON CONFLICT DO NOTHING'
				)
				.bind(assetId, name)
		);
	}
	return statements;
}

export interface TagCount {
	tag: string;
	count: number;
}

/**
 * Distinct tags with how many published assets carry each, most used first.
 * Public by default — a tag that only exists on a private asset must never be
 * advertised on a public archive or in the sitemap.
 */
export async function listTags(
	db: D1Database,
	opts: { lang: string; types: string[]; visibility?: Visibility; limit?: number }
): Promise<TagCount[]> {
	if (opts.types.length === 0) return [];
	const rows = await query<{ tag: string; n: number }>(
		db,
		`SELECT t.name AS tag, count(*) AS n
		   FROM asset_tags at
		   JOIN tags t   ON t.id = at.tag_id
		   JOIN assets a ON a.id = at.asset_id
		  WHERE a.status = 'published'
		    AND a.lang = ?
		    AND a.visibility = ?
		    AND a.type IN (${opts.types.map(() => '?').join(', ')})
		  GROUP BY t.name
		  ORDER BY n DESC, t.name ASC
		  LIMIT ?`,
		[opts.lang, opts.visibility ?? 'public', ...opts.types, opts.limit ?? 200]
	);
	return rows.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

/** Every vocabulary row for the export (deterministic order). */
export async function exportTagRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<{ id: string; name: string }>(
		db,
		'SELECT id, name FROM tags ORDER BY name'
	);
	return rows.map((r) => ({ id: r.id, name: r.name }));
}

/** Every binding for the export (deterministic order). */
export async function exportAssetTagRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<{ asset_id: string; tag_id: string }>(
		db,
		'SELECT asset_id, tag_id FROM asset_tags ORDER BY asset_id, tag_id'
	);
	return rows.map((r) => ({ asset_id: r.asset_id, tag_id: r.tag_id }));
}
