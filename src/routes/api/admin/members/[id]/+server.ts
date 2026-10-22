import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { retirePerson } from '$lib/server/repositories/people';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

/**
 * DELETE /api/admin/members/[id] — revoke membership (owner only).
 *
 * Revoking is not erasing: the person row stays, so everything they wrote keeps
 * its attribution; their sessions and external accounts are removed and the
 * email hash is cleared (docs/DATA-MODEL.md §5.3).
 */
export const DELETE: RequestHandler = async (event) => {
	if (!hasFeature('members')) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	await retirePerson(db, event.params.id);
	return json({ ok: true });
};
