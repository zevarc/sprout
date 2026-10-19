import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, run } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { getNode } from '$lib/server/repositories/nodes';
import { ulid } from '$lib/server/id';

export const prerender = false;

/** GET /api/admin/link?id=… — nodes this one is paired with (translations). */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	if (!id) return json({ error: 'id required' }, { status: 400 });

	const rows = await db
		.prepare("SELECT to_id FROM relations WHERE from_id = ? AND rel = 'translation'")
		.bind(id)
		.all<{ to_id: string }>();

	return json({ ids: (rows.results ?? []).map((row) => row.to_id) });
};

/**
 * POST /api/admin/link { id, otherId } — pair two nodes as translations.
 * Writes the relation in both directions (the detail loader reads the row for
 * the node it is rendering) and shares a `group_id` for exports.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const id = String(body.id ?? '');
	const otherId = String(body.otherId ?? '');
	if (!id || !otherId || id === otherId) return json({ error: 'invalid ids' }, { status: 400 });

	const [a, b] = await Promise.all([getNode(db, id), getNode(db, otherId)]);
	if (!a || !b) return json({ error: 'not found' }, { status: 404 });
	if (a.type !== b.type) return json({ error: 'type mismatch' }, { status: 400 });

	const groupId = a.groupId ?? b.groupId ?? ulid();

	await db.batch([
		db
			.prepare("INSERT OR REPLACE INTO relations (from_id, to_id, rel) VALUES (?, ?, 'translation')")
			.bind(id, otherId),
		db
			.prepare("INSERT OR REPLACE INTO relations (from_id, to_id, rel) VALUES (?, ?, 'translation')")
			.bind(otherId, id),
		db.prepare('UPDATE nodes SET group_id = ? WHERE id IN (?, ?)').bind(groupId, id, otherId)
	]);

	return json({ ok: true, groupId });
};

/** DELETE /api/admin/link?id=…&otherId=… — remove the pairing both ways. */
export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	const otherId = event.url.searchParams.get('otherId');
	if (!id || !otherId) return json({ error: 'id and otherId required' }, { status: 400 });

	await run(
		db,
		"DELETE FROM relations WHERE rel = 'translation' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))",
		[id, otherId, otherId, id]
	);
	return json({ ok: true });
};
