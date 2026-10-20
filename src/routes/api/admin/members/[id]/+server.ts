import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { deleteActor } from '$lib/server/repositories/actors';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

/** DELETE /api/admin/members/[id] — remove a member and their sessions (owner only). */
export const DELETE: RequestHandler = async (event) => {
	if (!hasFeature('members')) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	await deleteActor(db, event.params.id);
	return json({ ok: true });
};
