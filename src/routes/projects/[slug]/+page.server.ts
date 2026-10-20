import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getNodeBySlug } from '$lib/server/repositories/nodes';
import { nodeToProjectView } from '$lib/content/view';
import { getContentType } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ params, platform, url }) {
	if (!getContentType('project')) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const node = await getNodeBySlug(db, 'project', params.slug, lang);
	if (!node || node.status !== 'published') throw error(404, 'Not found');

	return { project: nodeToProjectView(node), bodyHtml: node.bodyHtml ?? '', lang };
}
