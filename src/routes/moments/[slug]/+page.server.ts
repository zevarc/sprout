import { error } from '@sveltejs/kit';
import { loadNodeView } from '$lib/server/loadNode';
import { site } from '$lib/site';

export const prerender = false;

export function load({ params, platform }) {
	if (!site.features.moments) throw error(404, 'Not found');
	return loadNodeView(platform, 'moment', params.slug, 'en');
}
