import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getContentType } from '$lib/content/registry';
import { listFriendViews } from '$lib/content/view';
import { hasFriendApplications } from '$lib/server/repositories/friendApplications';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * The curated friend-link page. It overrides the generic `[type]` list for the
 * `friend` kind: cards point outward, and the application form is appended
 * below. The list is intentionally not filtered by locale — a blogroll is one
 * list for the whole site (see `FriendView`).
 */
export async function load({ platform, url }) {
	const type = getContentType('friend');
	if (!type?.public) throw error(404, 'Not found');

	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);

	const [friends, canApply] = await Promise.all([
		listFriendViews(db),
		hasFriendApplications(db)
	]);

	return { friends, canApply, lang };
}
