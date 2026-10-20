import { getDb } from '$lib/server/db';
import { listNodes } from '$lib/server/repositories/nodes';
import { listActorNames } from '$lib/server/repositories/actors';
import { nodeToView } from '$lib/content/view';
import { listTypes } from '$lib/content/registry';
import { content } from '$lib/engine/registry';
import { hasFeature } from '$lib/engine/features';
import { localeFromPath } from '$lib/i18n';
import { error } from '@sveltejs/kit';

export const prerender = false;

/**
 * The merged timeline: every type in one feed, ordered by when things happened
 * (or were published — see `sprout.config.js` `content.timelineOrder`). Access is
 * enforced by the session guard (this route is private while `timeline` is on).
 */
export async function load({ platform, url }) {
	if (!hasFeature('timeline')) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);

	const nodes = await listNodes(db, {
		types: listTypes().map((t) => t.type),
		lang,
		status: 'published',
		orderBy: content?.timelineOrder ?? 'published',
		limit: 500
	});

	// Who recorded each entry, so the timeline can show the author's name.
	const authors = await listActorNames(db);

	return { entries: nodes.map((n) => nodeToView(n)), authors, lang };
}
