import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ params, platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const tag = params.tag;
	const posts = await listViews(db, {
		types: ['post', 'note'],
		lang,
		tag,
		limit: 200
	});
	if (posts.length === 0) throw error(404, 'No content for this tag');
	return { tag, posts, lang };
}
