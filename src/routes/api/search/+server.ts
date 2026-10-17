import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { searchNodes } from '$lib/server/repositories/nodes';
import { toMatchExpression } from '$lib/server/search';
import { nodeUrl } from '$lib/content/view';
import { extractExcerpt } from '$lib/reading';

export const prerender = false;

/** GET /api/search?q=…&lang=en — full-text search over published nodes. */
export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform);
	const q = url.searchParams.get('q') ?? '';
	const lang = url.searchParams.get('lang') ?? 'en';

	const expression = toMatchExpression(q);
	if (!expression) return json({ results: [] });

	const nodes = await searchNodes(db, expression, { lang, limit: 20 });
	const results = nodes.map((n) => ({
		id: n.id,
		title: n.title ?? n.slug,
		type: n.type,
		url: nodeUrl(n),
		excerpt: extractExcerpt(n.bodyMd, n.summary ?? '')
	}));

	return json({ results });
};
