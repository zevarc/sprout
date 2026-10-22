import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const posts = await listViews(db, { types: ['post'], lang, limit: 100 });
	return { posts, lang };
}
