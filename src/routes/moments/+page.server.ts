import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';
import { site } from '$lib/site';

export const prerender = false;

export async function load({ platform }) {
	if (!site.features.moments) throw error(404, 'Not found');

	const db = getDb(platform);
	const moments = await listViews(db, { types: ['moment'], lang: 'en', limit: 100 });
	return { moments };
}
