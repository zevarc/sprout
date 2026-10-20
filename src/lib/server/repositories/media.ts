import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';

export interface MediaRow {
	id: string;
	nodeId: string | null;
	r2Key: string;
	kind: string;
	width: number | null;
	height: number | null;
	alt: string | null;
	position: number;
	sha256: string | null;
}

interface RawMediaRow {
	id: string;
	node_id: string | null;
	r2_key: string;
	kind: string;
	width: number | null;
	height: number | null;
	alt: string | null;
	position: number;
	sha256: string | null;
}

function toMedia(row: RawMediaRow): MediaRow {
	return {
		id: row.id,
		nodeId: row.node_id,
		r2Key: row.r2_key,
		kind: row.kind,
		width: row.width,
		height: row.height,
		alt: row.alt,
		position: row.position,
		sha256: row.sha256
	};
}

const COLUMNS = 'id, node_id, r2_key, kind, width, height, alt, position, sha256';

export async function listMediaForNode(db: D1Database, nodeId: string): Promise<MediaRow[]> {
	const rows = await query<RawMediaRow>(
		db,
		`SELECT ${COLUMNS} FROM media WHERE node_id = ? ORDER BY position, id`,
		[nodeId]
	);
	return rows.map(toMedia);
}

export async function getMedia(db: D1Database, id: string): Promise<MediaRow | null> {
	const row = await first<RawMediaRow>(db, `SELECT ${COLUMNS} FROM media WHERE id = ?`, [id]);
	return row ? toMedia(row) : null;
}

export interface NewMedia {
	nodeId: string | null;
	r2Key: string;
	alt?: string | null;
	position?: number;
	sha256?: string | null;
	kind?: string;
}

export async function insertMedia(db: D1Database, input: NewMedia): Promise<string> {
	const id = ulid();
	await run(
		db,
		`INSERT INTO media (id, node_id, r2_key, kind, width, height, alt, position, sha256)
		 VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
		[
			id,
			input.nodeId,
			input.r2Key,
			input.kind ?? 'image',
			input.alt ?? null,
			input.position ?? 0,
			input.sha256 ?? null
		]
	);
	return id;
}

export async function updateMedia(
	db: D1Database,
	id: string,
	patch: { alt?: string | null; position?: number }
): Promise<void> {
	const sets: string[] = [];
	/** @type {unknown[]} */
	const params: unknown[] = [];
	if (patch.alt !== undefined) {
		sets.push('alt = ?');
		params.push(patch.alt);
	}
	if (patch.position !== undefined) {
		sets.push('position = ?');
		params.push(patch.position);
	}
	if (sets.length === 0) return;
	params.push(id);
	await run(db, `UPDATE media SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteMedia(db: D1Database, id: string): Promise<void> {
	await run(db, 'DELETE FROM media WHERE id = ?', [id]);
}
