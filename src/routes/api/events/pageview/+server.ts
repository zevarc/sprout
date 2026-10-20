import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { recordPageview } from '$lib/server/stats';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

/**
 * Privacy-preserving pageview beacon. No cookies, no IP, no user id — only an
 * aggregated (day, path, referrer-domain) counter.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!hasFeature('analytics')) return json({ ok: true });

	const db = getDb(platform);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false }, { status: 400 });
	}

	const path = String(body.path ?? '').slice(0, 200);
	if (!path) return json({ ok: false }, { status: 400 });

	let referrer = '';
	if (body.referrer) {
		try {
			referrer = new URL(String(body.referrer)).hostname.slice(0, 120);
		} catch {
			referrer = '';
		}
	}

	await recordPageview(db, path, referrer);
	return json({ ok: true });
};
