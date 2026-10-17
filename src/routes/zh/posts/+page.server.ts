import { getDb } from '$lib/server/db';
import { listViews } from '$lib/content/view';

export const prerender = false;

export async function load({ platform }) {
	const db = getDb(platform);
	const posts = await listViews(db, { types: ['post'], lang: 'zh', limit: 100 });
	const notes = await listViews(db, { types: ['note'], lang: 'zh', limit: 100 });
	return { posts, notes };
}
