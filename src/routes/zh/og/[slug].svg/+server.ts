import { getDb } from '$lib/server/db';
import { getNodeBySlug } from '$lib/server/repositories/nodes';
import { generateOgSvg } from '$lib/og';

export const prerender = false;

export async function GET({ params, platform }) {
	const db = getDb(platform);
	const node =
		(await getNodeBySlug(db, 'post', params.slug, 'zh')) ??
		(await getNodeBySlug(db, 'note', params.slug, 'zh')) ??
		(await getNodeBySlug(db, 'project', params.slug, 'zh'));
	if (!node) return new Response('Not found', { status: 404 });
	return new Response(generateOgSvg(node.title ?? node.slug, 'zh'), {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
}
