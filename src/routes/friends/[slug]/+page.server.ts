import { error } from '@sveltejs/kit';
import { loadNodeView } from '$lib/server/loadNode';
import { getContentType } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * A friend link's local profile page. The generic `compact` detail renderer
 * knows nothing about outbound links, so the `friend` kind gets its own page
 * (SvelteKit ranks this static segment above `[type]/[slug]`).
 */
export async function load({ params, platform, url }) {
	const type = getContentType('friend');
	if (!type?.public) throw error(404, 'Not found');

	const lang = localeFromPath(url.pathname);
	const view = await loadNodeView(platform, 'friend', params.slug, lang);
	return { ...view, lang };
}
