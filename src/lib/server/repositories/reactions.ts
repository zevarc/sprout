/**
 * `reactions` (docs/DATA-MODEL.md §4.8). Ephemeral state: one row per
 * (asset, person, emoji), and it cascades with the person.
 */

import type { D1Database } from '$lib/server/db';
import { query, run } from '$lib/server/db';

export interface Reaction {
	assetId: string;
	personId: string;
	emoji: string;
	createdAt: string;
}

export async function addReaction(
	db: D1Database,
	assetId: string,
	personId: string,
	emoji: string
): Promise<void> {
	await run(
		db,
		`INSERT INTO reactions (asset_id, person_id, emoji, created_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(asset_id, person_id, emoji) DO NOTHING`,
		[assetId, personId, emoji, new Date().toISOString()]
	);
}

export async function removeReaction(
	db: D1Database,
	assetId: string,
	personId: string,
	emoji: string
): Promise<void> {
	await run(db, 'DELETE FROM reactions WHERE asset_id = ? AND person_id = ? AND emoji = ?', [
		assetId,
		personId,
		emoji
	]);
}

export async function listReactions(db: D1Database, assetId: string): Promise<Reaction[]> {
	const rows = await query<{ asset_id: string; person_id: string; emoji: string; created_at: string }>(
		db,
		'SELECT asset_id, person_id, emoji, created_at FROM reactions WHERE asset_id = ? ORDER BY created_at',
		[assetId]
	);
	return rows.map((r) => ({
		assetId: r.asset_id,
		personId: r.person_id,
		emoji: r.emoji,
		createdAt: r.created_at
	}));
}

/** Every reaction for the export (deterministic order). */
export async function exportReactionRows(db: D1Database): Promise<Record<string, unknown>[]> {
	return query<Record<string, unknown>>(
		db,
		'SELECT asset_id, person_id, emoji, created_at FROM reactions ORDER BY asset_id, person_id, emoji'
	);
}
