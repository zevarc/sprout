import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { publicTypes } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';
import { site } from '$lib/site';

export const prerender = false;

export async function load({ params, platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const tag = params.tag;
	const posts = await listViews(db, {
		types: publicTypes().map((t) => t.type),
		lang,
		tag,
		limit: 200
	});
	if (posts.length === 0) throw error(404, 'No content for this tag');

	// Same tag, other languages: only where it has content, so an hreflang never
	// points at a 404.
	const tagLocales = [];
	for (const locale of site.locales) {
		if (locale.code === lang) {
			tagLocales.push(lang);
			continue;
		}
		const siblings = await listViews(db, {
			types: publicTypes().map((t) => t.type),
			lang: locale.code,
			tag,
			limit: 1
		});
		if (siblings.length > 0) tagLocales.push(locale.code);
	}

	return { tag, posts, lang, tagLocales };
}
