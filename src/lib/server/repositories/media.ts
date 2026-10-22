/**
 * `media` (one row per stored object) + `asset_media` (where it is used).
 *
 * A file is content-addressed, so the same object can be bound to several assets:
 * one `media` row, many bindings. `alt`, `position` and `role` belong to the
 * binding; the object is shared. Deleting is "unbind, then collect": the schema's
 * `ON DELETE RESTRICT` refuses to drop an object that is still in use.
 */

import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import type { MediaItem } from '$lib/content/types';

interface AttachmentRow {
	id: string;
	r2_key: string;
	kind: string;
	alt: string | null;
	position: number;
	role: string;
	sha256: string | null;
}

const ATTACHMENT_COLUMNS = `m.id AS id, m.r2_key AS r2_key, m.kind AS kind,
	m.sha256 AS sha256, am.alt AS alt, am.position AS position, am.role AS role`;

function toItem(row: AttachmentRow): MediaItem {
	return {
		id: row.id,
		r2Key: row.r2_key,
		kind: row.kind,
		alt: row.alt,
		position: row.position,
		role: row.role === 'cover' ? 'cover' : 'body',
		sha256: row.sha256
	};
}

/** Media bound to many assets in one query, keyed by asset id. */
export async function mediaForAssets(
	db: D1Database,
	assetIds: string[]
): Promise<Map<string, MediaItem[]>> {
	const out = new Map<string, MediaItem[]>();
	if (assetIds.length === 0) return out;

	const rows = await query<AttachmentRow & { asset_id: string }>(
		db,
		`SELECT am.asset_id AS asset_id, ${ATTACHMENT_COLUMNS}
		   FROM asset_media am JOIN media m ON m.id = am.media_id
		  WHERE am.asset_id IN (${assetIds.map(() => '?').join(', ')})
		  ORDER BY am.asset_id, am.position, m.id`,
		assetIds
	);
	for (const row of rows) {
		const bucket = out.get(row.asset_id) ?? [];
		bucket.push(toItem(row));
		out.set(row.asset_id, bucket);
	}
	return out;
}

export async function listMediaForAsset(db: D1Database, assetId: string): Promise<MediaItem[]> {
	const rows = await query<AttachmentRow>(
		db,
		`SELECT ${ATTACHMENT_COLUMNS}
		   FROM asset_media am JOIN media m ON m.id = am.media_id
		  WHERE am.asset_id = ?
		  ORDER BY am.position, m.id`,
		[assetId]
	);
	return rows.map(toItem);
}

export interface MediaObject {
	id: string;
	r2Key: string;
	kind: string;
	sha256: string | null;
}

export async function getMediaObject(db: D1Database, id: string): Promise<MediaObject | null> {
	const row = await first<{ id: string; r2_key: string; kind: string; sha256: string | null }>(
		db,
		'SELECT id, r2_key, kind, sha256 FROM media WHERE id = ?',
		[id]
	);
	return row ? { id: row.id, r2Key: row.r2_key, kind: row.kind, sha256: row.sha256 } : null;
}

export async function findMediaByKey(db: D1Database, r2Key: string): Promise<MediaObject | null> {
	const row = await first<{ id: string; r2_key: string; kind: string; sha256: string | null }>(
		db,
		'SELECT id, r2_key, kind, sha256 FROM media WHERE r2_key = ?',
		[r2Key]
	);
	return row ? { id: row.id, r2Key: row.r2_key, kind: row.kind, sha256: row.sha256 } : null;
}

/** Records the object (idempotent by key: one row per stored file). */
export async function recordMediaObject(
	db: D1Database,
	input: { r2Key: string; kind?: string; sha256?: string | null }
): Promise<string> {
	const existing = await findMediaByKey(db, input.r2Key);
	if (existing) return existing.id;
	const id = ulid();
	await run(
		db,
		'INSERT INTO media (id, r2_key, kind, sha256, created_at) VALUES (?, ?, ?, ?, ?)',
		[id, input.r2Key, input.kind ?? 'image', input.sha256 ?? null, new Date().toISOString()]
	);
	return id;
}

export interface Binding {
	position?: number;
	alt?: string | null;
	role?: 'body' | 'cover';
}

/** Binds an object to an asset (one row per use). */
export async function bindMedia(
	db: D1Database,
	assetId: string,
	mediaId: string,
	binding: Binding = {}
): Promise<void> {
	await run(
		db,
		`INSERT INTO asset_media (asset_id, media_id, position, alt, role) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(asset_id, media_id) DO UPDATE SET
			position = excluded.position, alt = excluded.alt, role = excluded.role`,
		[assetId, mediaId, binding.position ?? 0, binding.alt ?? null, binding.role ?? 'body']
	);
}

/** Unbinds one use. The object stays until nothing references it. */
export async function unbindMedia(
	db: D1Database,
	assetId: string,
	mediaId: string
): Promise<void> {
	await run(db, 'DELETE FROM asset_media WHERE asset_id = ? AND media_id = ?', [assetId, mediaId]);
}

export async function updateBinding(
	db: D1Database,
	assetId: string,
	mediaId: string,
	patch: Binding
): Promise<void> {
	const sets: string[] = [];
	const params: unknown[] = [];
	if (patch.alt !== undefined) {
		sets.push('alt = ?');
		params.push(patch.alt);
	}
	if (patch.position !== undefined) {
		sets.push('position = ?');
		params.push(patch.position);
	}
	if (patch.role !== undefined) {
		sets.push('role = ?');
		params.push(patch.role);
	}
	if (sets.length === 0) return;
	params.push(assetId, mediaId);
	await run(
		db,
		`UPDATE asset_media SET ${sets.join(', ')} WHERE asset_id = ? AND media_id = ?`,
		params
	);
}

/** True while any asset still uses the object (then it must not be deleted). */
export async function mediaInUse(db: D1Database, mediaId: string): Promise<boolean> {
	const row = await first<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM asset_media WHERE media_id = ?',
		[mediaId]
	);
	return Number(row?.n ?? 0) > 0;
}

/** Drops the metadata row. Only call it after checking `mediaInUse`. */
export async function deleteMediaObject(db: D1Database, mediaId: string): Promise<void> {
	await run(db, 'DELETE FROM media WHERE id = ?', [mediaId]);
}

/**
 * Readability of an object: public only when **every** asset that binds it is
 * public (docs/DATA-MODEL.md §4.10). An object nothing binds is private.
 */
export async function mediaVisibility(
	db: D1Database,
	r2Key: string
): Promise<{ attached: boolean; public: boolean }> {
	const row = await first<{ attachments: number; private_bindings: number }>(
		db,
		`SELECT COUNT(am.media_id) AS attachments,
		        SUM(CASE WHEN am.asset_id IS NOT NULL AND a.visibility <> 'public' THEN 1 ELSE 0 END) AS private_bindings
		   FROM media m
		   LEFT JOIN asset_media am ON am.media_id = m.id
		   LEFT JOIN assets a ON a.id = am.asset_id
		  WHERE m.r2_key = ?`,
		[r2Key]
	);
	const attachments = Number(row?.attachments ?? 0);
	const privateBindings = Number(row?.private_bindings ?? 0);
	return {
		attached: attachments > 0,
		public: attachments > 0 && privateBindings === 0
	};
}
