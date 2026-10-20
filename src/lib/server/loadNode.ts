import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getNodeBySlug, relatedIds } from '$lib/server/repositories/nodes';
import { nodeToView, findRelatedViews } from '$lib/content/view';

/**
 * Shared detail-page loader: resolves a node, its translations and related items.
 *
 * Public detail routes must set `allowPrivate: false` (the default) so a private
 * node 404s rather than leaking through a guessable slug; the owner area opts in.
 */
export async function loadNodeView(
	platform: App.Platform | undefined,
	type: string,
	slug: string,
	lang: string,
	opts: { allowPrivate?: boolean } = {}
) {
	const db = getDb(platform);
	const node = await getNodeBySlug(db, type, slug, lang);
	if (!node || node.status !== 'published') throw error(404, 'Not found');
	if (node.visibility === 'private' && !opts.allowPrivate) throw error(404, 'Not found');
	const translations = await relatedIds(db, node.id);
	const related = await findRelatedViews(db, node);
	return { post: nodeToView(node, translations.length > 0), related };
}
