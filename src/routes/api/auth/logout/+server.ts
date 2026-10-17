import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { logout } from '$lib/server/auth';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	await logout(event, db);
	return json({ ok: true });
};
