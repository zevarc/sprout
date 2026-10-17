import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { renderMarkdown } from '$lib/server/render';

export const prerender = false;

/** POST /api/admin/preview { bodyMd } — renders markdown with the real pipeline. */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: { bodyMd?: string };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const html = await renderMarkdown(String(body.bodyMd ?? ''));
	return json({ html });
};
