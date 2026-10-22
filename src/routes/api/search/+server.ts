import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import { searchAssets } from '$lib/server/repositories/assets';
import { getContentType } from '$lib/content/registry';
import { toMatchExpression } from '$lib/server/search';
import { nodeUrl } from '$lib/content/view';
import { extractExcerpt } from '$lib/reading';
import { site } from '$lib/site';

export const prerender = false;

/**
 * GET /api/search?q=…&type=…&lang=…
 *
 * Search is per content kind: each kind has its own index, so `type` selects the
 * index. Signed-in editors search everything; everyone else sees public assets.
 */
export const GET: RequestHandler = async (event) => {
	const { url, platform } = event;
	const db = getDb(platform);
	const q = url.searchParams.get('q') ?? '';
	const lang = url.searchParams.get('lang') ?? site.defaultLocale;
	const type = url.searchParams.get('type') ?? 'post';
	if (!getContentType(type)) return json({ results: [] });

	const expression = toMatchExpression(q);
	if (!expression) return json({ results: [] });

	const editor = await isEditor(event, db);
	const nodes = await searchAssets(db, type, expression, {
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
