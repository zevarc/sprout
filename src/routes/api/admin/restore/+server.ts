import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { restoreFromBundle, type ExportFile } from '$lib/server/restore';

export const prerender = false;

/**
 * POST /api/admin/restore { files } — rebuilds the database from an export
 * bundle. See `src/lib/server/restore.ts` for the actual work.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let payload: { files?: ExportFile[] };
	try {
		payload = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const result = await restoreFromBundle(db, payload.files ?? []);
	return json({ ok: true, ...result });
};
