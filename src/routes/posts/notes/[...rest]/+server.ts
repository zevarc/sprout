import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLink, localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * Old nested note URLs. `notes` used to live at `/posts/notes/<slug>` while its
 * list page never existed; it is an ordinary single-segment type now.
 * Keep the old links working, in the caller's locale.
 *
 * GET /posts/notes          → /notes
 * GET /posts/notes/<slug>   → /notes/<slug>
 */
export const GET: RequestHandler = async (event) => {
	const lang = localeFromPath(event.url.pathname);
	const rest = event.params.rest ?? '';
	const path = rest ? `notes/${rest}` : 'notes';
	throw redirect(301, `/${getLink(path, lang)}`);
};
