import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getAssetBySlug, listGroupNodes } from '$lib/server/repositories/assets';
import { nodeToView, nodeUrl, translationLinks, findRelatedViews } from '$lib/content/view';

/**
 * Shared detail-page loader: resolves an asset, its translations and related items.
 *
 * Public detail routes must set `allowPrivate: false` (the default) so a private
 * asset 404s rather than leaking through a guessable slug; the owner area opts in.
 *
 * Translations come from `group_id`, never from a shared slug: each language may
 * use its own, so `translations` carries the real URL per locale.
 */
export async function loadNodeView(
	platform: App.Platform | undefined,
	type: string,
	slug: string,
	lang: string,
	opts: { allowPrivate?: boolean } = {}
) {
	const db = getDb(platform);
	const node = await getAssetBySlug(db, type, slug, lang);
	if (!node || node.status !== 'published') throw error(404, 'Not found');
	if (node.visibility === 'private' && !opts.allowPrivate) throw error(404, 'Not found');
	const siblings = (await listGroupNodes(db, node.groupId)).filter((n) => n.type === node.type);
	const translations = translationLinks(siblings);
	// The current asset is always one of its own alternates, even while previewing
	// a draft/private asset behind the owner session.
	if (!translations.some((t) => t.lang === node.lang)) {
		translations.push({ lang: node.lang, url: nodeUrl(node) });
	}
	const related = await findRelatedViews(db, node);
	return { post: nodeToView(node, translations.length > 1), related, translations };
}
