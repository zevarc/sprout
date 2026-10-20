import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import { searchNodes } from '$lib/server/repositories/nodes';
import { toMatchExpression } from '$lib/server/search';
import { nodeUrl } from '$lib/content/view';
import { extractExcerpt } from '$lib/reading';
import { site } from '$lib/site';

export const prerender = false;

/** GET /api/search?q=…&lang=… — full-text search over published nodes. */
export const GET: RequestHandler = async (event) => {
	const { url, platform } = event;
	const db = getDb(platform);
	const q = url.searchParams.get('q') ?? '';
	const lang = url.searchParams.get('lang') ?? site.defaultLocale;

	const expression = toMatchExpression(q);
	if (!expression) return json({ results: [] });

	// Signed-in editors search everything; everyone else only sees public nodes.
	const editor = await isEditor(event, db);
	const nodes = await searchNodes(db, expression, {
		lang,
		visibility: editor ? undefined : 'public',
		limit: 20
	});
	const results = nodes.map((n) => ({
		id: n.id,
		title: n.title ?? n.slug,
		type: n.type,
		url: nodeUrl(n),
		excerpt: extractExcerpt(n.bodyMd, n.summary ?? '')
	}));

	return json({ results });
};
