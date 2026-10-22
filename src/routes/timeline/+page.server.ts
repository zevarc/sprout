import { getDb } from '$lib/server/db';
import { getSession } from '$lib/server/auth';
import { listAssets } from '$lib/server/repositories/assets';
import { listPersonNames } from '$lib/server/repositories/people';
import { nodeToView } from '$lib/content/view';
import { listTypes } from '$lib/content/registry';
import { content } from '$lib/engine/registry';
import { hasFeature } from '$lib/engine/features';
import { localeFromPath } from '$lib/i18n';
import { error } from '@sveltejs/kit';

export const prerender = false;

/**
 * The merged timeline: every kind in one list, ordered by when things happened
 * (or were published — see `sprout.config.js` `content.timelineOrder`).
 *
 * Public by default — visitors see public entries only; an owner/member session
 * also sees private ones. Sites that want a members-only timeline list
 * `/timeline` in `sprout.config.js` → `privateRoutes`.
 */
export async function load(event) {
	if (!hasFeature('timeline')) throw error(404, 'Not found');

	const db = getDb(event.platform);
	const lang = localeFromPath(event.url.pathname);
	const session = await getSession(event, db);
	const privileged = session?.role === 'owner' || session?.role === 'member';

	const nodes = await listAssets(db, {
		types: listTypes().map((t) => t.type),
		lang,
		status: 'published',
		visibility: privileged ? undefined : 'public',
		orderBy: content?.timelineOrder ?? 'published',
		limit: 500
	});

	// Who recorded each entry, so the timeline can show the author's name.
	const authors = await listPersonNames(db);

	return { entries: nodes.map((n) => nodeToView(n)), authors, lang };
}
