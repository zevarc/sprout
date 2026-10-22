import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { getContentType } from '$lib/content/registry';
import { homeSections } from '$lib/engine/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * The home page is assembled from configured sections. Each section picks a set
 * of declared kinds and an order (a declared field when `sort` is set, otherwise
 * publish time). The engine knows nothing about any particular site's home shape.
 */
export async function load({ platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);

	const sections = await Promise.all(
		homeSections.map(async (section) => {
			const types = section.types.filter((ty) => getContentType(ty));
			if (types.length === 0) return { ...section, items: [] };
			const items = await listViews(db, {
				types,
				lang,
				visibility: 'public',
				limit: section.limit,
				orderByField: section.sort
			});
			return { ...section, items };
		})
	);

	return { sections, lang };
}
