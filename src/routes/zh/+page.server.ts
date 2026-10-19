import { getDb } from '$lib/server/db';
import { homeSelection } from '$lib/content/view';

export const prerender = false;

export async function load({ platform }) {
	const db = getDb(platform);
	const { posts, projects } = await homeSelection(db, 'zh');
	return { posts, projects };
}
