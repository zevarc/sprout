import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	hasBlogroll,
	listDiscoveredBlogs,
	listDiscoveredPicks,
	getLatestPick
} from '$lib/server/repositories/blogs';

export const prerender = false;

/**
 * The discovered-blog blogroll: what the Zevprobe discovery service has found,
 * pulled in by `scripts/blogs-sync.mjs`. Sites that never run the migration or
 * the sync simply 404 here — the capability is opt-in by table existence.
 */
export async function load(event) {
	const db = getDb(event.platform);
	if (!(await hasBlogroll(db))) throw error(404, 'Not found');

	const [blogs, picks, latest] = await Promise.all([
		listDiscoveredBlogs(db),
		listDiscoveredPicks(db),
		getLatestPick(db)
	]);

	return { blogs, picks, latest };
}
