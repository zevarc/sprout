import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { getAsset, relatedIds, setGroup, ungroup } from '$lib/server/repositories/assets';
import { invalidateAll } from '$lib/server/cache';

export const prerender = false;

/** GET /api/admin/link?id=… — the other members of this asset's group. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	if (!id) return json({ error: 'id required' }, { status: 400 });

	const asset = await getAsset(db, id);
	if (!asset) return json({ ids: [] });
	return json({ ids: await relatedIds(db, id) });
};

/**
 * POST /api/admin/link { id, otherId } — group two assets together. Translations
 * and series both live in a `group_id`; this is the single source of truth for
 * pairing (there is no separate translation edge).
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

	const [a, b] = await Promise.all([getAsset(db, id), getAsset(db, otherId)]);
	if (!a || !b) return json({ error: 'not found' }, { status: 404 });
	if (a.type !== b.type) return json({ error: 'type mismatch' }, { status: 400 });

	const groupId = a.groupId ?? a.id;
	await setGroup(db, [id, otherId], groupId);
	await invalidateAll(event.url.origin);
	return json({ ok: true, groupId });
};

/** DELETE /api/admin/link?id=…&otherId=… — ungroup both (each becomes its own group). */
export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	const otherId = event.url.searchParams.get('otherId');
	if (!id || !otherId) return json({ error: 'id and otherId required' }, { status: 400 });

	await ungroup(db, [id, otherId]);
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};
