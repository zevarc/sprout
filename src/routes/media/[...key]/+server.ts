import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Only these extensions are served with their real type. Anything else — HTML,
 * SVG, XML, unknown — is forced to a download so it can never run as a document
 * on this origin (stored XSS via uploaded/restored media).
 */
const ALLOWED_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif',
	gif: 'image/gif',
	ico: 'image/x-icon',
	mp4: 'video/mp4',
	webm: 'video/webm'
};

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

	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	const known = ALLOWED_TYPES[ext];

	const headers: Record<string, string> = {
		'Content-Type': known ?? 'application/octet-stream',
		'Cache-Control': 'public, max-age=31536000, immutable',
		'X-Content-Type-Options': 'nosniff',
		// Neutralises any HTML/SVG that slips in: no scripts, no subresources.
		'Content-Security-Policy': "default-src 'none'; sandbox"
	};

	if (!known) {
		headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(key.split('/').pop() ?? 'file')}"`;
	}

	return new Response(object.body, { headers });
};
