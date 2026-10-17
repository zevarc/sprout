import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession } from '$lib/server/auth';

export const prerender = false;

/** GET /api/auth/session — current identity for the caller. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const session = await getSession(event, db);
	return json({ role: session?.role ?? 'visitor', isOwner: session?.role === 'owner' });
};
