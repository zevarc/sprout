import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { getTypeByRouteSegment } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * Generic list page for any registry type whose route is a single segment.
 * Public types list only `visibility='public'` nodes; private types are already
 * behind the session guard, so they list everything.
 */
export async function load({ params, platform, url }) {
	const type = getTypeByRouteSegment(params.type);
	if (!type) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const entries = await listViews(db, {
		types: [type.type],
		lang,
		visibility: type.public ? 'public' : undefined,
		limit: 200
	});
	return { type, entries, lang };
}
