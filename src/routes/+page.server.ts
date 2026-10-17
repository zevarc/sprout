import { getDb } from '$lib/server/db';
import { listViews, listProjects } from '$lib/content/view';

export const prerender = false;

export async function load({ platform }) {
	const db = getDb(platform);
	const posts = await listViews(db, { types: ['post', 'note'], lang: 'en', limit: 100 });
	const projects = await listProjects(db, 'en');
	return { posts, projects };
}
