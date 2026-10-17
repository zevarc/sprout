import { loadNodeView } from '$lib/server/loadNode';

export const prerender = false;

export function load({ params, platform }) {
	return loadNodeView(platform, 'post', params.slug, 'en');
}
