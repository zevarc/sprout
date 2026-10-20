import { error } from '@sveltejs/kit';
import { loadNodeView } from '$lib/server/loadNode';
import { getTypeByRouteSegment } from '$lib/content/registry';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/**
 * Generic detail page. Private types are already session-guarded, so they may
 * resolve private nodes; public types must not (a private node 404s).
 */
export async function load({ params, platform, url }) {
	const type = getTypeByRouteSegment(params.type);
	if (!type) throw error(404, 'Not found');
	const view = await loadNodeView(platform, type.type, params.slug, localeFromPath(url.pathname), {
		allowPrivate: !type.public
	});
	return {
		...view,
		type: {
			type: type.type,
			label: type.label,
			detailRenderer: type.detailRenderer,
			comments: type.comments === true
		}
	};
}
