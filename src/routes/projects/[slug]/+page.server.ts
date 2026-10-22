import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getAssetBySlug, listGroupNodes } from '$lib/server/repositories/assets';
import { nodeToProjectView, nodeUrl, translationLinks } from '$lib/content/view';
import { getContentType } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ params, platform, url }) {
	if (!getContentType('project')) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const node = await getAssetBySlug(db, 'project', params.slug, lang);
	if (!node || node.status !== 'published') throw error(404, 'Not found');
	// A static override must honour visibility exactly like the generic detail route.
	if (node.visibility === 'private') throw error(404, 'Not found');

	// Alternates are resolved from `group_id`, so a translation may use its own slug.
	const siblings = (await listGroupNodes(db, node.groupId)).filter((n) => n.type === 'project');
	const translations = translationLinks(siblings);
	if (!translations.some((t) => t.lang === node.lang)) {
		translations.push({ lang: node.lang, url: nodeUrl(node) });
	}

	return { project: nodeToProjectView(node), bodyHtml: node.bodyHtml ?? '', lang, translations };
}
