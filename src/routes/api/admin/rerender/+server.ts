import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { renderMarkdown } from '$lib/server/render';
import { getNode, listNodes } from '$lib/server/repositories/nodes';

export const prerender = false;

/**
 * POST /api/admin/rerender[?id=<nodeId>] — rebuild the derived `body_html`
 * column from `body_md`.
 *
 * `body_html` is written at save time, so a renderer change (new image
 * attributes, escaping rules, …) only affects newly saved content. This rebuilds
 * existing rows without touching `updated_at`, published dates or the source
 * markdown — the column is documented as reproducible, this is how you reproduce it.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	const nodes = id
		? [await getNode(db, id)].filter((n) => n !== null)
		: await listNodes(db, { limit: 1000 });

	let updated = 0;
	let skipped = 0;

	for (const node of nodes) {
		if (!node.bodyMd) {
			skipped++;
			continue;
		}
		const html = await renderMarkdown(node.bodyMd);
		if (html === node.bodyHtml) {
			skipped++;
			continue;
		}
		await db.prepare('UPDATE nodes SET body_html = ? WHERE id = ?').bind(html, node.id).run();
		updated++;
	}

	return json({ ok: true, scanned: nodes.length, updated, skipped });
};
