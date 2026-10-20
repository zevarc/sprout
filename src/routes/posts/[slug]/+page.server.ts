import { loadNodeView } from '$lib/server/loadNode';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export function load({ params, platform, url }) {
	return loadNodeView(platform, 'post', params.slug, localeFromPath(url.pathname));
}
