import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listProjects } from '$lib/content/view';
import { getContentType } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ platform, url }) {
	if (!getContentType('project')) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const projects = await listProjects(db, lang);
	return { projects, lang };
}
