import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { buildExport } from '$lib/server/export';

export const prerender = false;

/** GET /api/admin/export — the canonical, deterministic export bundle. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const bundle = await buildExport(db);
	return json(bundle);
};
