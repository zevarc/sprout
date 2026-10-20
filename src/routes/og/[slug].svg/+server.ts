import { getDb } from '$lib/server/db';
import { getNodeBySlug } from '$lib/server/repositories/nodes';
import { publicTypes } from '$lib/content/registry';
import { generateOgSvg } from '$lib/og';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

/** Social card for any *public* node in the requested locale. */
export async function GET({ params, platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);

	let node = null;
	for (const type of publicTypes()) {
		node = await getNodeBySlug(db, type.type, params.slug, lang);
		if (node) break;
	}

	if (!node || node.visibility !== 'public') {
		return new Response('Not found', { status: 404 });
	}

	return new Response(generateOgSvg(node.title ?? node.slug, lang), {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
}
