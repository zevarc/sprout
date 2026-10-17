import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { feedTypes } from '$lib/content/registry';
import { generateRss } from '$lib/feed';

export const prerender = false;

export async function GET({ platform }) {
	const db = getDb(platform);
	const types = feedTypes().map((t) => t.type);
	const views = await listViews(db, { types, lang: 'zh', limit: 100 });
	return new Response(generateRss('zh', views), {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
		}
	});
}
