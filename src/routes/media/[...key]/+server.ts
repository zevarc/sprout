import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * GET /media/<key> — serves a stored object from R2 on our own origin.
 * Storing only the relative key (never an absolute bucket URL) is what keeps
 * media portable: moving buckets means changing this handler, not the data.
 */
export const GET: RequestHandler = async ({ params, platform }) => {
	const bucket = platform?.env?.MEDIA;
	if (!bucket) return new Response('Media unavailable', { status: 500 });

	const key = params.key;
	if (!key || key.includes('..')) return new Response('Bad request', { status: 400 });

	const object = await bucket.get(key);
	if (!object) return new Response('Not found', { status: 404 });

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
