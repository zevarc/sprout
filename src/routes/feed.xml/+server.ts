import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { feedTypes } from '$lib/content/registry';
import { generateRss } from '$lib/feed';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function GET({ platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const types = feedTypes().map((t) => t.type);
	const views = await listViews(db, { types, lang, limit: 100 });
	return new Response(generateRss(views, lang), {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
		}
	});
}
