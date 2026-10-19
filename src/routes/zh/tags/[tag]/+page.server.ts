import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';

export const prerender = false;

export async function load({ params, platform }) {
	const db = getDb(platform);
	const tag = params.tag;
	const posts = await listViews(db, { types: ['post', 'note'], lang: 'zh', tag, limit: 200 });
	if (posts.length === 0) throw error(404, 'No content for this tag');
	return { tag, posts };
}
