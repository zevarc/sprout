import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { loginOwner } from '$lib/server/auth';

export const prerender = false;

/** POST /api/auth/login { token } — exchanges ADMIN_TOKEN for a session cookie. */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const ok = await loginOwner(event, db);
	if (!ok) return json({ error: 'invalid token' }, { status: 401 });
	return json({ ok: true, role: 'owner' });
};
