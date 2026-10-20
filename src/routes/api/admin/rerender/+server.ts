import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { rebuildBodyHtml } from '$lib/server/rebuild';

export const prerender = false;

/**
 * POST /api/admin/rerender[?id=<nodeId>] — rebuild the derived `body_html`
 * column from `body_md` (see `lib/server/rebuild.ts`). Idempotent; touches
 * neither the source markdown nor any timestamp.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id') ?? undefined;
	const result = await rebuildBodyHtml(db, id);
	return json({ ok: true, ...result });
};
