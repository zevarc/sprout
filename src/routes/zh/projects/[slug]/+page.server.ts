import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getNodeBySlug } from '$lib/server/repositories/nodes';
import { nodeToProjectView } from '$lib/content/view';
import { site } from '$lib/site';

export const prerender = false;

export async function load({ params, platform }) {
	if (!site.features.projects) throw error(404, 'Not found');

	const db = getDb(platform);
	const node = await getNodeBySlug(db, 'project', params.slug, 'zh');
	if (!node || node.status !== 'published') throw error(404, 'Not found');

	return { project: nodeToProjectView(node), bodyHtml: node.bodyHtml ?? '' };
}
