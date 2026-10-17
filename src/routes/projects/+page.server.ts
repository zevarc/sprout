import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listProjects } from '$lib/content/view';
import { site } from '$lib/site';

export const prerender = false;

export async function load({ platform }) {
	if (!site.features.projects) throw error(404, 'Not found');

	const db = getDb(platform);
	const projects = await listProjects(db, 'en');
	return { projects };
}
